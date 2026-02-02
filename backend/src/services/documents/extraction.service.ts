/**
 * Document Extraction Service
 * Uses Agents SDK with GPT-4.1-mini for structured metadata extraction from documents
 */

import { run } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';
import {
  DocumentType,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_CATEGORIES,
  DocumentCategory,
} from '../../constants/documents';
import { createExtractionAgent } from '../ai/agent-factory';
import { buildExtractionPrompt } from '../ai/prompts/extraction.prompt';
import { buildTalentObject, talentObjectToText } from '../ai/talent-object';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ExtractedSkill {
  name: string;
  type: 'KNOWLEDGE' | 'HARD_SKILL' | 'SOFT_SKILL';
  proficiency_hint?: string;
  context?: string;
}

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
  skills?: ExtractedSkill[];
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
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract metadata from a document using GPT-4.1-mini vision via Agents SDK
 */
export async function extractDocumentMetadata(
  fileUrl: string,
  mimeType: string,
  talentId?: string
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

    // Build talent context if available
    let talentContext: string | undefined;
    if (talentId) {
      const talentObj = await buildTalentObject(talentId);
      if (talentObj) talentContext = talentObjectToText(talentObj);
    }

    // Build input with file/image content for the agent
    const contentParts: any[] = [
      {
        type: 'input_text',
        text: buildExtractionPrompt(mimeType, talentContext),
      },
    ];

    if (isPdf) {
      contentParts.push({
        type: 'input_file',
        file: fileUrl,
        filename: 'document.pdf',
      });
    } else {
      contentParts.push({
        type: 'input_image',
        image: fileUrl,
        detail: 'high',
      });
    }

    const input: AgentInputItem[] = [
      { role: 'user', content: contentParts },
    ];

    const agent = createExtractionAgent();
    const result = await run(agent, input);

    const content = result.finalOutput;

    if (!content) {
      return {
        success: false,
        error: "Pas de réponse de l'API",
      };
    }

    // Strip markdown fences if present (LLM sometimes wraps in ```json...```)
    const cleanedContent = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // Parse the JSON response
    const extractedData = JSON.parse(cleanedContent) as Partial<ExtractedDocumentData>;

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
  mimeType: string,
  talentId?: string
): Promise<ExtractionResult> {
  // Create data URL
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return extractDocumentMetadata(dataUrl, mimeType, talentId);
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
    if (skill?.name) {
      normalizedTags.add(skill.name.toLowerCase().trim());
    }
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
