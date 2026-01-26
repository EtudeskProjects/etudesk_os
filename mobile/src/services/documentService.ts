/**
 * Document Service
 * Unified document management (Identity, Professional, Academic)
 */

import { api, ApiResponse } from './api';
import {
  Document,
  DocumentRequirement,
  DocumentType,
  DocumentCategory,
  DocumentStatus,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface DocumentFilters {
  category?: DocumentCategory;
  type?: DocumentType;
  status?: DocumentStatus;
}

export interface CreateDocumentData {
  type: DocumentType;
  title?: string;
  file_url?: string;
  front_image_url?: string;
  back_image_url?: string;
  issued_by?: string;
  issued_at?: string;
  expires_at?: string;
  credential_id?: string;
  verification_url?: string;
  visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  is_primary?: boolean;
}

export interface SubmitIdentityData {
  document_type: 'ID_CARD' | 'PASSPORT' | 'DRIVER_LICENSE';
  front_image_url: string;
  back_image_url?: string;
}

export interface UpdateDocumentData {
  title?: string;
  visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  is_primary?: boolean;
  issued_by?: string;
  issued_at?: string;
  expires_at?: string;
  credential_id?: string;
  verification_url?: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  public_url: string;
  file_id: string;
  expires_in: number;
}

export interface IdentityStatus {
  id?: string;
  document_type?: string;
  status: 'NONE' | DocumentStatus;
  rejection_reason?: string;
  submitted_at?: string;
  verified_at?: string;
  has_submission: boolean;
}

export interface RequirementsCheckResult {
  feature: string;
  requirements: DocumentRequirement[];
  all_satisfied: boolean;
  can_proceed: boolean;
  missing_required: DocumentRequirement[];
}

// ═══════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

class DocumentService {
  // ─────────────────────────────────────────────────────────────
  // DOCUMENTS CRUD
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all documents for current talent
   */
  async getMyDocuments(filters?: DocumentFilters): Promise<ApiResponse<Document[]>> {
    return api.get<Document[]>('/api/documents', filters);
  }

  /**
   * Get a specific document
   */
  async getDocument(id: string): Promise<ApiResponse<Document>> {
    return api.get<Document>(`/api/documents/${id}`);
  }

  /**
   * Create a new document
   */
  async create(data: CreateDocumentData): Promise<ApiResponse<Document>> {
    return api.post<Document>('/api/documents', data);
  }

  /**
   * Update a document
   */
  async update(id: string, data: UpdateDocumentData): Promise<ApiResponse<Document>> {
    return api.put<Document>(`/api/documents/${id}`, data);
  }

  /**
   * Delete a document (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/documents/${id}`);
  }

  // ─────────────────────────────────────────────────────────────
  // IDENTITY DOCUMENTS (KYC)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get identity verification status
   */
  async getIdentityStatus(): Promise<ApiResponse<IdentityStatus>> {
    return api.get<IdentityStatus>('/api/documents/identity/status');
  }

  /**
   * Submit identity document for verification
   */
  async submitIdentity(data: SubmitIdentityData): Promise<ApiResponse<Document>> {
    return api.post<Document>('/api/documents/identity', data);
  }

  /**
   * Check if talent has verified identity
   */
  async hasVerifiedIdentity(): Promise<boolean> {
    try {
      const response = await this.getIdentityStatus();
      return response.data?.status === 'VERIFIED';
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DOCUMENT REQUIREMENTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Check document requirements for a feature
   */
  async checkRequirements(feature: string): Promise<ApiResponse<RequirementsCheckResult>> {
    return api.get<RequirementsCheckResult>(`/api/documents/requirements/${feature}`);
  }

  /**
   * Check if can access a feature (all required documents present)
   */
  async canAccessFeature(feature: string): Promise<boolean> {
    try {
      const response = await this.checkRequirements(feature);
      return response.data?.can_proceed ?? false;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FILE UPLOAD
  // ─────────────────────────────────────────────────────────────

  /**
   * Get pre-signed URL for file upload
   */
  async getUploadUrl(
    filename: string,
    contentType: string,
    category?: string
  ): Promise<ApiResponse<UploadUrlResponse>> {
    return api.post<UploadUrlResponse>('/api/documents/upload-url', {
      filename,
      content_type: contentType,
      category,
    });
  }

  /**
   * Upload a file and get the public URL
   * Note: This is a simplified implementation.
   * In production, you would upload to the pre-signed URL.
   */
  async uploadFile(
    uri: string,
    filename: string,
    contentType: string,
    category?: string
  ): Promise<string> {
    // Get upload URL
    const urlResponse = await this.getUploadUrl(filename, contentType, category);

    if (!urlResponse.success || !urlResponse.data) {
      throw new Error('Failed to get upload URL');
    }

    const { upload_url, public_url } = urlResponse.data;

    // In a real implementation, you would upload the file to upload_url
    // For now, we'll return the public_url assuming the upload succeeds
    // TODO: Implement actual file upload using fetch or expo-file-system

    console.log('Would upload to:', upload_url);
    return public_url;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get documents by category
   */
  async getByCategory(category: DocumentCategory): Promise<ApiResponse<Document[]>> {
    return this.getMyDocuments({ category });
  }

  /**
   * Get identity documents
   */
  async getIdentityDocuments(): Promise<ApiResponse<Document[]>> {
    return this.getByCategory('IDENTITY');
  }

  /**
   * Get professional documents (CV, portfolio, etc.)
   */
  async getProfessionalDocuments(): Promise<ApiResponse<Document[]>> {
    return this.getByCategory('PROFESSIONAL');
  }

  /**
   * Get academic documents (certificates, diplomas, etc.)
   */
  async getAcademicDocuments(): Promise<ApiResponse<Document[]>> {
    return this.getByCategory('ACADEMIC');
  }

  /**
   * Get primary CV
   */
  async getPrimaryCV(): Promise<Document | null> {
    try {
      const response = await this.getMyDocuments({ type: 'CV' });
      if (response.success && response.data) {
        // Find primary CV or first CV
        return response.data.find(d => d.is_primary) || response.data[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CV FOR APPLICATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the talent's CV for application pre-fill
   * Returns the most recent/primary CV document
   */
  async getCV(): Promise<ApiResponse<{ has_cv: boolean; data: Document | null; message?: string }>> {
    return api.get('/api/documents/cv');
  }

  /**
   * Get all CVs for selection during application
   */
  async getAllCVs(): Promise<ApiResponse<{ count: number; data: Document[] }>> {
    return api.get('/api/documents/cv/all');
  }

  /**
   * Check if talent has a CV in their documents
   */
  async hasCV(): Promise<boolean> {
    try {
      const response = await this.getCV();
      return response.data?.has_cv ?? false;
    } catch {
      return false;
    }
  }
}

export const documentService = new DocumentService();
