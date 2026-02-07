/**
 * Opportunity Service
 * Handles all opportunity-related API calls
 */

import { api, ApiResponse } from './api';
import {
  Opportunity,
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  OpportunityStatus,
  ApplicationQuestion,
  Visibility,
} from '../types/models';

export interface OpportunityFilters {
  status?: OpportunityStatus;
  type?: OpportunityType;
  location_type?: LocationType;
  contract_type?: ContractType;
  limit?: number;
  offset?: number;
}

export interface CreateOpportunityData {
  title: string;
  slug?: string;
  type?: OpportunityType;
  contract_type?: ContractType;
  work_rhythm?: WorkRhythm;
  summary?: string;
  requirements?: string;
  nice_to_have?: string;
  // Sectors
  sectors?: string[];
  // Compensation (min/max/frequency/currency only)
  compensation_min?: number;
  compensation_max?: number;
  currency?: string;
  compensation_frequency?: CompensationFrequency;
  // Location
  location_type?: LocationType;
  locations?: Array<{
    city?: string;
    region?: string;
    country?: string;
    is_primary?: boolean;
  }>;
  // Dates
  deadline?: string;
  start_date?: string;
  duration?: string;
  status?: OpportunityStatus;
  organization_id?: string;
  // Media
  cover_image_url?: string;
  images?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type?: string;
    size?: number;
  }>;
  // Application settings
  cv_required?: boolean;
  application_questions?: ApplicationQuestion[];
  // Visibility
  visibility?: Visibility;
}

export interface UpdateOpportunityData extends Partial<CreateOpportunityData> { }

export interface GenerateOpportunityInput {
  title: string;
  type: OpportunityType;
  organization_id: string;
  existing_data?: Partial<CreateOpportunityData>;
}

export interface GeneratedOpportunityData {
  suggested_title: string;
  summary: string;
  requirements: string;
  nice_to_have: string;
  contract_type: ContractType;
  work_rhythm: WorkRhythm;
  sectors: string[];
  compensation_min?: number;
  compensation_max?: number;
  currency: string;
  compensation_frequency: CompensationFrequency;
  location_type: LocationType;
  locations?: Array<{
    city?: string;
    region?: string;
    country?: string;
    is_primary?: boolean;
  }>;
  duration?: string;
  deadline_days: number;
  cv_required: boolean;
  application_questions: ApplicationQuestion[];
  target_profiles: string[];
  ideal_candidate_summary: string;
}

class OpportunityService {
  /**
   * Get all opportunities with optional filters
   */
  async getAll(filters?: OpportunityFilters): Promise<ApiResponse<Opportunity[]>> {
    return api.get<Opportunity[]>('/api/opportunities', filters);
  }

  /**
   * Get a single opportunity by ID
   */
  async getById(id: string): Promise<ApiResponse<Opportunity>> {
    return api.get<Opportunity>(`/api/opportunities/${id}`);
  }

  /**
   * Increment view count for an opportunity
   */
  async incrementViews(id: string): Promise<ApiResponse<{ success: boolean; views_count: number }>> {
    return api.post<{ success: boolean; views_count: number }>(`/api/opportunities/${id}/view`, {});
  }

  /**
   * Get opportunities for a specific organization
   */
  async getByOrganization(
    orgId: string,
    filters?: { status?: OpportunityStatus; limit?: number; offset?: number }
  ): Promise<ApiResponse<Opportunity[]>> {
    return api.get<Opportunity[]>(`/api/opportunities/organization/${orgId}`, filters);
  }

  /**
   * Create a new opportunity
   */
  async create(data: CreateOpportunityData): Promise<ApiResponse<Opportunity>> {
    return api.post<Opportunity>('/api/opportunities', data);
  }

  /**
   * Update an existing opportunity
   */
  async update(id: string, data: UpdateOpportunityData): Promise<ApiResponse<Opportunity>> {
    return api.put<Opportunity>(`/api/opportunities/${id}`, data);
  }

  /**
   * Delete an opportunity (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/opportunities/${id}`);
  }

  /**
   * Create opportunity as draft
   */
  async saveDraft(data: CreateOpportunityData): Promise<ApiResponse<Opportunity>> {
    return this.create({ ...data, status: 'DRAFT' });
  }

  /**
   * Publish a draft opportunity
   */
  async publish(id: string): Promise<ApiResponse<Opportunity>> {
    return this.update(id, { status: 'OPEN' });
  }

  /**
   * Pause an opportunity
   */
  async pause(id: string): Promise<ApiResponse<Opportunity>> {
    return this.update(id, { status: 'PAUSED' });
  }

  /**
   * Generate opportunity suggestions using AI
   * Requires: title, type, organization_id
   */
  async generate(input: GenerateOpportunityInput): Promise<ApiResponse<GeneratedOpportunityData>> {
    return api.post<GeneratedOpportunityData>('/api/opportunities/generate', input, { timeout: 60000 });
  }
}

export const opportunityService = new OpportunityService();
