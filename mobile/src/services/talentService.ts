/**
 * Talent Service
 * Handles talent profile API operations
 */

import { api, ApiResponse } from './api';
import { Talent, TalentObjectData } from '../types/models';

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
  learning_preferences?: {
    style?: 'VISUAL' | 'AUDITORY' | 'TEXT_BASED' | 'INTERACTIVE';
    interaction?: 'SOCRATIC' | 'DIRECT' | 'EXPLORATORY';
    depth?: 'THEORETICAL' | 'PRACTICAL' | 'BALANCED';
    difficulty?: 'GENTLE' | 'STANDARD' | 'CHALLENGING';
  };
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
 * Generate a bio suggestion using AI
 */
async function generateBio(context?: {
  display_name?: string;
  profile_tags?: string[];
  sectors?: string[];
  goals?: string[];
  country?: string;
  city?: string;
  region?: string;
}): Promise<ApiResponse<{ bio: string }>> {
  return api.post<{ bio: string }>('/api/talents/generate-bio', context || {}, { timeout: 30000 });
}

/**
 * Get current user's TalentObject (rich profile with skills & documents)
 * @param includeHidden - If false, hidden skills are excluded (for public previews)
 */
async function getMyTalentObject(options?: { includeHidden?: boolean }): Promise<ApiResponse<TalentObjectData>> {
  const params = options?.includeHidden === false ? '?include_hidden=false' : '';
  return api.get<TalentObjectData>(`/api/talents/me/talent-object${params}`);
}

/**
 * Get a talent profile by ID or slug
 */
async function getTalent(idOrSlug: string): Promise<ApiResponse<Talent>> {
  return api.get<Talent>(`/api/talents/${idOrSlug}`);
}

export const talentService = {
  getMyProfile,
  getMyTalentObject,
  updateMyProfile,
  generateBio,
  getTalent,
};
