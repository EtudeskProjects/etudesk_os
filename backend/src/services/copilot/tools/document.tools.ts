/**
 * Document Tools for Copilot
 * Tools for reading, analyzing, and generating documents
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../database';
import { getFileBuffer, uploadFile } from '../../storage.service';
import {
  DocumentPreviewOutput,
  DocumentAnalysisOutput,
  DocumentDownloadOutput,
} from '../ontology/outputs';
import { processDocumentExtraction } from '../../documents/document.service';
import { extractAndSaveSkills } from '../../documents/skill-extraction.service';
import { mergeExtractedSkills } from '../../skills/skill-merge.service';

// ═══════════════════════════════════════════════════════════════
// LIST DOCUMENTS
// ═══════════════════════════════════════════════════════════════

export const listDocumentsSchema = z.object({
  type: z
    .enum([
      'CV',
      'CERTIFICATE',
      'DIPLOMA',
      'LICENSE',
      'PORTFOLIO',
      'RECOMMENDATION_LETTER',
      'TRANSCRIPT',
      'PUBLICATION',
      'PATENT',
      'ID_CARD',
      'PASSPORT',
      'DRIVER_LICENSE',
      'PROOF_OF_ADDRESS',
      'OTHER',
    ])
    .optional()
    .describe('Filtrer par type de document'),
  category: z.enum(['PROFESSIONAL', 'ACADEMIC', 'IDENTITY', 'OTHER']).optional(),
  status: z.enum(['PROCESSED', 'VERIFIED']).optional(),
  limit: z.number().min(1).max(20).default(10),
});

export type ListDocumentsParams = z.infer<typeof listDocumentsSchema>;

export async function listDocuments(
  params: ListDocumentsParams,
  context: { talentId: string }
): Promise<{ documents: DocumentPreviewOutput[]; total: number }> {
  const { talentId } = context;
  const { type, category, status, limit } = params;

  let sql = `
    SELECT
      id, original_filename as filename, document_type as type, category,
      status, mime_type, file_url, extracted_data, title,
      created_at
    FROM talent_documents
    WHERE talent_id = $1 AND deleted_at IS NULL
  `;
  const queryParams: (string | number)[] = [talentId];
  let paramIndex = 2;

  if (type) {
    sql += ` AND document_type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (category) {
    sql += ` AND category = $${paramIndex}`;
    queryParams.push(category);
    paramIndex++;
  }

  if (status) {
    sql += ` AND status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  queryParams.push(limit);

  const result = await pool.query(sql, queryParams);

  const documents: DocumentPreviewOutput[] = result.rows.map((d) => ({
    type: 'document_preview',
    documentId: d.id,
    filename: d.filename,
    mimeType: d.mime_type,
    previewUrl: d.file_url,
    extractedData: d.extracted_data,
  }));

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL`,
    [talentId]
  );

  return {
    documents,
    total: parseInt(countResult.rows[0].count) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// READ DOCUMENT
// ═══════════════════════════════════════════════════════════════

export const readDocumentSchema = z.object({
  documentId: z.string().uuid().describe('ID du document à lire'),
});

export type ReadDocumentParams = z.infer<typeof readDocumentSchema>;

export async function readDocument(
  params: ReadDocumentParams,
  context: { talentId: string }
): Promise<DocumentPreviewOutput> {
  const { talentId } = context;
  const { documentId } = params;

  const result = await pool.query(
    `
    SELECT
      id, original_filename as filename, document_type as type, category,
      status, mime_type, file_url, extracted_data, title, description
    FROM talent_documents
    WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
  `,
    [documentId, talentId]
  );

  if (result.rows.length === 0) {
    throw new Error('Document non trouvé');
  }

  const doc = result.rows[0];

  return {
    type: 'document_preview',
    documentId: doc.id,
    filename: doc.filename,
    mimeType: doc.mime_type,
    previewUrl: doc.file_url,
    extractedData: {
      ...doc.extracted_data,
      title: doc.title,
      description: doc.description,
      documentType: doc.type,
      category: doc.category,
      status: doc.status,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ANALYZE DOCUMENT
// ═══════════════════════════════════════════════════════════════

export const analyzeDocumentSchema = z.object({
  documentId: z.string().uuid().describe('ID du document à analyser'),
  analysisType: z
    .enum(['summary', 'skills', 'experience', 'recommendations'])
    .default('summary')
    .describe("Type d'analyse souhaité"),
});

export type AnalyzeDocumentParams = z.infer<typeof analyzeDocumentSchema>;

export async function analyzeDocument(
  params: AnalyzeDocumentParams,
  context: { talentId: string }
): Promise<DocumentAnalysisOutput> {
  const { talentId } = context;
  const { documentId, analysisType } = params;

  const result = await pool.query(
    `
    SELECT
      id, original_filename as filename, document_type as type,
      extracted_data, status
    FROM talent_documents
    WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
  `,
    [documentId, talentId]
  );

  if (result.rows.length === 0) {
    throw new Error('Document non trouvé');
  }

  const doc = result.rows[0];
  const extracted = doc.extracted_data || {};

  // Build analysis based on extracted data and type
  const analysis: DocumentAnalysisOutput['analysis'] = {
    summary: extracted.summary || 'Aucun résumé disponible',
    keyPoints: [],
  };

  if (extracted.skills && Array.isArray(extracted.skills)) {
    analysis.skills = extracted.skills;
    analysis.keyPoints.push(`${extracted.skills.length} compétences détectées`);
  }

  if (extracted.experience && Array.isArray(extracted.experience)) {
    analysis.experience = extracted.experience;
    analysis.keyPoints.push(`${extracted.experience.length} expériences professionnelles`);
  }

  if (doc.type === 'CV') {
    analysis.keyPoints.push('Document de type CV');
    if (extracted.languages) {
      analysis.keyPoints.push(`Langues: ${extracted.languages.join(', ')}`);
    }
  } else if (doc.type === 'DIPLOMA' || doc.type === 'CERTIFICATE') {
    analysis.keyPoints.push(`Document académique: ${doc.type}`);
    if (extracted.institution) {
      analysis.keyPoints.push(`Institution: ${extracted.institution}`);
    }
    if (extracted.field_of_study) {
      analysis.keyPoints.push(`Domaine: ${extracted.field_of_study}`);
    }
  }

  // Add recommendations based on analysis type
  if (analysisType === 'recommendations') {
    analysis.recommendations = [];
    if (!extracted.skills || extracted.skills.length < 5) {
      analysis.recommendations.push("Enrichir la section compétences");
    }
    if (!extracted.summary) {
      analysis.recommendations.push("Ajouter un résumé professionnel");
    }
  }

  return {
    type: 'document_analysis',
    documentId: doc.id,
    filename: doc.filename,
    analysis,
  };
}

// ═══════════════════════════════════════════════════════════════
// GENERATE DOCUMENT
// ═══════════════════════════════════════════════════════════════

export const generatePDFSchema = z.object({
  documentType: z.enum(['cv', 'cover_letter', 'report']).describe('Type de document à générer'),
  template: z.enum(['modern', 'classic', 'minimal']).default('modern'),
  language: z.enum(['fr', 'en']).default('fr'),
  customizations: z
    .object({
      title: z.string().optional(),
      targetJob: z.string().optional(),
      targetCompany: z.string().optional(),
      includePhoto: z.boolean().optional(),
      colorScheme: z.string().optional(),
    })
    .optional(),
});

export type GeneratePDFParams = z.infer<typeof generatePDFSchema>;

export async function generatePDF(
  params: GeneratePDFParams,
  context: { talentId: string }
): Promise<DocumentDownloadOutput> {
  const { talentId } = context;
  const { documentType, template, language, customizations } = params;

  // Get talent profile for content
  const profileResult = await pool.query(
    `
    SELECT
      t.display_name, t.first_name, t.last_name, t.email, t.phone,
      t.bio, t.avatar_url, t.city, t.country
    FROM talents t
    WHERE t.id = $1
  `,
    [talentId]
  );

  if (profileResult.rows.length === 0) {
    throw new Error('Profil non trouvé');
  }

  const profile = profileResult.rows[0];

  // Get skills
  const skillsResult = await pool.query(
    `
    SELECT s.canonical_name as name, ts.proficiency_level
    FROM talent_skills ts
    JOIN skills s ON ts.skill_id = s.id
    WHERE ts.talent_id = $1
    ORDER BY ts.endorsed_count DESC
    LIMIT 15
  `,
    [talentId]
  );

  // Get experiences
  const experiencesResult = await pool.query(
    `
    SELECT
      e.job_title, e.started_at, e.ended_at, e.is_current, e.description,
      COALESCE(o.name, e.organization_name) as company_name
    FROM talent_experiences e
    LEFT JOIN organizations o ON e.organization_id = o.id
    WHERE e.talent_id = $1
    ORDER BY e.is_current DESC, e.started_at DESC
    LIMIT 10
  `,
    [talentId]
  );

  // Generate filename
  const timestamp = Date.now();
  const filename =
    documentType === 'cv'
      ? `CV_${profile.display_name?.replace(/\s+/g, '_')}_${timestamp}.pdf`
      : documentType === 'cover_letter'
        ? `Lettre_${customizations?.targetCompany?.replace(/\s+/g, '_') || 'motivation'}_${timestamp}.pdf`
        : `Rapport_${timestamp}.pdf`;

  // In a real implementation, this would generate the PDF
  // For now, we'll create a placeholder response

  // Store the generated document reference
  const storagePath = `generated/${talentId}/${filename}`;

  // Generate document content (placeholder)
  const pdfContent = Buffer.from(`PDF Content for ${documentType}`);

  // Upload to storage
  const downloadUrl = await uploadFile(pdfContent, storagePath, 'application/pdf');

  // Calculate expiry (24 hours)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    type: 'document_download',
    filename,
    format: 'pdf',
    downloadUrl,
    sizeBytes: pdfContent.length,
    expiresAt: expiresAt.toISOString(),
  };
}

export const generateCSVSchema = z.object({
  dataType: z.enum(['applications', 'skills', 'experiences', 'bookmarks']).describe('Type de données à exporter'),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

export type GenerateCSVParams = z.infer<typeof generateCSVSchema>;

export async function generateCSV(
  params: GenerateCSVParams,
  context: { talentId: string }
): Promise<DocumentDownloadOutput> {
  const { talentId } = context;
  const { dataType, dateRange } = params;

  let csvContent = '';
  const timestamp = Date.now();

  if (dataType === 'applications') {
    const result = await pool.query(
      `
      SELECT
        o.title as opportunity, org.name as organization,
        a.status, a.created_at as applied_at, a.updated_at as last_update
      FROM applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE a.talent_id = $1
      ORDER BY a.created_at DESC
    `,
      [talentId]
    );

    csvContent = 'Opportunité,Organisation,Statut,Date candidature,Dernière mise à jour\n';
    for (const row of result.rows) {
      csvContent += `"${row.opportunity}","${row.organization || ''}","${row.status}","${row.applied_at?.toISOString() || ''}","${row.last_update?.toISOString() || ''}"\n`;
    }
  } else if (dataType === 'skills') {
    const result = await pool.query(
      `
      SELECT s.canonical_name as skill, s.type, s.domain, ts.proficiency_level, ts.years_of_experience
      FROM talent_skills ts
      JOIN skills s ON ts.skill_id = s.id
      WHERE ts.talent_id = $1
      ORDER BY ts.endorsed_count DESC
    `,
      [talentId]
    );

    csvContent = 'Compétence,Type,Domaine,Niveau,Années expérience\n';
    for (const row of result.rows) {
      csvContent += `"${row.skill}","${row.type || ''}","${row.domain || ''}","${row.proficiency_level || ''}","${row.years_of_experience || ''}"\n`;
    }
  } else if (dataType === 'experiences') {
    const result = await pool.query(
      `
      SELECT
        e.job_title, COALESCE(o.name, e.organization_name) as company,
        e.work_type, e.started_at, e.ended_at, e.is_current, e.city, e.country
      FROM talent_experiences e
      LEFT JOIN organizations o ON e.organization_id = o.id
      WHERE e.talent_id = $1
      ORDER BY e.started_at DESC
    `,
      [talentId]
    );

    csvContent = 'Poste,Entreprise,Type,Début,Fin,En cours,Ville,Pays\n';
    for (const row of result.rows) {
      csvContent += `"${row.job_title}","${row.company || ''}","${row.work_type || ''}","${row.started_at?.toISOString().split('T')[0] || ''}","${row.ended_at?.toISOString().split('T')[0] || ''}","${row.is_current ? 'Oui' : 'Non'}","${row.city || ''}","${row.country || ''}"\n`;
    }
  }

  const filename = `export_${dataType}_${timestamp}.csv`;
  const storagePath = `exports/${talentId}/${filename}`;

  // Upload to storage
  const downloadUrl = await uploadFile(Buffer.from(csvContent, 'utf-8'), storagePath, 'text/csv');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    type: 'document_download',
    filename,
    format: 'csv',
    downloadUrl,
    sizeBytes: Buffer.byteLength(csvContent),
    expiresAt: expiresAt.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT SKILLS FROM DOCUMENT
// ═══════════════════════════════════════════════════════════════

export const extractSkillsFromDocumentSchema = z.object({
  documentId: z.string().uuid().describe('ID du document à analyser pour extraire les compétences'),
});

export type ExtractSkillsFromDocumentParams = z.infer<typeof extractSkillsFromDocumentSchema>;

export async function extractSkillsFromDocument(
  params: ExtractSkillsFromDocumentParams,
  context: { talentId: string }
): Promise<{ type: string; documentId: string; summary: string; added: number; skipped: number }> {
  const { talentId } = context;
  const { documentId } = params;

  // Get document
  const result = await pool.query(
    `SELECT id, file_url, mime_type, extracted_data, status
     FROM talent_documents
     WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
    [documentId, talentId]
  );

  if (result.rows.length === 0) {
    throw new Error('Document non trouvé');
  }

  const doc = result.rows[0];

  // Re-trigger extraction if not processed yet
  if (doc.status !== 'PROCESSED' || !doc.extracted_data) {
    await processDocumentExtraction(documentId, doc.file_url, doc.mime_type);
    // Re-fetch
    const updated = await pool.query(`SELECT extracted_data FROM talent_documents WHERE id = $1`, [documentId]);
    doc.extracted_data = updated.rows[0]?.extracted_data;
  }

  const skills = doc.extracted_data?.skills || [];
  if (skills.length === 0) {
    return { type: 'skill_extraction', documentId, summary: 'Aucune compétence détectée dans ce document.', added: 0, skipped: 0 };
  }

  const saveResult = await extractAndSaveSkills(talentId, documentId, skills);
  await mergeExtractedSkills(talentId);

  return {
    type: 'skill_extraction',
    documentId,
    summary: `${saveResult.added} compétence(s) ajoutée(s), ${saveResult.skipped} ignorée(s).`,
    added: saveResult.added,
    skipped: saveResult.skipped,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const documentToolDefinitions = {
  list_documents: {
    name: 'list_documents',
    description:
      "Liste les documents uploadés par l'utilisateur. Peut filtrer par type, catégorie ou statut.",
    parameters: listDocumentsSchema,
    execute: listDocuments,
  },
  read_document: {
    name: 'read_document',
    description:
      "Lit et retourne les informations extraites d'un document spécifique de l'utilisateur.",
    parameters: readDocumentSchema,
    execute: readDocument,
  },
  analyze_document: {
    name: 'analyze_document',
    description:
      "Analyse un document et fournit un résumé, les compétences détectées, ou des recommandations.",
    parameters: analyzeDocumentSchema,
    execute: analyzeDocument,
  },
  generate_pdf: {
    name: 'generate_pdf',
    description:
      "Génère un document PDF (CV, lettre de motivation, rapport) personnalisé avec le profil de l'utilisateur.",
    parameters: generatePDFSchema,
    execute: generatePDF,
  },
  extract_skills_from_document: {
    name: 'extract_skills_from_document',
    description:
      "Extrait les compétences d'un document et les ajoute au profil du talent. Déclenche extraction + sauvegarde + fusion.",
    parameters: extractSkillsFromDocumentSchema,
    execute: extractSkillsFromDocument,
  },
  generate_csv: {
    name: 'generate_csv',
    description:
      "Exporte les données de l'utilisateur (candidatures, compétences, expériences) en format CSV.",
    parameters: generateCSVSchema,
    execute: generateCSV,
  },
};
