/**
 * Document Extraction Service
 * Uses the configured vision model for structured metadata extraction from documents
 */

import OpenAI from 'openai';
import { MODEL_SEARCH } from '../ai/models';
import { getAIClient } from '../ai/provider';
import { recordUsage } from '../ai/usage.service';
import {
  DocumentType,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_CATEGORIES,
  DocumentCategory,
} from '../../constants/documents';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from '../ai/prompts/extraction.prompt';
import { buildTalentObject, talentObjectToText } from '../ai/talent-object';
import { pool } from '../database';
import { logger } from '../../utils';

export interface ExtractedSkill {
  name: string;
  // Coarse hint only; the authoritative type comes from the resolved catalog competency.
  type?: 'knowledge' | 'hard_skill' | 'soft_skill';
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
}

export interface ExtractionResult {
  success: boolean;
  data?: ExtractedDocumentData;
  error?: string;
}

function cleanupJsonCandidate(value: string): string {
  return value
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function extractJsonObject(value: string): string {
  const firstBrace = value.indexOf('{');
  if (firstBrace === -1) {
    return value;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = firstBrace; i < value.length; i += 1) {
    const char = value[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  return endIndex > firstBrace ? value.slice(firstBrace, endIndex + 1) : value.slice(firstBrace);
}

function parseExtractionPayload(content: string): Partial<ExtractedDocumentData> {
  const candidates = [
    cleanupJsonCandidate(content),
    cleanupJsonCandidate(extractJsonObject(content)),
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<ExtractedDocumentData>;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Invalid JSON extraction payload');
}

// --- Extraction Functions ---

/**
 * Extract metadata from a document using the configured vision model
 */
export async function extractDocumentMetadata(
  fileUrl: string,
  mimeType: string,
  talentId?: string
): Promise<ExtractionResult> {
  try {
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      return {
        success: false,
        error: `Unsupported file type: ${mimeType}`,
      };
    }

    // Build talent context + existing skills for dedup
    let talentContext: string | undefined;
    let existingSkills: string[] | undefined;
    if (talentId) {
      const [talentObj, skillsResult] = await Promise.all([
        buildTalentObject(talentId, true),
        pool.query(
          `SELECT c.name, c.name_fr
           FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
           WHERE ts.talent_id = $1 ORDER BY c.name`,
          [talentId]
        ),
      ]);
      if (talentObj) talentContext = talentObjectToText(talentObj);
      if (skillsResult.rows.length > 0) {
        existingSkills = skillsResult.rows.map((r: any) => r.name_fr || r.name);
      }
    }

    const prompt = buildExtractionPrompt(mimeType, talentContext, existingSkills);
    const aiClient = getAIClient();

    // Build content parts
    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
    ];

    let uploadedFileId: string | undefined;

    if (isImage) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: fileUrl, detail: 'high' },
      });
    } else if (isPdf) {
      // Upload PDF through the compatible Files API, then reference by file_id.
      const base64Match = fileUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) {
        return { success: false, error: 'Format PDF invalide' };
      }
      const pdfBuffer = Buffer.from(base64Match[1], 'base64');
      const file = await aiClient.files.create({
        file: new File([pdfBuffer], 'document.pdf', { type: 'application/pdf' }),
        purpose: 'assistants',
      });
      uploadedFileId = file.id;
      contentParts.push({
        type: 'file',
        file: { file_id: file.id },
      } as any);
    }

    const completion = await aiClient.chat.completions.create({
      model: MODEL_SEARCH,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: contentParts },
      ],
      response_format: { type: 'json_object' },
    });

    void recordUsage({
      feature: 'document_extraction',
      model: MODEL_SEARCH,
      usage: completion.usage,
      scopeTalentId: talentId ?? null,
      billedActionCode: 'TALENT_DOCUMENT_UPLOAD',
    });

    // Cleanup: delete uploaded file from the compatible provider.
    if (uploadedFileId) {
      aiClient.files.delete(uploadedFileId).catch(() => {});
    }

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return {
        success: false,
        error: "No response from the API",
      };
    }

    const extractedData = parseExtractionPayload(content);

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
    logger.error('Document extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown extraction error",
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

// --- Helper Functions ---

function normalizeDocumentType(type?: string): DocumentType {
  if (!type) return DOCUMENT_TYPES.OTHER;

  const upperType = type.toUpperCase().replace(/\s+/g, '_');

  if (Object.values(DOCUMENT_TYPES).includes(upperType as DocumentType)) {
    return upperType as DocumentType;
  }

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

function normalizeTags(tags: string[], data: Partial<ExtractedDocumentData>): string[] {
  const normalizedTags = new Set<string>();

  tags.forEach((tag) => {
    if (tag && typeof tag === 'string') {
      normalizedTags.add(tag.toLowerCase().trim());
    }
  });

  data.skills?.forEach((skill) => {
    if (skill?.name) {
      normalizedTags.add(skill.name.toLowerCase().trim());
    }
  });

  data.languages?.forEach((lang) => {
    if (lang) normalizedTags.add(lang.toLowerCase().trim());
  });

  if (data.field_of_study && typeof data.field_of_study === 'string') {
    normalizedTags.add(data.field_of_study.toLowerCase().trim());
  }

  if (data.institution && typeof data.institution === 'string') {
    normalizedTags.add(data.institution.toLowerCase().trim());
  }

  if (data.detected_type) {
    const typeLabel = DOCUMENT_TYPE_LABELS[data.detected_type];
    if (typeLabel) {
      normalizedTags.add(typeLabel.toLowerCase().split('/')[0].trim());
    }
  }

  return Array.from(normalizedTags).slice(0, 20);
}

/**
 * Generate a summary from extracted data
 */
export function generateDocumentSummary(data: ExtractedDocumentData): string {
  const parts: string[] = [];

  const typeLabel = DOCUMENT_TYPE_LABELS[data.detected_type] || 'Document';
  parts.push(typeLabel);

  if (data.issuer) {
    parts.push(`de ${data.issuer}`);
  } else if (data.institution) {
    parts.push(`de ${data.institution}`);
  }

  if (data.field_of_study) {
    parts.push(`en ${data.field_of_study}`);
  }

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
