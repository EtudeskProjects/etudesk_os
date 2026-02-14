/**
 * Document Service
 * CRUD operations for talent documents with file upload and AI extraction
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database';
import { uploadFile, deleteFile, getFileBuffer } from '../storage.service';
import {
  extractDocumentMetadata,
  generateDocumentSummary,
} from './extraction.service';
import { extractAndSaveSkills } from './skill-extraction.service';
import { mergeExtractedSkills } from '../skills/skill-merge.service';
import { create } from '../notification.service';
import { logger } from '../../utils';
import {
  DocumentType,
  DocumentStatus,
  DocumentCategory,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  DOCUMENT_LIMITS,
  DOCUMENT_TYPE_CATEGORIES,
  ALLOWED_MIME_TYPES,
  isValidMimeType,
  isValidFileSize,
  isValidExtension,
} from '../../constants/documents';


export interface TalentDocument {
  id: string;
  talent_id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  file_url: string;
  document_type: DocumentType;
  category: DocumentCategory;
  status: DocumentStatus;
  processing_error?: string;
  processed_at?: Date;
  tags: string[];
  title?: string;
  description?: string;
  is_public: boolean;
  is_verified: boolean;
  verified_at?: Date;
  verified_by?: string;
  verification_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UploadDocumentInput {
  talentId: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  documentType?: DocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateDocumentInput {
  documentType?: DocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface DocumentListOptions {
  talentId: string;
  type?: DocumentType;
  category?: DocumentCategory;
  status?: DocumentStatus;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// --- Validation ---

/**
 * Validate file before upload
 */
export function validateFile(file: UploadDocumentInput['file']): {
  valid: boolean;
  error?: string;
} {
  // Check MIME type
  if (!isValidMimeType(file.mimetype)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé: ${file.mimetype}. Formats acceptés: PDF, JPEG, PNG, WebP, HEIC`,
    };
  }

  // Check file size
  if (!isValidFileSize(file.size)) {
    return {
      valid: false,
      error: `Fichier trop volumineux: ${Math.round(file.size / 1024 / 1024)}MB. Maximum: ${DOCUMENT_LIMITS.MAX_FILE_SIZE_MB}MB`,
    };
  }

  // Check extension
  if (!isValidExtension(file.originalname)) {
    return {
      valid: false,
      error: `Extension de fichier non autorisée. Formats acceptés: PDF, JPEG, PNG, WebP, HEIC`,
    };
  }

  return { valid: true };
}

/**
 * Check if talent can upload more documents
 */
export async function canUploadDocument(talentId: string): Promise<{
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  error?: string;
}> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM talent_documents
     WHERE talent_id = $1 AND deleted_at IS NULL`,
    [talentId]
  );

  const currentCount = parseInt(result.rows[0].count, 10);
  const maxCount = DOCUMENT_LIMITS.MAX_DOCUMENTS_PER_TALENT;

  if (currentCount >= maxCount) {
    return {
      canUpload: false,
      currentCount,
      maxCount,
      error: `Limite de documents atteinte: ${currentCount}/${maxCount}. Supprimez un document pour en ajouter un nouveau.`,
    };
  }

  return {
    canUpload: true,
    currentCount,
    maxCount,
  };
}

// --- Crud Operations ---

/**
 * Upload and create a new document
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<TalentDocument> {
  const { talentId, file, documentType, title, description, isPublic } = input;

  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check document limit
  const limitCheck = await canUploadDocument(talentId);
  if (!limitCheck.canUpload) {
    throw new Error(limitCheck.error);
  }

  // Generate unique filename
  const documentId = uuidv4();
  const ext = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
  const storedFilename = `${documentId}.${ext}`;
  const storagePath = `documents/${talentId}/${storedFilename}`;

  // Upload file to storage
  const fileUrl = await uploadFile(file.buffer, storagePath, file.mimetype);

  // Determine initial type and category
  const initialType = documentType || DOCUMENT_TYPES.OTHER;
  const initialCategory = DOCUMENT_TYPE_CATEGORIES[initialType] || 'OTHER';

  // Create document record
  const insertResult = await pool.query(
    `INSERT INTO talent_documents (
      id, talent_id, original_filename, stored_filename, mime_type,
      file_size, file_url, document_type, category, status,
      title, description, is_public
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      documentId,
      talentId,
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

  const document = insertResult.rows[0] as TalentDocument;

  // Trigger async extraction (don't wait for it)
  processDocumentExtraction(documentId, fileUrl, file.mimetype).catch((err) =>
    logger.error(`Extraction failed for document ${documentId}:`, err)
  );

  return document;
}

/**
 * Process document extraction asynchronously
 */
