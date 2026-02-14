/**
 * File Read Tool — Direct tool pattern with document access
 * Factory function creates a file_reader tool that reads documents directly
 * from storage (with IDOR protection). No sub-agent — the main agent
 * receives raw content and analyzes it itself.
 */

import { Agent, tool } from '@openai/agents';
import { MODEL_FAST } from '../../ai/models';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { pool } from '../../database';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

/**
 * Shared document reading logic — used by both talent and org tools
 */
async function readDocumentFromDB(
  documentId: string,
  query: string,
  params: any[]
): Promise<{ success: boolean; document?: any; content?: string; error?: string }> {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleanId = documentId.trim();
  if (!uuidRegex.test(cleanId)) {
    return {
      success: false,
      error: `Invalid documentId "${documentId.slice(0, 50)}". Pass exactly ONE UUID (e.g. "d6f62a32-db50-43bf-985f-e4a5708a2124"). Do NOT pass multiple IDs separated by commas.`,
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
    const pdfData = await pdfParse(buffer);
    return {
      success: true,
      document: { id: doc.id, title: doc.title || doc.original_filename, type: doc.document_type, mimeType, pageCount: pdfData.numpages },
      content: pdfData.text || '[PDF vide — aucun texte extrait]',
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
  return tool({
    name: 'file_reader',
    description:
      'Read a talent document (CV, diploma, certificate, PDF). Pass ONE documentId (UUID). Returns the raw text content of the document. Use documentId from the DOCUMENTS section in context or from [Pièces jointes].',
    parameters: z.object({
      documentId: z.string().describe('ONE single UUID of the document to read.'),
    }),
    execute: async ({ documentId }) => {
      try {
        logger.info(`[file_reader] Reading document ${documentId} for talent ${talentId}`);
        const result = await readDocumentFromDB(
          documentId,
          `SELECT id, title, original_filename, mime_type, file_url, document_type, description
           FROM talent_documents
           WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
          [documentId.trim(), talentId]
        );
        if (!result.success) {
          logger.warn(`[file_reader] Failed: ${result.error}`);
        } else {
          logger.info(`[file_reader] Success: ${result.document?.title} (${result.content?.length || 0} chars)`);
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
 * Creates a read_document tool scoped to an organization
 * SECURITY: orgId is injected, never from LLM parameters
 */
function createOrgReadDocumentTool(orgId: string) {
  return tool({
    name: 'read_document',
    description:
      'Read the content of a document belonging to the organization OR a talent CV/document if the talent has interacted with the org (applied, joined community, etc.). Use documentId from sql_query results (org_documents or org_talent_profile intent).',
    parameters: z.object({
      documentId: z.string().describe('The UUID of the document to read. Get this from sql_query org_documents, org_talent_profile, or org_applications results.'),
    }),
    execute: async ({ documentId }) => {
      try {
        // 1. Try organization_documents first
        let result = await pool.query(
          `SELECT id, title, original_filename, mime_type, file_url, document_type, description
           FROM organization_documents
           WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
          [documentId, orgId]
        );

        // 2. Fallback: try talent_documents IF the talent has a verified interaction with this org
        if (result.rows.length === 0) {
          result = await pool.query(
            `SELECT td.id, td.title, td.original_filename, td.mime_type, td.file_url, td.document_type, td.description
             FROM talent_documents td
             WHERE td.id = $1 AND td.deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM applications a
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
            [documentId, orgId]
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
            const pdfData = await pdfParse(buffer);
            return {
              success: true,
              document: {
                id: doc.id,
                title: doc.title || doc.original_filename,
                type: doc.document_type,
                mimeType,
                pageCount: pdfData.numpages,
              },
              content: pdfData.text || '[PDF vide — aucun texte extrait]',
            };
          } catch (pdfErr: any) {
            logger.error(`[read_document] PDF parse error for ${documentId}: ${pdfErr.message}`);
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

/**
 * Creates an OrgFileReaderAgent scoped to a specific organization
 * SECURITY: orgId is injected via factory, not from LLM
 */
function createOrgFileReaderAgent(orgId: string): Agent {
  return new Agent({
    name: 'OrgFileReaderAgent',
    model: MODEL_FAST,
    instructions: `# Role and Objective

You are a document analysis specialist. Use the read_document tool to read organization documents AND talent documents (CVs, diplomas) when the talent has interacted with the organization. Provide structured analysis in French.

# Instructions

- The documentId is provided in the message. Use it directly with read_document — do NOT ask the user for it.
- If multiple documentIds are provided, read each one sequentially.
- Analyze the content and return a structured summary in French.
- Be factual and concise in your analysis.

## Document-Specific Analysis

- **CVs/Resumes (talent documents)**: Extract full profile — name, current position, skills (technical + soft), work experience (company, role, dates), education, certifications, languages. Focus on skills match and experience relevance.
- **Fiches de poste**: Extract role title, responsibilities, required qualifications, contract type, compensation if mentioned.
- **Contracts/Legal**: Identify parties, key terms, dates, obligations, and notable clauses.
- **Reports**: Summarize key findings, metrics, conclusions, and recommendations.
- **Policies/Charters**: Extract rules, scope of application, and key provisions.
- **Presentations/Brochures**: Summarize main message, target audience, and key data points.

# Output Format

Return analysis in French with clear sections using markdown headings. For CVs, use this structure:
- **Identité**: name, location, contact
- **Compétences**: list of skills by category
- **Expériences**: chronological list
- **Formation**: education history
- **Certifications**: if any`,
    tools: [createOrgReadDocumentTool(orgId)],
  });
}

/**
 * Creates an org file_reader tool using asTool() pattern
 * SECURITY: orgId is injected via factory, not from LLM
 */
export function createOrgFileReaderTool(orgId: string) {
  return createOrgFileReaderAgent(orgId).asTool({
    toolName: 'file_reader',
    toolDescription:
      'Read and analyze organization documents (job descriptions, contracts, policies, reports) AND talent CVs/documents for candidates who interacted with the org. Pass the documentId(s) from sql_query results (org_documents, org_talent_profile, or org_applications) as input message.',
    runOptions: { maxTurns: 5 },
  });
}
