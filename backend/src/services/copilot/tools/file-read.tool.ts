/**
 * File Read Tool — Direct tool pattern with document access
 * Factory function creates a file_reader tool that reads documents directly
 * from storage (with IDOR protection). No sub-agent — the main agent
 * receives raw content and analyzes it itself.
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { pool } from '../../database';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_EXTRACT_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractDocumentId(rawValue: string): { cleanId: string | null; extracted: boolean } {
  const trimmed = rawValue.trim();
  if (UUID_REGEX.test(trimmed)) {
    return { cleanId: trimmed, extracted: false };
  }

  const firstUuid = trimmed.match(UUID_EXTRACT_REGEX)?.[0] || null;
  if (firstUuid) {
    return { cleanId: firstUuid, extracted: true };
  }

  return { cleanId: null, extracted: false };
}

function salvagePdfText(buffer: Buffer): string | null {
  const latin1 = buffer.toString('latin1');
  const chunks = latin1
    .match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,.;:!?@%()'"\-_/+\n\r]{5,}/g)
    ?.map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((chunk) => {
      const lower = chunk.toLowerCase();
      return (
        chunk.length >= 12 &&
        !lower.startsWith('obj') &&
        !lower.startsWith('endobj') &&
        !lower.includes('/type') &&
        !lower.includes('/filter') &&
        !lower.includes('xref') &&
        !lower.includes('stream') &&
        !lower.includes('endstream')
      );
    }) || [];

  const uniqueChunks = [...new Set(chunks)];
  const text = uniqueChunks.join('\n').trim();
  return text.length >= 80 ? text.slice(0, 12000) : null;
}

async function parsePdfContent(buffer: Buffer, documentId: string): Promise<{ content: string; pageCount?: number; salvaged?: boolean }> {
  try {
    const pdfData = await pdfParse(buffer);
    return {
      content: pdfData.text || '[PDF vide — aucun texte extrait]',
      pageCount: pdfData.numpages,
    };
  } catch (error: any) {
    const message = error?.message || 'Unknown PDF parse error';
    const isRecoverable =
      /bad xref entry|xref|invalid pdf structure|unexpected server response|formaterror/i.test(message);

    if (isRecoverable) {
      const salvaged = salvagePdfText(buffer);
      if (salvaged) {
        logger.warn(`[file_reader] PDF salvage mode for ${documentId}: ${message}`);
        return {
          content: `${salvaged}\n\n[Extraction partielle: PDF structure corrompue, texte récupéré en mode dégradé.]`,
          salvaged: true,
        };
      }
    }

    throw error;
  }
}

/**
 * Shared document reading logic — used by both talent and org tools
 */
async function readDocumentFromDB(
  documentId: string,
  query: string,
  params: any[]
): Promise<{ success: boolean; document?: any; content?: string; error?: string }> {
  const { cleanId } = extractDocumentId(documentId);
  if (!cleanId) {
    return {
      success: false,
      error: `Invalid documentId "${documentId.slice(0, 50)}". Pass exactly ONE UUID from context or attachments.`,
    };
  }

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    return { success: false, error: 'Document not found or access denied.' };
  }

  const doc = result.rows[0];
  const mimeType: string = doc.mime_type;
  const buffer = await getFileBuffer(doc.file_url);

  // Text-based files
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  ) {
    return {
      success: true,
      document: { id: doc.id, title: doc.title || doc.original_filename, type: doc.document_type, mimeType },
      content: buffer.toString('utf-8'),
    };
  }

  // PDFs
  if (mimeType === 'application/pdf') {
    const pdfData = await parsePdfContent(buffer, cleanId);
    return {
      success: true,
      document: {
        id: doc.id,
        title: doc.title || doc.original_filename,
        type: doc.document_type,
        mimeType,
        pageCount: pdfData.pageCount,
        extractionMode: pdfData.salvaged ? 'salvaged' : 'parsed',
      },
      content: pdfData.content,
    };
  }

  // Images — metadata only
  if (mimeType.startsWith('image/')) {
    return {
      success: true,
      document: { id: doc.id, title: doc.title || doc.original_filename, type: doc.document_type, mimeType },
      content: `[Image: ${doc.original_filename}] — Description: ${doc.description || 'No description available.'}`,
    };
  }

  // Other binary formats
  return {
    success: true,
    document: { id: doc.id, title: doc.title || doc.original_filename, type: doc.document_type, mimeType },
    content: `[Unreadable format: ${mimeType}]. Description: ${doc.description || 'No description available.'}`,
  };
}

