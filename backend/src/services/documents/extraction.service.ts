/**
 * Document Extraction Service
 * Uses GPT-4o-mini multimodal to extract structured metadata from documents
 */

import OpenAI from 'openai';
import {
  DocumentType,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_CATEGORIES,
  DocumentCategory,
} from '../../constants/documents';

// ═══════════════════════════════════════════════════════════════
// OPENAI CLIENT
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXTRACTION_MODEL = 'gpt-4o-mini';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ExtractedDocumentData {
  // Document classification
  detected_type: DocumentType;
  detected_category: DocumentCategory;
  confidence_score: number; // 0-1

  // Common fields
  title?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  description?: string;

  // CV/Resume specific
  skills?: string[];
  experience_years?: number;
  languages?: string[];
  education_level?: string;
  job_titles?: string[];

  // Certificate/Diploma specific
  field_of_study?: string;
  institution?: string;
  grade?: string;
  honors?: string;
  accreditation?: string;

  // Identity document specific
  full_name?: string;
  date_of_birth?: string;
  nationality?: string;
  document_number?: string;
  place_of_birth?: string;

  // Auto-generated tags
  tags: string[];

  // Summary
  summary?: string;

  // Raw extracted text (for search)
  extracted_text?: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: ExtractedDocumentData;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTION PROMPTS
// ═══════════════════════════════════════════════════════════════

const EXTRACTION_SYSTEM_PROMPT = `Tu es un expert en analyse de documents. Tu dois extraire les informations structurées des documents fournis (CV, diplômes, certificats, documents d'identité, etc.).

Règles:
1. Réponds UNIQUEMENT en JSON valide
2. Si une information n'est pas trouvée, omets le champ plutôt que de mettre null
3. Les dates doivent être au format ISO (YYYY-MM-DD) quand possible
4. Les compétences et tags doivent être en minuscules et normalisés
5. Le score de confiance (0-1) reflète ta certitude sur le type de document détecté
6. Génère des tags pertinents pour faciliter la recherche

Types de documents possibles:
- CV: Curriculum Vitae, Resume
- CERTIFICATE: Certificat de formation, attestation
- DIPLOMA: Diplôme universitaire, scolaire
- LICENSE: Licence professionnelle, permis d'exercer
- PORTFOLIO: Portfolio créatif, book
- RECOMMENDATION_LETTER: Lettre de recommandation
- TRANSCRIPT: Bulletin scolaire, relevé de notes
- PUBLICATION: Article, publication scientifique
- PATENT: Brevet
- ID_CARD: Carte d'identité nationale
- PASSPORT: Passeport
- DRIVER_LICENSE: Permis de conduire
- PROOF_OF_ADDRESS: Justificatif de domicile
- OTHER: Autre document`;

const getExtractionUserPrompt = (mimeType: string) => `
Analyse ce document et extrais les informations structurées.

Le document est de type: ${mimeType}

Réponds avec un JSON contenant:
{
  "detected_type": "TYPE_DU_DOCUMENT",
  "detected_category": "PROFESSIONAL|ACADEMIC|IDENTITY|OTHER",
  "confidence_score": 0.0-1.0,
  "title": "Titre du document si applicable",
  "issuer": "Émetteur/Organisation",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD si applicable",
  "description": "Brève description du contenu",
  "skills": ["compétence1", "compétence2"],
  "languages": ["français", "anglais"],
  "field_of_study": "Domaine d'étude",
  "institution": "Institution/École",
  "full_name": "Nom complet si document d'identité",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Résumé en une phrase du document",
  "extracted_text": "Texte principal extrait (max 500 caractères)"
}

N'inclus que les champs pertinents pour ce type de document.
`;

// ═══════════════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract metadata from a document using GPT-4o-mini vision
 */
export async function extractDocumentMetadata(
  fileUrl: string,
  mimeType: string
): Promise<ExtractionResult> {
  try {
    // Determine content type for the API
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      return {
        success: false,
        error: `Type de fichier non supporté: ${mimeType}`,
      };
    }

    // Build the message content
    const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: getExtractionUserPrompt(mimeType),
      },
    ];

    // Add the document as image (GPT-4o-mini can process PDFs as images)
    if (isImage || isPdf) {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: fileUrl,
          detail: 'high', // Use high detail for better text extraction
        },
      });
    }

    // Call GPT-4o-mini
    const response = await openai.chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [
        {
          role: 'system',
          content: EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: messageContent,
        },
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for consistent extraction
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: "Pas de réponse de l'API",
      };
    }

    // Parse the JSON response
    const extractedData = JSON.parse(content) as Partial<ExtractedDocumentData>;

    // Validate and normalize the detected type
    const detectedType = normalizeDocumentType(extractedData.detected_type);
    const detectedCategory = DOCUMENT_TYPE_CATEGORIES[detectedType] || 'OTHER';

    // Normalize tags
    const tags = normalizeTags(extractedData.tags || [], extractedData);

    return {
      success: true,
      data: {
        ...extractedData,
        detected_type: detectedType,
        detected_category: detectedCategory,
        confidence_score: Math.min(1, Math.max(0, extractedData.confidence_score || 0.5)),
        tags,
      } as ExtractedDocumentData,
    };
  } catch (error) {
    console.error('Document extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur d'extraction inconnue",
    };
  }
}

