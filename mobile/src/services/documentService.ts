/**
 * Document Service
 * API client for document management
 */

import { api } from './api';
import { LIGHT_COLORS } from '../constants/theme';


export type DocumentType =
  | 'CV'
  | 'CERTIFICATE'
  | 'DIPLOMA'
  | 'LICENSE'
  | 'PORTFOLIO'
  | 'RECOMMENDATION_LETTER'
  | 'TRANSCRIPT'
  | 'PUBLICATION'
  | 'PATENT'
  | 'ID_CARD'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'PROOF_OF_ADDRESS'
  | 'OTHER';

export type DocumentCategory = 'PROFESSIONAL' | 'ACADEMIC' | 'IDENTITY' | 'OTHER';

export type DocumentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'VERIFIED'
  | 'REJECTED';

export interface ExtractedSkill {
  name: string;
  type: 'KNOWLEDGE' | 'HARD_SKILL' | 'SOFT_SKILL';
  proficiency_hint?: string;
  context?: string;
}

export interface ExtractedDocumentData {
  detected_type: DocumentType;
  detected_category: DocumentCategory;
  confidence_score: number;
  title?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  description?: string;
  skills?: ExtractedSkill[];
  skills_count?: number;
  experience_years?: number;
  languages?: string[];
  job_titles?: string[];
  field_of_study?: string;
  institution?: string;
  grade?: string;
  full_name?: string;
  date_of_birth?: string;
  nationality?: string;
  tags: string[];
  summary?: string;
}

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
  processed_at?: string;
  tags: string[];
  title?: string;
  description?: string;
  is_public: boolean;
  is_primary?: boolean;
  is_verified: boolean;
  verified_at?: string;
  skills_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: TalentDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentStats {
  total: number;
  byType: Record<DocumentType, number>;
  byCategory: Record<DocumentCategory, number>;
  byStatus: Record<DocumentStatus, number>;
  totalSize: number;
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  maxFileSizeMB: number;
}

export interface DocumentTypeInfo {
  value: DocumentType;
  label: string;
}

export interface DocumentTypesResponse {
  types: DocumentTypeInfo[];
  maxDocuments: number;
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
}

export interface FileInput {
  uri: string;
  name: string;
  type: string;
}

export interface UploadDocumentParams {
  file: FileInput;
  documentType?: DocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export const UPLOAD_LIMITS = {
  MAX_FILES_PER_REQUEST: 5,
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 20,
  MAX_DOCUMENTS_PER_TALENT: 100,
} as const;

export interface UpdateDocumentParams {
  documentType?: DocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface ListDocumentsParams {
  type?: DocumentType;
  category?: DocumentCategory;
  status?: DocumentStatus;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// --- Document Type Labels French ---

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
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  OTHER: 'Autre document',
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  PROFESSIONAL: 'Professionnel',
  ACADEMIC: 'Académique',
  IDENTITY: 'Identité',
  OTHER: 'Autre',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de traitement',
  PROCESSED: 'Traité',
  FAILED: 'Échec',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
};

// --- Api Functions ---

/**
 * Get document types and limits
 */
async function getDocumentTypes(): Promise<DocumentTypesResponse> {
  const response = await api.get<DocumentTypesResponse>('/api/documents/types');
  if (!response.data) {
    throw new Error(response.error || 'Failed to get document types');
  }
  return response.data;
}

/**
 * Get document statistics
 */
async function getDocumentStats(): Promise<DocumentStats> {
  const response = await api.get<DocumentStats>('/api/documents/stats');
  if (!response.data) {
    throw new Error(response.error || 'Failed to get document stats');
  }
  return response.data;
}

/**
 * List documents
 */
async function listDocuments(params?: ListDocumentsParams): Promise<DocumentListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.type) queryParams.append('type', params.type);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.isPublic !== undefined) queryParams.append('is_public', String(params.isPublic));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const query = queryParams.toString();
  const url = query ? `/api/documents?${query}` : '/api/documents';

  const response = await api.get<DocumentListResponse>(url);
  if (!response.data) {
    throw new Error(response.error || 'Failed to list documents');
  }
  return response.data;
}

/**
 * Get a single document
 */
async function getDocument(documentId: string): Promise<TalentDocument> {
  const response = await api.get<TalentDocument>(`/api/documents/${documentId}`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to get document');
  }
  return response.data;
}

/**
 * Upload a new document
 */