/**
 * Creates a DIRECT file_reader tool for talents (no sub-agent).
 * The main agent receives raw document content and analyzes it itself.
 * SECURITY: talentId is injected via factory, not from LLM.
 */
export function createFileReaderTool(talentId: string) {
  // Per-session deduplication cache: documentId → result
  const readCache = new Map<string, any>();

  return defineTool({
    name: 'file_reader',
    description:
      'Read a talent document (CV, diploma, certificate, PDF). Pass ONE documentId (UUID). Returns the raw text content of the document. Use documentId from the DOCUMENTS section in context or from [Pièces jointes]. IMPORTANT: Each document only needs to be read ONCE — the content is already in your conversation after the first read.',
    parameters: z.object({
      documentId: z.string().describe('ONE single UUID of the document to read.'),
    }),
    normalize: (raw) => {
      if (typeof raw.documentId === 'string') {
        const extracted = extractDocumentId(raw.documentId);
        if (extracted.cleanId) {
          return { ...raw, documentId: extracted.cleanId };
        }
      }
      return raw;
    },
    execute: async ({ documentId }) => {
      try {
        const { cleanId, extracted } = extractDocumentId(documentId);
        if (!cleanId) {
          logger.warn(`[file_reader] Invalid input without UUID: ${documentId.slice(0, 80)}`);
          return {
            success: false,
            error: 'Missing valid documentId. Re-run sql_query or use the document UUID from context/attachments.',
          };
        }

        // Deduplication: return cached result on repeat calls (same data, not an error)
        if (readCache.has(cleanId)) {
          const hitCount = (readCache.get(cleanId)._hits || 0) + 1;
          readCache.get(cleanId)._hits = hitCount;
          logger.warn(`[file_reader] Cache hit #${hitCount} for ${cleanId} — returning cached content`);
          const cached = readCache.get(cleanId);
          return {
            ...cached,
            _cached: true,
            _note: `Cached result. You already have this document content. Do NOT call file_reader again for "${cached.document?.title}".`,
          };
        }

        if (extracted) {
          logger.warn(`[file_reader] Extracted UUID ${cleanId} from non-canonical input "${documentId.slice(0, 80)}"`);
        }
        logger.info(`[file_reader] Reading document ${cleanId} for talent ${talentId}`);
        const result = await readDocumentFromDB(
          cleanId,
          `SELECT id, title, original_filename, mime_type, file_url, document_type, description
           FROM talent_documents
           WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
          [cleanId, talentId]
        );
        if (!result.success) {
          logger.warn(`[file_reader] Failed: ${result.error}`);
        } else {
          logger.info(`[file_reader] Success: ${result.document?.title} (${result.content?.length || 0} chars)`);
          // Cache successful reads
          readCache.set(cleanId, result);
        }
        return result;
      } catch (error: any) {
        logger.error(`[file_reader] Error reading document ${documentId}: ${error.message}`);
        return { success: false, error: `Error reading document: ${error.message}` };
      }
    },
  });
}

// --- Organization Documents ---

/**
 * Creates a file_reader tool scoped to an organization (DIRECT — no sub-agent).
 * Reads organization documents AND talent CVs/documents if the talent has interacted with the org.
 * SECURITY: orgId is injected via factory, not from LLM parameters.
 */
export function createOrgFileReaderTool(orgId: string) {
  return defineTool({
    name: 'file_reader',
    description:
      'Read and analyze organization documents (job descriptions, contracts, policies, reports) AND talent CVs/documents for candidates who interacted with the org. Pass ONE documentId (UUID) from sql_query results (org_documents, org_talent_profile, or org_applications). Returns raw text content for the main agent to analyze.',
    parameters: z.object({
      documentId: z.string().describe('The UUID of the document to read. Get this from sql_query org_documents, org_talent_profile, or org_applications results.'),
    }),
    normalize: (raw) => {
      if (typeof raw.documentId === 'string') {
        const extracted = extractDocumentId(raw.documentId);
        if (extracted.cleanId) {
          return { ...raw, documentId: extracted.cleanId };
        }
      }
      return raw;
    },
    execute: async ({ documentId }) => {
      try {
        const { cleanId, extracted } = extractDocumentId(documentId);
        if (!cleanId) {
          logger.warn(`[file_reader] Invalid org input without UUID: ${documentId.slice(0, 80)}`);
          return {
            success: false,
            error: 'Missing valid documentId. Use the UUID returned by sql_query.',
          };
        }

        if (extracted) {
          logger.warn(`[file_reader] Extracted org UUID ${cleanId} from non-canonical input "${documentId.slice(0, 80)}"`);
        }

        // 1. Try organization_documents first
        let result = await pool.query(
          `SELECT id, title, original_filename, mime_type, file_url, document_type, description
           FROM organization_documents
           WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
          [cleanId, orgId]
        );

        // 2. Fallback: try talent_documents IF the talent has a verified interaction with this org
        if (result.rows.length === 0) {
          result = await pool.query(
            `SELECT td.id, td.title, td.original_filename, td.mime_type, td.file_url, td.document_type, td.description
             FROM talent_documents td
             WHERE td.id = $1 AND td.deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM opportunity_applications a
                   JOIN opportunities o ON o.id = a.opportunity_id
                 WHERE a.talent_id = td.talent_id AND o.organization_id = $2
                 UNION ALL
                 SELECT 1 FROM community_members cm
                   JOIN communities c ON c.id = cm.community_id
                 WHERE cm.talent_id = td.talent_id AND c.organization_id = $2
                 UNION ALL
                 SELECT 1 FROM organization_members om
                 WHERE om.talent_id = td.talent_id AND om.organization_id = $2
               )`,
            [cleanId, orgId]
          );
        }

        if (result.rows.length === 0) {
          return {
            success: false,
            error: 'Document not found or access denied.',
          };
        }

        const doc = result.rows[0];
        const mimeType: string = doc.mime_type;

        // Read file content from storage
        const buffer = await getFileBuffer(doc.file_url);

        // For text-based files, return content directly
        if (
          mimeType.startsWith('text/') ||
          mimeType === 'application/json' ||
          mimeType === 'application/xml'
        ) {
          return {
            success: true,
            document: {
              id: doc.id,
              title: doc.title || doc.original_filename,
              type: doc.document_type,
              mimeType,
            },
            content: buffer.toString('utf-8'),
          };
        }

        // For PDFs, extract text with pdf-parse
        if (mimeType === 'application/pdf') {
          try {
            const pdfData = await parsePdfContent(buffer, cleanId);
            return {
              success: true,
              document: {
                id: doc.id,
                title: doc.title || doc.original_filename,
                type: doc.document_type,
                mimeType,
                pageCount: pdfData.pageCount,
                extractionMode: pdfData.salvaged ? 'salvaged' : 'parsed',
              },
              content: pdfData.content,
            };
          } catch (pdfErr: any) {
            logger.error(`[read_document] PDF parse error for ${cleanId}: ${pdfErr.message}`);
            return {
              success: false,
              error: `Failed to extract text from PDF: ${pdfErr.message}`,
            };
          }
        }

        // For images, return metadata only
        if (mimeType.startsWith('image/')) {
          return {
            success: true,
            document: {
              id: doc.id,
              title: doc.title || doc.original_filename,
              type: doc.document_type,
              mimeType,
              description: doc.description,
            },
            content: `[Image: ${doc.original_filename}] — Description: ${doc.description || 'No description available.'}`,
          };
        }

        // For other binary formats, return metadata only
        return {
          success: true,
          document: {
            id: doc.id,
            title: doc.title || doc.original_filename,
            type: doc.document_type,
            mimeType,
            description: doc.description,
          },
          content: `[Unreadable format: ${mimeType}]. Description: ${doc.description || 'No description available.'}`,
        };
      } catch (error: any) {
        logger.error(`[read_document] Error reading org document ${documentId}: ${error.message}`);
        return {
          success: false,
          error: `Error reading document: ${error.message}`,
        };
      }
    },
  });
}
