/**
 * Organization Document Service
 * API client for organization document management
 */

import { api } from './api';
import { LIGHT_COLORS } from '../constants/theme';
import { formatNumberNoTrailingZeros } from '../utils/number';

// --- Types ---

export type OrgDocumentType =
  | 'POLICY'
  | 'CONTRACT'
  | 'REPORT'
  | 'BROCHURE'
  | 'PRESENTATION'
  | 'CHARTER'
  | 'LEGAL'
  | 'OTHER';

export type OrgDocumentCategory = 'ADMINISTRATIVE' | 'COMMERCIAL' | 'LEGAL' | 'OTHER';

export type OrgDocumentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'VERIFIED'
  | 'REJECTED';

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
  status: OrgDocumentStatus;
  processing_error?: string;
  processed_at?: string;
  tags: string[];
  title?: string;
  description?: string;
  is_public: boolean;
  uploader_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OrgDocumentListResponse {
  documents: OrgDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrgDocumentStats {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalSize: number;
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  maxFileSizeMB: number;
}

export interface FileInput {
  uri: string;
  name: string;
  type: string;
}

export interface UploadOrgDocumentParams {
  file: FileInput;
  documentType?: OrgDocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateOrgDocumentParams {
  documentType?: OrgDocumentType;
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface ListOrgDocumentsParams {
  type?: OrgDocumentType;
  category?: OrgDocumentCategory;
  status?: OrgDocumentStatus;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// --- Labels (i18n) ---

import { getLabel } from '../utils/labels';

export const getOrgDocumentTypeLabel = (type: OrgDocumentType): string =>
  getLabel('orgDocumentTypes', type);

export const getOrgDocumentCategoryLabel = (cat: OrgDocumentCategory): string =>
  getLabel('orgDocumentCategories', cat);

export const getOrgDocumentStatusLabel = (status: OrgDocumentStatus): string =>
  getLabel('orgDocumentStatuses', status);

export const ORG_UPLOAD_LIMITS = {
  MAX_FILES_PER_REQUEST: 5,
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 20,
  MAX_DOCUMENTS_PER_ORG: 100,
} as const;

// --- API Functions ---

async function getDocumentStats(orgId: string): Promise<OrgDocumentStats> {
  const response = await api.get<OrgDocumentStats>(`/api/organizations/${orgId}/documents/stats`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to get document stats');
  }
  return response.data;
}

async function listDocuments(
  orgId: string,
  params?: ListOrgDocumentsParams
): Promise<OrgDocumentListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.append('type', params.type);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.isPublic !== undefined) queryParams.append('is_public', String(params.isPublic));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const query = queryParams.toString();
  const url = `/api/organizations/${orgId}/documents${query ? `?${query}` : ''}`;

  const response = await api.get<OrgDocumentListResponse>(url);
  if (!response.data) {
    throw new Error(response.error || 'Failed to list documents');
  }
  return response.data;
}

async function getDocument(orgId: string, documentId: string): Promise<OrgDocument> {
  const response = await api.get<OrgDocument>(`/api/organizations/${orgId}/documents/${documentId}`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to get document');
  }
  return response.data;
}

async function uploadDocument(
  orgId: string,
  params: UploadOrgDocumentParams
): Promise<{ message: string; document: OrgDocument }> {
  const formData = new FormData();

  formData.append('file', {
    uri: params.file.uri,
    name: params.file.name,
    type: params.file.type,
  } as unknown as Blob);

  if (params.documentType) formData.append('document_type', params.documentType);
  if (params.title) formData.append('title', params.title);
  if (params.description) formData.append('description', params.description);
  if (params.isPublic !== undefined) formData.append('is_public', String(params.isPublic));

  const response = await api.post<{ message: string; document: OrgDocument }>(
    `/api/organizations/${orgId}/documents`,
    formData
  );

  const result = response as any;
  const doc = result.document || result.data?.document;
  if (!doc) {
    throw new Error(result.error || 'Failed to upload document');
  }
  return { message: result.message || result.data?.message || '', document: doc };
}

async function updateDocument(
  orgId: string,
  documentId: string,
  params: UpdateOrgDocumentParams
): Promise<{ message: string; document: OrgDocument }> {
  const body: Record<string, unknown> = {};
  if (params.documentType !== undefined) body.document_type = params.documentType;
  if (params.title !== undefined) body.title = params.title;
  if (params.description !== undefined) body.description = params.description;
  if (params.isPublic !== undefined) body.is_public = params.isPublic;
  if (params.tags !== undefined) body.tags = params.tags;

  const response = await api.patch<{ message: string; document: OrgDocument }>(
    `/api/organizations/${orgId}/documents/${documentId}`,
    body
  );
  if (!response.data) {
    throw new Error(response.error || 'Failed to update document');
  }
  return response.data;
}

async function deleteDocument(orgId: string, documentId: string): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(
    `/api/organizations/${orgId}/documents/${documentId}`
  );
  return response.data;
}

async function retryExtraction(orgId: string, documentId: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    `/api/organizations/${orgId}/documents/${documentId}/retry`,
    {}
  );
  return response.data;
}

// --- Helpers ---

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumberNoTrailingZeros(bytes / 1024, 1)} KB`;
  return `${formatNumberNoTrailingZeros(bytes / (1024 * 1024), 1)} MB`;
}

export function getOrgDocStatusColor(status: OrgDocumentStatus): string {
  switch (status) {
    case 'PENDING': return LIGHT_COLORS.warning;
    case 'PROCESSING': return LIGHT_COLORS.info;
    case 'PROCESSED': return LIGHT_COLORS.success;
    case 'FAILED': return LIGHT_COLORS.error;
    case 'VERIFIED': return LIGHT_COLORS.successDark;
    case 'REJECTED': return LIGHT_COLORS.errorDark;
    default: return LIGHT_COLORS.gray500;
  }
}

export function getOrgDocCategoryIcon(category: OrgDocumentCategory): string {
  switch (category) {
    case 'ADMINISTRATIVE': return 'file-text';
    case 'COMMERCIAL': return 'bar-chart';
    case 'LEGAL': return 'shield';
    default: return 'file';
  }
}

export const orgDocumentService = {
  getDocumentStats,
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  retryExtraction,
};

export default orgDocumentService;