export async function processDocumentExtraction(
  documentId: string,
  fileUrl: string,
  mimeType: string
): Promise<void> {
  try {
    // Update status to processing
    await pool.query(
      `UPDATE talent_documents SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [DOCUMENT_STATUS.PROCESSING, documentId]
    );

    // Get talent_id early for context injection
    const docRow = await pool.query(`SELECT talent_id FROM talent_documents WHERE id = $1`, [documentId]);
    const talentId = docRow.rows[0]?.talent_id;

    // Read file from disk and convert to base64 data URL
    // (OpenAI API cannot access localhost URLs)
    const fileBuffer = await getFileBuffer(fileUrl);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Extract metadata using GPT-5-mini with talent context
    const extractionResult = await extractDocumentMetadata(dataUrl, mimeType, talentId);

    if (extractionResult.success && extractionResult.data) {
      const data = extractionResult.data;
      const category = DOCUMENT_TYPE_CATEGORIES[data.detected_type] || 'OTHER';

      // Use AI-extracted title, fallback to generated summary
      const generatedTitle = data.title || generateDocumentSummary(data);

      // Extract and save skills if present
      const skillsInDocument = data.skills?.length ?? 0;
      let skillsAdded = 0;
      let nameSkipped = false;

      // Garde-fou : vérifier que le document appartient bien au talent
      if (data.skills && data.skills.length > 0 && talentId) {
        let ownerMatch = true; // par défaut on laisse passer

        if (data.full_name) {
          const talentRow = await pool.query(
            `SELECT first_name, last_name FROM talents WHERE id = $1`,
            [talentId]
          );
          const talent = talentRow.rows[0];
          if (talent) {
            const normalize = (s: string) =>
              s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/);
            const talentTokens = normalize(`${talent.first_name} ${talent.last_name}`);
            const docTokens = normalize(data.full_name);
            ownerMatch = talentTokens.some((t: string) => docTokens.includes(t));
          }
        }

        if (ownerMatch) {
          const skillResult = await extractAndSaveSkills(talentId, documentId, data.skills);
          skillsAdded = skillResult.added;
          await mergeExtractedSkills(talentId);
        } else {
          nameSkipped = true;
        }
      }

      await pool.query(
        `UPDATE talent_documents SET
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
          data.detected_type,
          category,
          data.tags,
          generatedTitle,
          data.summary || data.description || null,
          documentId,
        ]
      );

      // Notify talent
      const docTitle = generatedTitle || 'votre document';
      if (talentId) {
        const notifBody = nameSkipped
          ? `"${docTitle}" a été analysé, mais les compétences n'ont pas été ajoutées car le nom dans le document ne correspond pas à votre profil.`
          : skillsInDocument > 0
            ? `${skillsInDocument} compétence${skillsInDocument > 1 ? 's' : ''} extraite${skillsInDocument > 1 ? 's' : ''} de "${docTitle}"`
            : `"${docTitle}" a été analysé avec succès`;

        await create({
          talentId,
          type: 'SYSTEM',
          title: nameSkipped ? 'Document analysé — compétences ignorées' : 'Document analysé',
          body: notifBody,
          referenceType: 'document',
          referenceId: documentId,
          data: { documentId, skillsExtracted: skillsInDocument, skillsAdded, nameSkipped },
        });
      }
    } else {
      // Mark as failed
      await pool.query(
        `UPDATE talent_documents SET
          status = $1,
          processing_error = $2,
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [DOCUMENT_STATUS.FAILED, extractionResult.error || 'Extraction failed', documentId]
      );

      // Notify talent of failure
      const failedDocRow = await pool.query(`SELECT talent_id, title, original_filename FROM talent_documents WHERE id = $1`, [documentId]);
      const failedTalentId = failedDocRow.rows[0]?.talent_id;
      if (failedTalentId) {
        await create({
          talentId: failedTalentId,
          type: 'SYSTEM',
          title: "Échec d'analyse",
          body: "L'analyse de votre document a échoué. Vous pouvez réessayer.",
          referenceType: 'document',
          referenceId: documentId,
        });
      }
    }
  } catch (error) {
    logger.error(`Document extraction error for ${documentId}:`, error);
    await pool.query(
      `UPDATE talent_documents SET
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

    // Notify talent of error
    try {
      const errorDocRow = await pool.query(`SELECT talent_id FROM talent_documents WHERE id = $1`, [documentId]);
      const errorTalentId = errorDocRow.rows[0]?.talent_id;
      if (errorTalentId) {
        await create({
          talentId: errorTalentId,
          type: 'SYSTEM',
          title: "Échec d'analyse",
          body: "L'analyse de votre document a échoué. Vous pouvez réessayer.",
          referenceType: 'document',
          referenceId: documentId,
        });
      }
    } catch (notifError) {
      logger.error(`Failed to send error notification for document ${documentId}:`, notifError);
    }
  }
}

/**
 * Get a single document by ID
 */
