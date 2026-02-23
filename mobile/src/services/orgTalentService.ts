/**
 * Organization Talent Service (CRM "Mes Talents")
 * API client for aggregated talent listing, favorites, and tags
 */

import { api } from './api';

// --- Types ---

export interface OrgTalentTag {
  id: string;
  name: string;
  color: string;
}

export interface OrgTalent {
  talent_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  sources: ('APPLICATION' | 'COMMUNITY' | 'SPACE_BOOKING' | 'MEMBER')[];
  is_favorite: boolean;
  tags: OrgTalentTag[];
  first_interaction: string;
  last_interaction: string;
}

export interface OrgTalentFilters {
  source?: 'APPLICATION' | 'COMMUNITY' | 'SPACE_BOOKING' | 'MEMBER';
  isFavorite?: boolean;
  tagId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface OrgTalentListResponse {
  talents: OrgTalent[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrgTagDefinition {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
}

// --- Labels (i18n) ---

import { getLabel } from '../utils/labels';

export const getSourceLabel = (source: string): string =>
  getLabel('orgTalentSources', source);

// --- API Functions ---

async function getTalents(
  orgId: string,
  filters?: OrgTalentFilters
): Promise<OrgTalentListResponse> {
  const params = new URLSearchParams();
  if (filters?.source) params.append('source', filters.source);
  if (filters?.isFavorite) params.append('is_favorite', 'true');
  if (filters?.tagId) params.append('tag_id', filters.tagId);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const query = params.toString();
  const url = `/api/organizations/${orgId}/talents${query ? `?${query}` : ''}`;

  const response = await api.get<OrgTalentListResponse>(url);
  if (!response.data) {
    throw new Error(response.error || 'Failed to fetch talents');
  }
  return response.data;
}

async function getTalentCount(orgId: string): Promise<number> {
  const response = await api.get<{ count: number }>(`/api/organizations/${orgId}/talents/count`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to fetch talent count');
  }
  return response.data.count;
}

async function getFavoriteIds(orgId: string): Promise<string[]> {
  const response = await api.get<string[]>(`/api/organizations/${orgId}/talents/favorites/ids`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to fetch favorite ids');
  }
  return response.data;
}

async function favoriteTalent(orgId: string, talentId: string, notes?: string): Promise<void> {
  await api.post(`/api/organizations/${orgId}/talents/${talentId}/favorite`, { notes });
}

async function unfavoriteTalent(orgId: string, talentId: string): Promise<void> {
  await api.delete(`/api/organizations/${orgId}/talents/${talentId}/favorite`);
}

async function getTags(orgId: string): Promise<OrgTagDefinition[]> {
  const response = await api.get<OrgTagDefinition[]>(`/api/organizations/${orgId}/talents/tags`);
  if (!response.data) {
    throw new Error(response.error || 'Failed to fetch tags');
  }
  return response.data;
}

async function createTag(
  orgId: string,
  name: string,
  color: string
): Promise<OrgTagDefinition> {
  const response = await api.post<OrgTagDefinition>(
    `/api/organizations/${orgId}/talents/tags`,
    { name, color }
  );
  if (!response.data) {
    throw new Error(response.error || 'Failed to create tag');
  }
  return response.data;
}

async function updateTag(
  orgId: string,
  tagId: string,
  updates: { name?: string; color?: string }
): Promise<OrgTagDefinition> {
  const response = await api.patch<OrgTagDefinition>(
    `/api/organizations/${orgId}/talents/tags/${tagId}`,
    updates
  );
  if (!response.data) {
    throw new Error(response.error || 'Failed to update tag');
  }
  return response.data;
}

async function deleteTag(orgId: string, tagId: string): Promise<void> {
  await api.delete(`/api/organizations/${orgId}/talents/tags/${tagId}`);
}

async function assignTag(orgId: string, talentId: string, tagId: string): Promise<void> {
  await api.post(`/api/organizations/${orgId}/talents/${talentId}/tags/${tagId}`, {});
}

async function unassignTag(orgId: string, talentId: string, tagId: string): Promise<void> {
  await api.delete(`/api/organizations/${orgId}/talents/${talentId}/tags/${tagId}`);
}

export const orgTalentService = {
  getTalents,
  getTalentCount,
  getFavoriteIds,
  favoriteTalent,
  unfavoriteTalent,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  assignTag,
  unassignTag,
};

export default orgTalentService;
