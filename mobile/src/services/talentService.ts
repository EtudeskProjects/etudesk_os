/**
 * Talent Service
 * Handles talent profile API operations
 */

import { api, ApiResponse } from './api';
import { Talent } from '../types/models';

export interface UpdateTalentData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  gender?: 'M' | 'F' | 'O';
  city?: string;
  region?: string;
  country?: string;
  remote_ready?: boolean;
  willing_to_relocate?: boolean;
  profile_tags?: string[];
  sectors?: string[];
  goals?: string[];
}

/**
 * Get current user's talent profile
 */
async function getMyProfile(): Promise<ApiResponse<Talent>> {
  return api.get<Talent>('/api/talents/me');
}

/**
 * Update current user's talent profile
 */
async function updateMyProfile(data: UpdateTalentData): Promise<ApiResponse<Talent>> {
  return api.put<Talent>('/api/talents/me', data);
}

/**
 * Get a talent profile by ID or slug
 */
async function getTalent(idOrSlug: string): Promise<ApiResponse<Talent>> {
  return api.get<Talent>(`/api/talents/${idOrSlug}`);
}

export const talentService = {
  getMyProfile,
  updateMyProfile,
  getTalent,
};