export async function getDocument(documentId: string, talentId?: string): Promise<TalentDocument | null> {
  let query = `SELECT * FROM talent_documents WHERE id = $1 AND deleted_at IS NULL`;
  const params: string[] = [documentId];

  if (talentId) {
    query += ` AND talent_id = $2`;
    params.push(talentId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

/**
 * Get all documents for a talent
 */
export async function listDocuments(options: DocumentListOptions): Promise<{
  documents: TalentDocument[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { talentId, type, category, status, isPublic, search, limit = 20, offset = 0 } = options;

  const conditions: string[] = ['td.talent_id = $1', 'td.deleted_at IS NULL'];
  const params: (string | boolean | number)[] = [talentId];
  let paramIndex = 2;

  if (type) {
    conditions.push(`td.document_type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (category) {
    conditions.push(`td.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (status) {
    conditions.push(`td.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (isPublic !== undefined) {
    conditions.push(`td.is_public = $${paramIndex}`);
    params.push(isPublic);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(
      td.original_filename ILIKE $${paramIndex} OR
      td.title ILIKE $${paramIndex} OR
      td.description ILIKE $${paramIndex} OR
      $${paramIndex + 1} = ANY(td.tags)
    )`);
    params.push(`%${search}%`, search.toLowerCase());
    paramIndex += 2;
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM talent_documents td WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get documents with skills count
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT td.*,
       (SELECT COUNT(*) FROM talent_skills ts WHERE ts.document_id = td.id)::int AS skills_count
     FROM talent_documents td
     WHERE ${whereClause}
     ORDER BY td.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    documents: result.rows,
    total,
    limit,
    offset,
  };
}

/**
 * Update document metadata
 */
export async function updateDocument(
  documentId: string,
  talentId: string,
  input: UpdateDocumentInput
): Promise<TalentDocument | null> {
  const updates: string[] = [];
  const params: (string | boolean | string[])[] = [];
  let paramIndex = 1;

  if (input.documentType !== undefined) {
    updates.push(`document_type = $${paramIndex}`);
    params.push(input.documentType);
    paramIndex++;

    // Also update category
    const category = DOCUMENT_TYPE_CATEGORIES[input.documentType] || 'OTHER';
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
    return getDocument(documentId, talentId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(documentId, talentId);

  const result = await pool.query(
    `UPDATE talent_documents SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND talent_id = $${paramIndex + 1} AND deleted_at IS NULL
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(documentId: string, talentId: string): Promise<boolean> {
  // Get document first to delete file
  const document = await getDocument(documentId, talentId);
  if (!document) {
    return false;
  }

  // Soft delete the record
  const result = await pool.query(
    `UPDATE talent_documents SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
    [documentId, talentId]
  );

  if (result.rowCount === 0) {
    return false;
  }

  // Delete file from storage (async, don't wait)
  deleteFile(document.file_url).catch((err) =>
    logger.error(`Failed to delete file for document ${documentId}:`, err)
  );

  return true;
}

/**
 * Retry document extraction
 */
export async function retryExtraction(documentId: string, talentId: string): Promise<boolean> {
  const document = await getDocument(documentId, talentId);
  if (!document) {
    return false;
  }

  if (document.status !== DOCUMENT_STATUS.FAILED) {
    throw new Error('Seuls les documents en échec peuvent être réessayés');
  }

  // Reset status
  await pool.query(
    `UPDATE talent_documents SET status = $1, processing_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [DOCUMENT_STATUS.PENDING, documentId]
  );

  // Trigger extraction
  processDocumentExtraction(documentId, document.file_url, document.mime_type).catch((err) =>
    logger.error(`Retry extraction failed for document ${documentId}:`, err)
  );

  return true;
}

/**
 * Get document statistics for a talent
 */
export async function getDocumentStats(talentId: string): Promise<{
  total: number;
  byType: Record<DocumentType, number>;
  byCategory: Record<DocumentCategory, number>;
  byStatus: Record<DocumentStatus, number>;
  totalSize: number;
}> {
  const result = await pool.query(
    `SELECT
      COUNT(*) as total,
      SUM(file_size) as total_size,
      document_type,
      category,
      status
     FROM talent_documents
     WHERE talent_id = $1 AND deleted_at IS NULL
     GROUP BY document_type, category, status`,
    [talentId]
  );

  const stats = {
    total: 0,
    byType: {} as Record<DocumentType, number>,
    byCategory: {} as Record<DocumentCategory, number>,
    byStatus: {} as Record<DocumentStatus, number>,
    totalSize: 0,
  };

  interface StatsRow {
    total: string;
    total_size: string;
    document_type: string;
    category: string;
    status: string;
  }

  result.rows.forEach((row: StatsRow) => {
    const count = parseInt(row.total, 10);
    stats.total += count;
    stats.totalSize += parseInt(row.total_size || '0', 10);

    stats.byType[row.document_type as DocumentType] =
      (stats.byType[row.document_type as DocumentType] || 0) + count;

    stats.byCategory[row.category as DocumentCategory] =
      (stats.byCategory[row.category as DocumentCategory] || 0) + count;

    stats.byStatus[row.status as DocumentStatus] =
      (stats.byStatus[row.status as DocumentStatus] || 0) + count;
  });

  return stats;
}

export default {
  validateFile,
  canUploadDocument,
  uploadDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  retryExtraction,
  getDocumentStats,
};
