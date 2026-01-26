/**
 * Document Classification Service
 * Auto-detects document types using GPT-5 nano with vision
 */

import OpenAI from 'openai';
import { pool } from './database';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = 'gpt-4.1-nano';

// Document types that can be detected
export type DocumentType =
  | 'ID_CARD'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'PROOF_OF_ADDRESS'
  | 'CV'
  | 'PORTFOLIO'
  | 'RECOMMENDATION_LETTER'
  | 'CERTIFICATE'
  | 'DIPLOMA'
  | 'LICENSE'
  | 'TRANSCRIPT'
  | 'PUBLICATION'
  | 'PATENT'
  | 'OTHER';

// Category mapping
export const DOCUMENT_CATEGORIES: Record<DocumentType, string> = {
  ID_CARD: 'IDENTITY',
  PASSPORT: 'IDENTITY',
  DRIVER_LICENSE: 'IDENTITY',
  PROOF_OF_ADDRESS: 'IDENTITY',
  CV: 'PROFESSIONAL',
  PORTFOLIO: 'PROFESSIONAL',
  RECOMMENDATION_LETTER: 'PROFESSIONAL',
  CERTIFICATE: 'ACADEMIC',
  DIPLOMA: 'ACADEMIC',
  LICENSE: 'ACADEMIC',
  TRANSCRIPT: 'ACADEMIC',
  PUBLICATION: 'OTHER',
  PATENT: 'OTHER',
  OTHER: 'OTHER'
};

// French labels for document types
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ID_CARD: "Carte d'identité",
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  CV: 'Curriculum Vitae',
  PORTFOLIO: 'Portfolio',
  RECOMMENDATION_LETTER: 'Lettre de recommandation',
  CERTIFICATE: 'Certificat',
  DIPLOMA: 'Diplôme',
  LICENSE: 'Licence professionnelle',
  TRANSCRIPT: 'Relevé de notes',
  PUBLICATION: 'Publication',
  PATENT: 'Brevet',
  OTHER: 'Document'
};

interface ClassificationResult {
  detected_type: DocumentType;
  category: string;
  confidence: number;
  suggested_title: string;
  details: {
    issuing_country?: string;
    document_number_visible?: boolean;
    expiry_date_visible?: boolean;
    person_name_visible?: boolean;
    institution_name?: string;
    document_date?: string;
    language_detected?: string;
  };
  reasoning: string;
}

/**
 * Classify a document from its image/PDF content
 */