/**
 * Extract metadata from base64-encoded document
 */
export async function extractFromBase64(
  base64Data: string,
  mimeType: string
): Promise<ExtractionResult> {
  // Create data URL
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return extractDocumentMetadata(dataUrl, mimeType);
}

/**
 * Auto-detect document type from content
 */
export async function detectDocumentType(
  fileUrl: string,
  mimeType: string
): Promise<{ type: DocumentType; confidence: number }> {
  const result = await extractDocumentMetadata(fileUrl, mimeType);

  if (result.success && result.data) {
    return {
      type: result.data.detected_type,
      confidence: result.data.confidence_score,
    };
  }

  return {
    type: DOCUMENT_TYPES.OTHER,
    confidence: 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize document type to valid enum value
 */
function normalizeDocumentType(type?: string): DocumentType {
  if (!type) return DOCUMENT_TYPES.OTHER;

  const upperType = type.toUpperCase().replace(/\s+/g, '_');

  // Check if it's a valid type
  if (Object.values(DOCUMENT_TYPES).includes(upperType as DocumentType)) {
    return upperType as DocumentType;
  }

  // Try to match common variations
  const typeMap: Record<string, DocumentType> = {
    RESUME: DOCUMENT_TYPES.CV,
    CURRICULUM_VITAE: DOCUMENT_TYPES.CV,
    CERTIFICATION: DOCUMENT_TYPES.CERTIFICATE,
    ATTESTATION: DOCUMENT_TYPES.CERTIFICATE,
    DEGREE: DOCUMENT_TYPES.DIPLOMA,
    NATIONAL_ID: DOCUMENT_TYPES.ID_CARD,
    IDENTITY_CARD: DOCUMENT_TYPES.ID_CARD,
    DRIVING_LICENSE: DOCUMENT_TYPES.DRIVER_LICENSE,
    PERMIS: DOCUMENT_TYPES.DRIVER_LICENSE,
    BULLETIN: DOCUMENT_TYPES.TRANSCRIPT,
    RELEVE_DE_NOTES: DOCUMENT_TYPES.TRANSCRIPT,
    LETTRE: DOCUMENT_TYPES.RECOMMENDATION_LETTER,
  };

  return typeMap[upperType] || DOCUMENT_TYPES.OTHER;
}

/**
 * Normalize and enrich tags
 */
function normalizeTags(tags: string[], data: Partial<ExtractedDocumentData>): string[] {
  const normalizedTags = new Set<string>();

  // Add provided tags
  tags.forEach((tag) => {
    if (tag && typeof tag === 'string') {
      normalizedTags.add(tag.toLowerCase().trim());
    }
  });

  // Add skills as tags
  data.skills?.forEach((skill) => {
    if (skill) normalizedTags.add(skill.toLowerCase().trim());
  });

  // Add languages as tags
  data.languages?.forEach((lang) => {
    if (lang) normalizedTags.add(lang.toLowerCase().trim());
  });

  // Add field of study
  if (data.field_of_study) {
    normalizedTags.add(data.field_of_study.toLowerCase().trim());
  }

  // Add institution
  if (data.institution) {
    normalizedTags.add(data.institution.toLowerCase().trim());
  }

  // Add document type as tag
  if (data.detected_type) {
    const typeLabel = DOCUMENT_TYPE_LABELS[data.detected_type];
    if (typeLabel) {
      normalizedTags.add(typeLabel.toLowerCase().split('/')[0].trim());
    }
  }

  return Array.from(normalizedTags).slice(0, 20); // Limit to 20 tags
}

/**
 * Generate a summary from extracted data
 */
export function generateDocumentSummary(data: ExtractedDocumentData): string {
  const parts: string[] = [];

  // Type
  const typeLabel = DOCUMENT_TYPE_LABELS[data.detected_type] || 'Document';
  parts.push(typeLabel);

  // Issuer or institution
  if (data.issuer) {
    parts.push(`de ${data.issuer}`);
  } else if (data.institution) {
    parts.push(`de ${data.institution}`);
  }

  // Field of study for academic documents
  if (data.field_of_study) {
    parts.push(`en ${data.field_of_study}`);
  }

  // Issue date
  if (data.issue_date) {
    const year = data.issue_date.split('-')[0];
    parts.push(`(${year})`);
  }

  return parts.join(' ');
}

export default {
  extractDocumentMetadata,
  extractFromBase64,
  detectDocumentType,
  generateDocumentSummary,
};
