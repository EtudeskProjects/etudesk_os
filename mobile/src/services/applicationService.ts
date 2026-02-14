/**
 * Application (Candidature) Service
 * Handles all application-related API calls for talents and organizations
 */

import { api, ApiResponse } from './api';
import { getApiUrl } from '../constants/config';
import {
  Application,
  ApplicationStatus,
  ApplicationAnswer,
} from '../types/models';


export interface ApplicationFilters {
  status?: ApplicationStatus;
  opportunity_id?: string;
  limit?: number;
  offset?: number;
}

export interface CreateApplicationData {
  opportunity_id: string;
  resume_url?: string;
  answers?: ApplicationAnswer[];
}

export interface UpdateApplicationData {
  status?: ApplicationStatus;
  internal_notes?: string;
  rating?: number;
}

// --- Service Class ---

class ApplicationService {
  // TALENT ENDPOINTS
  /**
   * Create a new application (for talents)
   */
  async apply(data: CreateApplicationData): Promise<ApiResponse<Application>> {
    return api.post<Application>('/api/applications', data);
  }

  /**
   * Get all applications for the current talent
   */
  async getMyApplications(filters?: ApplicationFilters): Promise<ApiResponse<Application[]>> {
    return api.get<Application[]>('/api/applications/me', filters);
  }

  /**
   * Get a specific application by ID (for talent)
   */
  async getApplication(id: string): Promise<ApiResponse<Application>> {
    return api.get<Application>(`/api/applications/${id}`);
  }

  /**
   * Withdraw an application (for talents)
   */
  async withdraw(id: string): Promise<ApiResponse<Application>> {
    return api.put<Application>(`/api/applications/${id}/withdraw`, {});
  }

  /**
   * Delete an application (for talents - hard delete, allows reapplying)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/applications/${id}`);
  }

  /**
   * Check if talent has already applied to an opportunity
   */
  async hasApplied(opportunityId: string): Promise<ApiResponse<{ applied: boolean; application_id?: string; is_owner?: boolean; application?: { id: string; status: string; applied_at: string } }>> {
    return api.get(`/api/applications/check/${opportunityId}`);
  }

  // ORGANIZATION ENDPOINTS
  /**
   * Get all applications for an organization
   */
  async getOrganizationApplications(
    orgId: string,
    filters?: ApplicationFilters
  ): Promise<ApiResponse<Application[]>> {
    return api.get<Application[]>(`/api/applications/organization/${orgId}`, filters);
  }

  /**
   * Get applications for a specific opportunity
   */
  async getOpportunityApplications(
    opportunityId: string,
    filters?: { status?: ApplicationStatus; limit?: number; offset?: number }
  ): Promise<ApiResponse<Application[]>> {
    return api.get<Application[]>(`/api/applications/opportunity/${opportunityId}`, filters);
  }

  /**
   * Get application counts by status for an opportunity
   * Note: Status counts are returned inline by getOpportunityApplications() and getRankedApplications()
   * in the `statusCounts` field. This method uses the same endpoint.
   */
  async getApplicationCounts(opportunityId: string): Promise<ApiResponse<Record<ApplicationStatus, number>>> {
    return api.get(`/api/applications/opportunity/${opportunityId}`, { limit: 0, offset: 0 });
  }

  /**
   * Update application status (for organizations)
   */
  async updateStatus(id: string, status: ApplicationStatus): Promise<ApiResponse<Application>> {
    return api.put<Application>(`/api/applications/${id}/status`, { status });
  }

  /**
   * Mark application as viewed (for organizations)
   */
  async markAsViewed(id: string): Promise<ApiResponse<Application>> {
    return api.put<Application>(`/api/applications/${id}/view`, {});
  }

  /**
   * Add/update internal notes (for organizations)
   */
  async updateNotes(id: string, notes: string): Promise<ApiResponse<Application>> {
    return api.put<Application>(`/api/applications/${id}/notes`, { notes });
  }

  /**
   * Add/update rating (for organizations, 1-5 stars)
   */
  async updateRating(id: string, rating: number): Promise<ApiResponse<Application>> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    return api.put<Application>(`/api/applications/${id}/rating`, { rating });
  }

  /**
   * Delete an application (for organizations - hard delete)
   */
  async deleteAsOrganization(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/applications/${id}/organization`);
  }

  /**
   * Bulk update status for multiple applications (for organizations)
   */
  async bulkUpdateStatus(
    applicationIds: string[],
    status: ApplicationStatus
  ): Promise<ApiResponse<{ updated: number; failed: number }>> {
    return api.put('/api/applications/bulk/status', { application_ids: applicationIds, status });
  }

  /**
   * Export applications to PDF (for organizations)
   */
  async exportToCsv(opportunityId: string, options?: { status?: ApplicationStatus; matchCategory?: string }): Promise<ApiResponse<any>> {
    const params: Record<string, string> = {};
    if (options?.status) params.status = options.status;
    if (options?.matchCategory) params.matchCategory = options.matchCategory;
    return api.get(`/api/applications/opportunity/${opportunityId}/export-csv`, params);
  }

  /**
   * Get CSV export URL for applications (for organizations)
   * Returns the URL to download the CSV file
   */
  getExportCsvUrl(opportunityId: string, options?: { status?: ApplicationStatus; matchCategory?: string }): string {
    let url = getApiUrl(`/applications/opportunity/${opportunityId}/export-csv`);
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.matchCategory) params.append('matchCategory', options.matchCategory);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  // MATCHING & RECOMMENDATIONS
  /**
   * Get ranked applications for an opportunity (sorted by match score)
   * Applications are returned within each status group, sorted by relevance
   */
  async getRankedApplications(
    opportunityId: string,
    status?: ApplicationStatus
  ): Promise<ApiResponse<{
    data: RankedApplication[];
    grouped: Record<string, RankedApplication[]>;
    count: number;
    statusCounts: Record<string, number>;
  }>> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    return api.get(`/api/applications/opportunity/${opportunityId}/ranked`, params);
  }

  /**
   * Get AI recommendation for a specific application
   * Returns a ~30 word recommendation cached for 24h
   */
  async getRecommendation(applicationId: string): Promise<ApiResponse<{
    application_id: string;
    recommendation: string;
  }>> {
    return api.get(`/api/applications/${applicationId}/recommendation`);
  }
}

// Extended application type with matching data
export interface RankedApplication extends Application {
  matchScore?: number;
  matchCategory?: 'excellent' | 'good' | 'average' | 'low';
  ai_recommendation?: string;
}

export const applicationService = new ApplicationService();
