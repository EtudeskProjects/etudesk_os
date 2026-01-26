/**
 * Hub Service
 * Handles all hub-related API calls
 */

import { api, ApiResponse } from './api';
import { Hub, HubType, AccessType } from '../types/models';

export interface HubFilters {
  type?: HubType;
  access_type?: AccessType;
  limit?: number;
  offset?: number;
}

export interface CreateHubData {
  name: string;
  type?: HubType;
  description?: string;
  amenities?: string[];
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  access_type?: AccessType;
  pricing_type?: string;
  price?: string;
  capacity?: string | number;
  opening_hours?: Array<{
    day: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }>;
  contact_phone?: string;
  contact_email?: string;
  website_url?: string;
  logo_url?: string;
  cover_image_url?: string;
  gallery_images?: string[];
  organization_id?: string;
}

export interface UpdateHubData extends Partial<CreateHubData> {}

class HubService {
  /**
   * Get all hubs with optional filters
   */
  async getAll(filters?: HubFilters): Promise<ApiResponse<Hub[]>> {
    return api.get<Hub[]>('/api/hubs', filters);
  }

  /**
   * Get a single hub by ID
   */
  async getById(id: string): Promise<ApiResponse<Hub>> {
    return api.get<Hub>(`/api/hubs/${id}`);
  }

  /**
   * Get hubs for a specific organization
   */
  async getByOrganization(
    orgId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<Hub[]>> {
    return api.get<Hub[]>(`/api/hubs/organization/${orgId}`, filters);
  }

  /**
   * Create a new hub
   */
  async create(data: CreateHubData): Promise<ApiResponse<Hub>> {
    return api.post<Hub>('/api/hubs', data);
  }

  /**
   * Update an existing hub
   */
  async update(id: string, data: UpdateHubData): Promise<ApiResponse<Hub>> {
    return api.put<Hub>(`/api/hubs/${id}`, data);
  }

  /**
   * Delete a hub (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/hubs/${id}`);
  }

  /**
   * Create hub as draft
   */
  async saveDraft(data: CreateHubData): Promise<ApiResponse<Hub>> {
    return this.create(data);
  }

}

export const hubService = new HubService();
