/**
 * Organization Service
 * Handles organization API operations
 */

import { api, ApiResponse } from './api';
import { Organization, OrganizationType } from '../types/models';

export interface CreateOrganizationData {
  name: string;
  type?: OrganizationType;
  description?: string;
  logo_url?: string;
  website_url?: string;
  contact_email?: string;
  contact_phone?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  sectors?: string[];
  goals?: string[];
}

export interface UpdateOrganizationData {
  name?: string;
  type?: OrganizationType;
  description?: string;
  logo_url?: string;
  website_url?: string;
  contact_email?: string;
  contact_phone?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  sectors?: string[];
  goals?: string[];
}

export interface OrganizationFilters {
  type?: OrganizationType;
  country?: string;
  limit?: number;
  offset?: number;
}

/**
 * List organizations
 */
async function list(filters?: OrganizationFilters): Promise<ApiResponse<Organization[]>> {
  return api.get<Organization[]>('/api/organizations', filters);
}

/**
 * Get organizations owned by current user
 */
async function getMyOrganizations(): Promise<ApiResponse<Organization[]>> {
  return api.get<Organization[]>('/api/organizations/my');
}

/**
 * Get a single organization by ID or slug
 */
async function get(idOrSlug: string): Promise<ApiResponse<Organization>> {
  return api.get<Organization>(`/api/organizations/${idOrSlug}`);
}

/**
 * Create a new organization
 */
async function create(data: CreateOrganizationData): Promise<ApiResponse<Organization>> {
  return api.post<Organization>('/api/organizations', data);
}

/**
 * Update an organization
 */
async function update(id: string, data: UpdateOrganizationData): Promise<ApiResponse<Organization>> {
  return api.put<Organization>(`/api/organizations/${id}`, data);
}

/**
 * Delete an organization
 */
async function remove(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return api.delete<{ success: boolean; message: string }>(`/api/organizations/${id}`);
}

export const organizationService = {
  list,
  getMyOrganizations,
  get,
  create,
  update,
  remove,
};
