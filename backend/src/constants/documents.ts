/**
 * Document Management Constants
 * Types, limits, and configurations for talent documents
 */

// --- Document Types ---

export const DOCUMENT_TYPES = {
  // Professional documents
  CV: 'CV',
  CERTIFICATE: 'CERTIFICATE',
  DIPLOMA: 'DIPLOMA',
  LICENSE: 'LICENSE',
  PORTFOLIO: 'PORTFOLIO',
  RECOMMENDATION_LETTER: 'RECOMMENDATION_LETTER',
  TRANSCRIPT: 'TRANSCRIPT', // Bulletin scolaire
  PUBLICATION: 'PUBLICATION',
  PATENT: 'PATENT',
  // Identity/KYC documents
  ID_CARD: 'ID_CARD',
  PASSPORT: 'PASSPORT',
  DRIVER_LICENSE: 'DRIVER_LICENSE',
  STUDENT_CARD: 'STUDENT_CARD',
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS',
  // Other
  OTHER: 'OTHER',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

// Document type labels in French
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CV: 'CV / Curriculum Vitae',
  CERTIFICATE: 'Certificat',
  DIPLOMA: 'Diplôme',
  LICENSE: 'Licence professionnelle',
  PORTFOLIO: 'Portfolio',
  RECOMMENDATION_LETTER: 'Lettre de recommandation',
  TRANSCRIPT: 'Bulletin scolaire / Relevé de notes',
  PUBLICATION: 'Publication',
  PATENT: 'Brevet',
  ID_CARD: "Carte d'identité",
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  STUDENT_CARD: 'Carte scolaire / étudiante',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  OTHER: 'Autre document',
};

// Document categories for grouping
export const DOCUMENT_CATEGORIES = {
  PROFESSIONAL: 'PROFESSIONAL',
  ACADEMIC: 'ACADEMIC',
  IDENTITY: 'IDENTITY',
  OTHER: 'OTHER',
} as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[keyof typeof DOCUMENT_CATEGORIES];

// Map types to categories
export const DOCUMENT_TYPE_CATEGORIES: Record<DocumentType, DocumentCategory> = {
  CV: 'PROFESSIONAL',
  CERTIFICATE: 'PROFESSIONAL',
  LICENSE: 'PROFESSIONAL',
  PORTFOLIO: 'PROFESSIONAL',
  RECOMMENDATION_LETTER: 'PROFESSIONAL',
  PUBLICATION: 'PROFESSIONAL',
  PATENT: 'PROFESSIONAL',
  DIPLOMA: 'ACADEMIC',
  TRANSCRIPT: 'ACADEMIC',
  ID_CARD: 'IDENTITY',
  PASSPORT: 'IDENTITY',
  DRIVER_LICENSE: 'IDENTITY',
  STUDENT_CARD: 'IDENTITY',
  PROOF_OF_ADDRESS: 'IDENTITY',
  OTHER: 'OTHER',
};

// --- File Limits And Constraints ---

export const DOCUMENT_LIMITS = {
  // Maximum number of documents per talent
  MAX_DOCUMENTS_PER_TALENT: 100,
  // Maximum number of files per upload request
  MAX_FILES_PER_REQUEST: 5,
  // Maximum file size in bytes (20 MB)
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024,
  // Maximum file size in MB (for display)
  MAX_FILE_SIZE_MB: 20,
} as const;

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] as const;

// --- Document Status ---

export const DOCUMENT_STATUS = {
  PENDING: 'PENDING', // Uploaded, awaiting processing
  PROCESSING: 'PROCESSING', // Being analyzed by AI
  PROCESSED: 'PROCESSED', // Successfully processed
  FAILED: 'FAILED', // Processing failed
  VERIFIED: 'VERIFIED', // Manually verified (KYC)
  REJECTED: 'REJECTED', // Rejected (invalid/fraudulent)
} as const;

export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

// --- Extraction Fields ---

// Fields that can be extracted from documents
export const EXTRACTABLE_FIELDS = {
  // Common fields
  TITLE: 'title',
  ISSUER: 'issuer',
  ISSUE_DATE: 'issue_date',
  EXPIRY_DATE: 'expiry_date',
  DESCRIPTION: 'description',
  // CV specific
  SKILLS: 'skills',
  EXPERIENCE_YEARS: 'experience_years',
  LANGUAGES: 'languages',
  EDUCATION: 'education',
  // Certificate/Diploma specific
  FIELD_OF_STUDY: 'field_of_study',
  GRADE: 'grade',
  HONORS: 'honors',
  // Identity specific
  FULL_NAME: 'full_name',
  DATE_OF_BIRTH: 'date_of_birth',
  NATIONALITY: 'nationality',
  DOCUMENT_NUMBER: 'document_number',
} as const;

// --- Storage Paths ---

export const DOCUMENT_STORAGE = {
  // Base path for document storage
  BASE_PATH: 'documents',
  // Path pattern: documents/{talentId}/{documentId}/{filename}
  getPath: (talentId: string, documentId: string, filename: string) =>
    `documents/${talentId}/${documentId}/${filename}`,
} as const;

// --- Validation Helpers ---

export const isValidDocumentType = (type: string): type is DocumentType => {
  return Object.values(DOCUMENT_TYPES).includes(type as DocumentType);
};

export const isValidMimeType = (mimeType: string): mimeType is AllowedMimeType => {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
};

export const isValidFileSize = (sizeInBytes: number): boolean => {
  return sizeInBytes <= DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES;
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
};

export const isValidExtension = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]);
};
