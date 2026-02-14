/**
 * Organization Document Constants
 * Types, limits, and configurations for organization documents
 */

import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, isValidMimeType, isValidFileSize, isValidExtension, DOCUMENT_LIMITS } from './documents';

// --- Organization Document Types ---

export const ORG_DOCUMENT_TYPES = {
  POLICY: 'POLICY',
  CONTRACT: 'CONTRACT',
  REPORT: 'REPORT',
  BROCHURE: 'BROCHURE',
  PRESENTATION: 'PRESENTATION',
  CHARTER: 'CHARTER',
  LEGAL: 'LEGAL',
  OTHER: 'OTHER',
} as const;

export type OrgDocumentType = (typeof ORG_DOCUMENT_TYPES)[keyof typeof ORG_DOCUMENT_TYPES];

export const ORG_DOCUMENT_TYPE_LABELS: Record<OrgDocumentType, string> = {
  POLICY: 'Politique interne',
  CONTRACT: 'Contrat',
  REPORT: 'Rapport',
  BROCHURE: 'Brochure',
  PRESENTATION: 'Présentation',
  CHARTER: 'Charte',
  LEGAL: 'Document juridique',
  OTHER: 'Autre document',
};

// --- Organization Document Categories ---

export const ORG_DOCUMENT_CATEGORIES = {
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  COMMERCIAL: 'COMMERCIAL',
  LEGAL: 'LEGAL',
  OTHER: 'OTHER',
} as const;

export type OrgDocumentCategory = (typeof ORG_DOCUMENT_CATEGORIES)[keyof typeof ORG_DOCUMENT_CATEGORIES];

export const ORG_DOCUMENT_CATEGORY_LABELS: Record<OrgDocumentCategory, string> = {
  ADMINISTRATIVE: 'Administratif',
  COMMERCIAL: 'Commercial',
  LEGAL: 'Juridique',
  OTHER: 'Autre',
};

// Map types to categories
export const ORG_DOCUMENT_TYPE_CATEGORIES: Record<OrgDocumentType, OrgDocumentCategory> = {
  POLICY: 'ADMINISTRATIVE',
  CONTRACT: 'LEGAL',
  REPORT: 'ADMINISTRATIVE',
  BROCHURE: 'COMMERCIAL',
  PRESENTATION: 'COMMERCIAL',
  CHARTER: 'ADMINISTRATIVE',
  LEGAL: 'LEGAL',
  OTHER: 'OTHER',
};

// --- Limits ---

export const ORG_DOCUMENT_LIMITS = {
  MAX_DOCUMENTS_PER_ORG: 50,
  MAX_FILES_PER_REQUEST: 5,
  MAX_FILE_SIZE_BYTES: DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB: DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
} as const;

// --- Storage Paths ---

export const ORG_DOCUMENT_STORAGE = {
  BASE_PATH: 'org-documents',
  getPath: (organizationId: string, documentId: string, filename: string) =>
    `org-documents/${organizationId}/${documentId}/${filename}`,
} as const;

// --- Validation Helpers ---

export const isValidOrgDocumentType = (type: string): type is OrgDocumentType => {
  return Object.values(ORG_DOCUMENT_TYPES).includes(type as OrgDocumentType);
};

// Re-export shared validators
export { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, isValidMimeType, isValidFileSize, isValidExtension };
