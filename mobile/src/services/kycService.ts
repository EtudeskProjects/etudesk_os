/**
 * KYC Service
 * Handles KYC (Know Your Customer) API operations
 */

import { api, ApiResponse } from './api';

export type KYCDocumentType = 'ID_CARD' | 'PASSPORT' | 'DRIVER_LICENSE';
export type KYCStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface VerificationResult {
  is_verified: boolean;
  verification_score: number;
  document_type_detected: KYCDocumentType | 'UNKNOWN' | 'INVALID';
  document_quality: 'GOOD' | 'ACCEPTABLE' | 'POOR';
  names_match: boolean;
  extracted_name: string | null;
  rejection_reasons: string[];
  warnings: string[];
}

export interface KYCVerification {
  id: string;
  document_type: KYCDocumentType;
  status: KYCStatus;
  rejection_reason?: string;
  front_image_url?: string;
  back_image_url?: string;
  verification_score?: number;
  verification_details?: {
    document_analysis?: {
      detected_document_type: string;
      document_quality: string;
      extracted_info?: {
        first_name?: string;
        last_name?: string;
        full_name?: string;
      };
    };
    profile_match?: {
      names_match: boolean;
      match_confidence: number;
      extracted_name?: string;
      profile_name?: string;
    };
    warnings?: string[];
  };
  verification_result?: VerificationResult;
  submitted_at?: string;
  verified_at?: string;
  created_at: string;
  hasSubmission?: boolean;
}

export interface SubmitKYCData {
  document_type: KYCDocumentType;
  front_image_url: string;
  back_image_url?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  fileId: string;
  expiresIn: number;
}

/**
 * Get current KYC verification status
 */
async function getStatus(): Promise<ApiResponse<KYCVerification>> {
  return api.get<KYCVerification>('/api/kyc/status');
}

/**
 * Submit KYC verification documents
 */
async function submit(data: SubmitKYCData): Promise<ApiResponse<KYCVerification>> {
  return api.post<KYCVerification>('/api/kyc/submit', data);
}

/**
 * Get a pre-signed URL for uploading KYC documents
 */
async function getUploadUrl(filename: string, contentType: string): Promise<ApiResponse<UploadUrlResponse>> {
  return api.post<UploadUrlResponse>('/api/kyc/upload-url', {
    filename,
    content_type: contentType,
  });
}

/**
 * Get KYC verification history
 */
async function getHistory(): Promise<ApiResponse<KYCVerification[]>> {
  return api.get<KYCVerification[]>('/api/kyc/history');
}

/**
 * Upload a KYC document image to the server
 * Uses the imageService to upload with 'identity' type (higher quality)
 */
async function uploadImage(uri: string, _filename: string): Promise<string> {
  const { imageService } = await import('./imageService');

  const optimized = await imageService.optimizeImage(uri, 'identity');
  const uploaded = await imageService.uploadImage(optimized, 'identity', 'kyc');

  return uploaded.url;
}

export const kycService = {
  getStatus,
  submit,
  getUploadUrl,
  getHistory,
  uploadImage,
};