export async function classifyDocument(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
): Promise<ClassificationResult> {
  const startTime = Date.now();

  try {
    // For PDFs, we'd need to convert to images first
    // For now, we'll handle images directly
    const isPdf = mediaType === 'application/pdf';

    if (isPdf) {
      // For PDFs, use a document-based approach
      return await classifyPdfDocument(imageBase64);
    }

    const prompt = `Analyse cette image de document et détermine son type.

Types de documents possibles:
- ID_CARD: Carte d'identité nationale (CNI, carte d'identité)
- PASSPORT: Passeport
- DRIVER_LICENSE: Permis de conduire
- PROOF_OF_ADDRESS: Justificatif de domicile (facture, attestation)
- CV: Curriculum Vitae / Résumé
- PORTFOLIO: Portfolio (travaux, projets)
- RECOMMENDATION_LETTER: Lettre de recommandation
- CERTIFICATE: Certificat de formation ou professionnel
- DIPLOMA: Diplôme (Baccalauréat, Licence, Master, etc.)
- LICENSE: Licence professionnelle (médecin, avocat, etc.)
- TRANSCRIPT: Relevé de notes / Bulletin scolaire
- PUBLICATION: Publication scientifique / Article
- PATENT: Brevet
- OTHER: Autre document non identifiable

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "detected_type": "TYPE_DETECTÉ",
  "confidence": 0.95,
  "suggested_title": "Titre suggéré en français",
  "details": {
    "issuing_country": "Pays si visible",
    "document_number_visible": true/false,
    "expiry_date_visible": true/false,
    "person_name_visible": true/false,
    "institution_name": "Nom de l'institution si visible",
    "document_date": "Date si visible (YYYY-MM-DD)",
    "language_detected": "Langue principale du document"
  },
  "reasoning": "Explication courte de la classification"
}

Sois précis dans l'identification. Pour les documents d'identité africains, identifie correctement les CNI, passeports CEDEAO, etc.`;

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en classification de documents. Réponds toujours en JSON valide.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_completion_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const resultText = response.choices[0]?.message?.content;
    if (!resultText) {
      throw new Error('No response from GPT-5 nano');
    }

    const result = JSON.parse(resultText);

    // Validate detected_type
    const validTypes: DocumentType[] = [
      'ID_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'PROOF_OF_ADDRESS',
      'CV', 'PORTFOLIO', 'RECOMMENDATION_LETTER', 'CERTIFICATE',
      'DIPLOMA', 'LICENSE', 'TRANSCRIPT', 'PUBLICATION', 'PATENT', 'OTHER'
    ];

    const detectedType: DocumentType = validTypes.includes(result.detected_type)
      ? result.detected_type
      : 'OTHER';

    const processingTime = Date.now() - startTime;
    console.log(`📄 Document classified as ${detectedType} (${processingTime}ms)`);

    return {
      detected_type: detectedType,
      category: DOCUMENT_CATEGORIES[detectedType],
      confidence: result.confidence || 0.5,
      suggested_title: result.suggested_title || DOCUMENT_TYPE_LABELS[detectedType],
      details: result.details || {},
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error classifying document:', error);
    // Return default classification on error
    return {
      detected_type: 'OTHER',
      category: 'OTHER',
      confidence: 0,
      suggested_title: 'Document',
      details: {},
      reasoning: 'Erreur lors de la classification automatique'
    };
  }
}

/**
 * Classify a PDF document
 * Note: PDFs are typically professional documents (CV, certificates, etc.)
 * For accurate classification, we make an educated guess based on common patterns
 */
async function classifyPdfDocument(_pdfBase64: string): Promise<ClassificationResult> {
  // PDFs are most commonly CVs in our context
  // For more accurate classification, we'd need PDF text extraction
  // or PDF to image conversion which requires additional libraries
  return {
    detected_type: 'CV',
    category: 'PROFESSIONAL',
    confidence: 0.6,
    suggested_title: 'Curriculum Vitae',
    details: {
      language_detected: 'Français'
    },
    reasoning: 'Document PDF - probablement un CV ou document professionnel. Vérifiez et ajustez le type si nécessaire.'
  };
}

/**
 * Classify document from URL (fetches and processes)
 */
export async function classifyDocumentFromUrl(
  fileUrl: string
): Promise<ClassificationResult> {
  try {
    // Fetch the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      mediaType = 'image/jpeg';
    } else if (contentType.includes('png')) {
      mediaType = 'image/png';
    } else if (contentType.includes('webp')) {
      mediaType = 'image/webp';
    } else if (contentType.includes('pdf')) {
      mediaType = 'application/pdf';
    } else {
      // Try to detect from file extension
      const ext = fileUrl.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mediaType = 'image/jpeg';
      else if (ext === 'png') mediaType = 'image/png';
      else if (ext === 'webp') mediaType = 'image/webp';
      else if (ext === 'pdf') mediaType = 'application/pdf';
      else mediaType = 'image/jpeg'; // Default to JPEG
    }

    return classifyDocument(base64, mediaType);
  } catch (error) {
    console.error('Error classifying document from URL:', error);
    return {
      detected_type: 'OTHER',
      category: 'OTHER',
      confidence: 0,
      suggested_title: 'Document',
      details: {},
      reasoning: 'Erreur lors du chargement du document'
    };
  }
}

/**
 * Update document with auto-detected type
 */
export async function updateDocumentWithClassification(
  documentId: string,
  classification: ClassificationResult
): Promise<void> {
  await pool.query(`
    UPDATE documents SET
      type = $1,
      category = $2,
      title = COALESCE(NULLIF(title, 'Document'), $3),
      metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
      updated_at = NOW()
    WHERE id = $5
  `, [
    classification.detected_type,
    classification.category,
    classification.suggested_title,
    JSON.stringify({
      auto_classified: true,
      classification_confidence: classification.confidence,
      classification_details: classification.details,
      classification_reasoning: classification.reasoning
    }),
    documentId
  ]);
}