async function uploadDocument(
  params: UploadDocumentParams
): Promise<{ message: string; document: TalentDocument }> {
  const formData = new FormData();

  // Add file
  formData.append('file', {
    uri: params.file.uri,
    name: params.file.name,
    type: params.file.type,
  } as unknown as Blob);

  // Add optional metadata
  if (params.documentType) {
    formData.append('document_type', params.documentType);
  }
  if (params.title) {
    formData.append('title', params.title);
  }
  if (params.description) {
    formData.append('description', params.description);
  }
  if (params.isPublic !== undefined) {
    formData.append('is_public', String(params.isPublic));
  }

  const response = await api.post<{ message: string; document: TalentDocument }>(
    '/api/documents',
    formData
  );

  if (!response.data?.document) {
    throw new Error(response.error || 'Failed to upload document');
  }
  return response.data;
}

/**
 * Upload multiple documents (max 5 per request)
 */
async function uploadMultipleDocuments(
  files: FileInput[],
  options?: { documentType?: DocumentType; isPublic?: boolean }
): Promise<{ message: string; documents: TalentDocument[] }> {
  if (files.length > UPLOAD_LIMITS.MAX_FILES_PER_REQUEST) {
    throw new Error(`Maximum ${UPLOAD_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`);
  }

  const formData = new FormData();

  for (const file of files) {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);
  }

  if (options?.documentType) {
    formData.append('document_type', options.documentType);
  }
  if (options?.isPublic !== undefined) {
    formData.append('is_public', String(options.isPublic));
  }

  const response = await api.post<{ message: string; documents: TalentDocument[] }>(
    '/api/documents',
    formData
  ) as any;

  if (!response.documents && !response.data?.documents) {
    throw new Error(response.error || 'Failed to upload documents');
  }
  return response.data || response;
}

/**
 * Update document metadata
 */
async function updateDocument(
  documentId: string,
  params: UpdateDocumentParams
): Promise<{ message: string; document: TalentDocument }> {
  const body: Record<string, unknown> = {};

  if (params.documentType !== undefined) body.document_type = params.documentType;
  if (params.title !== undefined) body.title = params.title;
  if (params.description !== undefined) body.description = params.description;
  if (params.isPublic !== undefined) body.is_public = params.isPublic;
  if (params.tags !== undefined) body.tags = params.tags;

  const response = await api.patch<{ message: string; document: TalentDocument }>(
    `/api/documents/${documentId}`,
    body
  );

  if (!response.data) {
    throw new Error(response.error || 'Failed to update document');
  }
  return response.data;
}

/**
 * Delete a document
 */
async function deleteDocument(documentId: string): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/api/documents/${documentId}`);
  return response.data;
}

/**
 * Retry document extraction
 */
async function retryExtraction(documentId: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/api/documents/${documentId}/retry`, {});
  return response.data;
}

// --- Helper Functions ---

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Get status color
 */
// Document status colors - Luxe Africain design system
export function getStatusColor(status: DocumentStatus): string {
  switch (status) {
    case 'PENDING':
      return LIGHT_COLORS.warning;        // #A67C52 - Warm amber
    case 'PROCESSING':
      return LIGHT_COLORS.info;           // #6B5E52 - Warm taupe
    case 'PROCESSED':
      return LIGHT_COLORS.success;        // #4A6741 - Forest green
    case 'FAILED':
      return LIGHT_COLORS.error;          // #8B4A3C - Terracotta
    case 'VERIFIED':
      return LIGHT_COLORS.successDark;    // #3A5233 - Dark green
    case 'REJECTED':
      return LIGHT_COLORS.errorDark;      // #6B3A2E - Dark terracotta
    default:
      return LIGHT_COLORS.gray500;        // #918A7E - Neutral gray
  }
}

/**
 * Get category icon name
 */
export function getCategoryIcon(category: DocumentCategory): string {
  switch (category) {
    case 'PROFESSIONAL':
      return 'briefcase';
    case 'ACADEMIC':
      return 'graduation-cap';
    case 'IDENTITY':
      return 'id-card';
    default:
      return 'file';
  }
}

export default {
  getDocumentTypes,
  getDocumentStats,
  listDocuments,
  getDocument,
  uploadDocument,
  uploadMultipleDocuments,
  updateDocument,
  deleteDocument,
  retryExtraction,
  formatFileSize,
  getFileExtension,
  isAllowedFileType,
  getStatusColor,
  getCategoryIcon,
};
