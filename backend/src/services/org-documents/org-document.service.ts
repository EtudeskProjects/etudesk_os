/**
 * Organization Document Service
 * CRUD operations for organization documents with file upload and AI extraction
 * Similar to talent document.service.ts but scoped to organizations,
 * NO skill extraction, limit 50/org
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { pool } from '../database';
import { uploadFile, deleteFile, getFileBuffer } from '../storage.service';
import { createNotification } from '../notification.service';
import { logger } from '../../utils';
import { MODEL_SEARCH } from '../ai/models';
import { getOpenAIClient } from '../ai/provider';
import { buildOrgExtractionPrompt, ORG_EXTRACTION_SYSTEM_PROMPT } from '../ai/prompts/org-extraction.prompt';
import { DOCUMENT_STATUS, DocumentStatus } from '../../constants/documents';
import {
  OrgDocumentType,
  OrgDocumentCategory,
  ORG_DOCUMENT_TYPES,
  ORG_DOCUMENT_TYPE_CATEGORIES,
  ORG_DOCUMENT_LIMITS,
  isValidMimeType,
  isValidFileSize,
  isValidExtension,
} from '../../constants/org-documents';

// --- Interfaces ---

export interface OrgDocument {
  id: string;
  organization_id: string;
  uploaded_by: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  file_url: string;
  document_type: OrgDocumentType;
  category: OrgDocumentCategory;
  status: DocumentStatus;
  processing_error?: string;
  processed_at?: Date;
  tags: string[];
  title?: string;
  description?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UploadOrgDocumentInput {
  organizationId: string;
  uploadedBy: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  documentType?: OrgDocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateOrgDocumentInput {
  documentType?: OrgDocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface OrgDocumentListOptions {
  organizationId: string;
  type?: OrgDocumentType;
  category?: OrgDocumentCategory;
  status?: DocumentStatus;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ExtractedOrgData {
  detected_type: string;
  detected_category: string;
  confidence_score: number;
  title?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  description?: string;
  tags?: string[];
  summary?: string;
}

// --- Validation ---

export function validateFile(file: UploadOrgDocumentInput['file']): {
  valid: boolean;
  error?: string;
} {
  if (!isValidMimeType(file.mimetype)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé: ${file.mimetype}. Formats acceptés: PDF, JPEG, PNG, WebP, HEIC`,
    };
  }

  if (!isValidFileSize(file.size)) {
    return {
      valid: false,
      error: `Fichier trop volumineux: ${Math.round(file.size / 1024 / 1024)}MB. Maximum: ${ORG_DOCUMENT_LIMITS.MAX_FILE_SIZE_MB}MB`,
    };
  }

  if (!isValidExtension(file.originalname)) {
    return {
      valid: false,
      error: `Extension de fichier non autorisée. Formats acceptés: PDF, JPEG, PNG, WebP, HEIC`,
    };
  }

  return { valid: true };
}

export async function canOrgUploadDocument(organizationId: string): Promise<{
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  error?: string;
}> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM organization_documents
     WHERE organization_id = $1 AND deleted_at IS NULL`,
    [organizationId]
  );

  const currentCount = parseInt(result.rows[0].count, 10);
  const maxCount = ORG_DOCUMENT_LIMITS.MAX_DOCUMENTS_PER_ORG;

  if (currentCount >= maxCount) {
    return {
      canUpload: false,
      currentCount,
      maxCount,
      error: `Limite de documents atteinte: ${currentCount}/${maxCount}. Supprimez un document pour en ajouter un nouveau.`,
    };
  }

  return { canUpload: true, currentCount, maxCount };
}

// --- CRUD ---

export async function uploadOrgDocument(input: UploadOrgDocumentInput): Promise<OrgDocument> {
  const { organizationId, uploadedBy, file, documentType, title, description, isPublic } = input;

  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const limitCheck = await canOrgUploadDocument(organizationId);
  if (!limitCheck.canUpload) {
    throw new Error(limitCheck.error);
  }

  const documentId = uuidv4();
  const ext = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
  const storedFilename = `${documentId}.${ext}`;
  const storagePath = `org-documents/${organizationId}/${storedFilename}`;

  const fileUrl = await uploadFile(file.buffer, storagePath, file.mimetype);

  const initialType = documentType || ORG_DOCUMENT_TYPES.OTHER;
  const initialCategory = ORG_DOCUMENT_TYPE_CATEGORIES[initialType] || 'OTHER';

  const insertResult = await pool.query(
    `INSERT INTO organization_documents (
      id, organization_id, uploaded_by, original_filename, stored_filename,
      mime_type, file_size, file_url, document_type, category,
      status, title, description, is_public
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      documentId,
      organizationId,
      uploadedBy,
      file.originalname,
      storedFilename,
      file.mimetype,
      file.size,
      fileUrl,
      initialType,
      initialCategory,
      DOCUMENT_STATUS.PENDING,
      title,
      description,
      isPublic || false,
    ]
  );

  const document = insertResult.rows[0] as OrgDocument;

  // Trigger async extraction (don't wait)
  processOrgDocumentExtraction(documentId, fileUrl, file.mimetype).catch((err) =>
    logger.error(`Org document extraction failed for ${documentId}:`, err)
  );

  return document;
}

export async function processOrgDocumentExtraction(
  documentId: string,
  fileUrl: string,
  mimeType: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE organization_documents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [DOCUMENT_STATUS.PROCESSING, documentId]
    );

    const fileBuffer = await getFileBuffer(fileUrl);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new Error(`Type de fichier non supporté: ${mimeType}`);
    }

    const prompt = buildOrgExtractionPrompt(mimeType);
    const openai = getOpenAIClient();

    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
    ];

    let uploadedFileId: string | undefined;

    if (isImage) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'high' },
      });
    } else if (isPdf) {
      const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Format PDF invalide');
      }
      const pdfBuffer = Buffer.from(base64Match[1], 'base64');
      const file = await openai.files.create({
        file: new File([pdfBuffer], 'document.pdf', { type: 'application/pdf' }),
        purpose: 'assistants',
      });
      uploadedFileId = file.id;
      contentParts.push({
        type: 'file',
        file: { file_id: file.id },
      } as any);
    }

    const completion = await openai.chat.completions.create({
      model: MODEL_SEARCH,
      messages: [
        { role: 'system', content: ORG_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: contentParts },
      ],
    });

    if (uploadedFileId) {
      openai.files.del(uploadedFileId).catch(() => {});
    }

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Pas de réponse de l'API");
    }

    const cleanedContent = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    const extractedData = JSON.parse(cleanedContent) as ExtractedOrgData;

    // Normalize type
    const validTypes = Object.values(ORG_DOCUMENT_TYPES);
    const detectedType = validTypes.includes(extractedData.detected_type as OrgDocumentType)
      ? extractedData.detected_type
      : 'OTHER';
    const category = ORG_DOCUMENT_TYPE_CATEGORIES[detectedType as OrgDocumentType] || 'OTHER';

    await pool.query(
      `UPDATE organization_documents SET
        status = $1,
        document_type = $2,
        category = $3,
        tags = $4,
        title = $5,
        description = COALESCE(description, $6),
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        DOCUMENT_STATUS.PROCESSED,
        detectedType,
        category,
        extractedData.tags || [],
        extractedData.title || null,
        extractedData.summary || extractedData.description || null,
        documentId,
      ]
    );

    // Notify uploader
    const docRow = await pool.query(
      `SELECT uploaded_by, title, original_filename FROM organization_documents WHERE id = $1`,
      [documentId]
    );
    const uploadedBy = docRow.rows[0]?.uploaded_by;
    if (uploadedBy) {
      await createNotification({
        talentId: uploadedBy,
        type: 'SYSTEM',
        title: 'Document organisation analysé',
        body: `"${extractedData.title || docRow.rows[0]?.original_filename}" a été analysé avec succès`,
        referenceType: 'document',
        referenceId: documentId,
      });
    }
  } catch (error) {
    logger.error(`Org document extraction error for ${documentId}:`, error);
    await pool.query(
      `UPDATE organization_documents SET
        status = $1,
        processing_error = $2,
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [
        DOCUMENT_STATUS.FAILED,
        error instanceof Error ? error.message : 'Unknown error',
        documentId,
      ]
    );

    try {
      const errorDocRow = await pool.query(
        `SELECT uploaded_by FROM organization_documents WHERE id = $1`,
        [documentId]
      );
      const errorTalentId = errorDocRow.rows[0]?.uploaded_by;
      if (errorTalentId) {
        await createNotification({
          talentId: errorTalentId,
          type: 'SYSTEM',
          title: "Échec d'analyse",
          body: "L'analyse du document organisation a échoué. Vous pouvez réessayer.",
          referenceType: 'document',
          referenceId: documentId,
        });
      }
    } catch (notifError) {
      logger.error(`Failed to send error notification for org document ${documentId}:`, notifError);
    }
  }
}

export async function getOrgDocument(documentId: string, organizationId?: string): Promise<OrgDocument | null> {
  let query = `SELECT * FROM organization_documents WHERE id = $1 AND deleted_at IS NULL`;
  const params: string[] = [documentId];

  if (organizationId) {
    query += ` AND organization_id = $2`;
    params.push(organizationId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function listOrgDocuments(options: OrgDocumentListOptions): Promise<{
  documents: OrgDocument[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { organizationId, type, category, status, isPublic, search, limit = 20, offset = 0 } = options;

  const conditions: string[] = ['od.organization_id = $1', 'od.deleted_at IS NULL'];
  const params: (string | boolean | number)[] = [organizationId];
  let paramIndex = 2;

  if (type) {
    conditions.push(`od.document_type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (category) {
    conditions.push(`od.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (status) {
    conditions.push(`od.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (isPublic !== undefined) {
    conditions.push(`od.is_public = $${paramIndex}`);
    params.push(isPublic);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(
      od.original_filename ILIKE $${paramIndex} OR
      od.title ILIKE $${paramIndex} OR
      od.description ILIKE $${paramIndex} OR
      $${paramIndex + 1} = ANY(od.tags)
    )`);
    params.push(`%${search}%`, search.toLowerCase());
    paramIndex += 2;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM organization_documents od WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT od.*,
       t.first_name || ' ' || t.last_name AS uploader_name
     FROM organization_documents od
     LEFT JOIN talents t ON t.id = od.uploaded_by
     WHERE ${whereClause}
     ORDER BY od.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return { documents: result.rows, total, limit, offset };
}

export async function updateOrgDocument(
  documentId: string,
  organizationId: string,
  input: UpdateOrgDocumentInput
): Promise<OrgDocument | null> {
  const updates: string[] = [];
  const params: (string | boolean | string[])[] = [];
  let paramIndex = 1;

  if (input.documentType !== undefined) {
    updates.push(`document_type = $${paramIndex}`);
    params.push(input.documentType);
    paramIndex++;

    const category = ORG_DOCUMENT_TYPE_CATEGORIES[input.documentType] || 'OTHER';
    updates.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex}`);
    params.push(input.title);
    paramIndex++;
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(input.description);
    paramIndex++;
  }

  if (input.isPublic !== undefined) {
    updates.push(`is_public = $${paramIndex}`);
    params.push(input.isPublic);
    paramIndex++;
  }

  if (input.tags !== undefined) {
    updates.push(`tags = $${paramIndex}`);
    params.push(input.tags);
    paramIndex++;
  }

  if (updates.length === 0) {
    return getOrgDocument(documentId, organizationId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(documentId, organizationId);

  const result = await pool.query(
    `UPDATE organization_documents SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1} AND deleted_at IS NULL
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

export async function deleteOrgDocument(documentId: string, organizationId: string): Promise<boolean> {
  const document = await getOrgDocument(documentId, organizationId);
  if (!document) return false;

  const result = await pool.query(
    `UPDATE organization_documents SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [documentId, organizationId]
  );

  if (result.rowCount === 0) return false;

  deleteFile(document.file_url).catch((err) =>
    logger.error(`Failed to delete file for org document ${documentId}:`, err)
  );

  return true;
}

export async function retryOrgExtraction(documentId: string, organizationId: string): Promise<boolean> {
  const document = await getOrgDocument(documentId, organizationId);
  if (!document) return false;

  if (document.status !== DOCUMENT_STATUS.FAILED) {
    throw new Error('Seuls les documents en échec peuvent être réessayés');
  }

  await pool.query(
    `UPDATE organization_documents SET status = $1, processing_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [DOCUMENT_STATUS.PENDING, documentId]
  );

  processOrgDocumentExtraction(documentId, document.file_url, document.mime_type).catch((err) =>
    logger.error(`Retry extraction failed for org document ${documentId}:`, err)
  );

  return true;
}

export async function getOrgDocumentStats(organizationId: string): Promise<{
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalSize: number;
}> {
  const result = await pool.query(
    `SELECT
      COUNT(*) as total,
      SUM(file_size) as total_size,
      document_type,
      category,
      status
     FROM organization_documents
     WHERE organization_id = $1 AND deleted_at IS NULL
     GROUP BY document_type, category, status`,
    [organizationId]
  );

  const stats = {
    total: 0,
    byType: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    totalSize: 0,
  };

  result.rows.forEach((row: any) => {
    const count = parseInt(row.total, 10);
    stats.total += count;
    stats.totalSize += parseInt(row.total_size || '0', 10);
    stats.byType[row.document_type] = (stats.byType[row.document_type] || 0) + count;
    stats.byCategory[row.category] = (stats.byCategory[row.category] || 0) + count;
    stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + count;
  });

  return stats;
}

export default {
  validateFile,
  canOrgUploadDocument,
  uploadOrgDocument,
  processOrgDocumentExtraction,
  getOrgDocument,
  listOrgDocuments,
  updateOrgDocument,
  deleteOrgDocument,
  retryOrgExtraction,
  getOrgDocumentStats,
};
