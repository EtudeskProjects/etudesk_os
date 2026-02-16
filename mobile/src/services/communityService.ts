/**
 * Community Service
 * Handles all community-related API calls
 */

import { api, ApiResponse } from './api';
import { Community, CommunityType, CommunityStatus, Visibility, Sector } from '../types/models';

export interface CommunityFilters {
  type?: CommunityType;
  status?: CommunityStatus;
  limit?: number;
  offset?: number;
  include_private?: boolean;
}

export interface MembershipAnswer {
  question: string;
  answer: string;
}

export interface JoinCommunityData {
  answers?: MembershipAnswer[];
  accepted_rules?: boolean;
}

export interface MembershipStatus {
  is_member: boolean;
  has_pending_request: boolean;
  membership_id?: string;
  role?: string;
  status?: 'ACTIVE' | 'PENDING' | 'REJECTED';
  joined_at?: string;
}

export interface JoinResult {
  membership_id: string;
  status: string;
  message: string;
}

export interface CreateCommunityData {
  name: string;
  type?: CommunityType;
  description?: string;
  rules?: string;
  application_questions?: string[];

  // Fields
  tags?: string[]; // Max 3 tags
  sectors?: Sector[]; // Max 5
  visibility?: Visibility;

  // Default member permissions
  default_member_permissions?: MemberPermissions;

  // Location
  city?: string;
  region?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };

  // Media
  cover_image_url?: string; // Hero image
  images?: string[]; // Gallery images

  status?: CommunityStatus;
  organization_id?: string;
  created_by?: string;
}

export interface UpdateCommunityData extends Partial<CreateCommunityData> {}

export interface GenerateCommunityInput {
  name: string;
  organization_id: string;
  existing_data?: Partial<CreateCommunityData>;
}

export interface GeneratedCommunityData {
  suggested_name?: string;
  description?: string;
  tags?: string[];
  sectors?: Sector[];
  rules?: string;
  visibility?: Visibility;
  application_questions?: string[];
}

class CommunityService {
  /**
   * Get all communities with optional filters
   */
  async getAll(filters?: CommunityFilters): Promise<ApiResponse<Community[]>> {
    return api.get<Community[]>('/api/communities', filters);
  }

  /**
   * Get a single community by ID
   */
  async getById(id: string): Promise<ApiResponse<Community>> {
    return api.get<Community>(`/api/communities/${id}`);
  }

  /**
   * Get communities for a specific organization
   */
  async getByOrganization(
    orgId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<Community[]>> {
    return api.get<Community[]>(`/api/communities/organization/${orgId}`, filters);
  }

  /**
   * Create a new community
   */
  async create(data: CreateCommunityData): Promise<ApiResponse<Community>> {
    return api.post<Community>('/api/communities', data);
  }

  /**
   * Update an existing community
   */
  async update(id: string, data: UpdateCommunityData): Promise<ApiResponse<Community>> {
    return api.put<Community>(`/api/communities/${id}`, data);
  }

  /**
   * Delete a community (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/communities/${id}`);
  }

  /**
   * Create community as draft (inactive)
   */
  async saveDraft(data: CreateCommunityData): Promise<ApiResponse<Community>> {
    return this.create({ ...data, status: 'INACTIVE' });
  }

  /**
   * Activate a community
   */
  async activate(id: string): Promise<ApiResponse<Community>> {
    return this.update(id, { status: 'ACTIVE' });
  }

  /**
   * Archive a community
   */
  async archive(id: string): Promise<ApiResponse<Community>> {
    return this.update(id, { status: 'ARCHIVED' });
  }

  // USER MEMBERSHIP METHODS
  /**
   * Get communities the current user is a member of (including PENDING requests).
   * Backend returns paginated payload; we normalize to { data: { memberships, pagination }, count }.
   */
  async getMyMemberships(filters?: { status?: 'ACTIVE' | 'PENDING' | 'REJECTED'; limit?: number; offset?: number }): Promise<ApiResponse<{
    memberships: Array<{
      id: string;
      community_id?: string;
      community: Community;
      role: 'ADMIN' | 'MEMBER';
      status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
      joined_at: string;
    }>;
    pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
  }>> {
    const res = await api.get<any>('/api/communities/memberships/me', filters);
    const rawData = res?.data as any;
    const list = Array.isArray(rawData)
      ? rawData
      : rawData?.data ?? rawData?.memberships ?? (res as any)?.memberships ?? [];
    const pagination = (res as any)?.pagination ?? rawData?.pagination;
    const totalFromPagination = pagination?.total;
    const totalFromCount = (res as any)?.count ?? rawData?.count;
    const normalizedCount = typeof totalFromPagination === 'number'
      ? totalFromPagination
      : (typeof totalFromCount === 'number' ? totalFromCount : undefined);

    return {
      data: {
        memberships: list,
        ...(pagination && { pagination }),
      },
      ...(typeof normalizedCount === 'number' ? { count: normalizedCount } : {}),
    } as any;
  }

  /**
   * Join a community (request membership)
   * @param communityId - ID of the community to join
   * @param data - Optional answers to membership questions and rules acceptance
   */
  async join(communityId: string, data?: JoinCommunityData): Promise<ApiResponse<JoinResult>> {
    return api.post(`/api/communities/${communityId}/join`, data || {});
  }

  /**
   * Leave a community
   */
  async leave(communityId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.post(`/api/communities/${communityId}/leave`, {});
  }

  /**
   * Cancel a pending membership request
   */
  async cancelRequest(communityId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.post(`/api/communities/${communityId}/cancel-request`, {});
  }

  /**
   * Check if user is member of a community
   * Returns detailed membership status including pending requests
   */
  async checkMembership(communityId: string): Promise<ApiResponse<MembershipStatus>> {
    return api.get(`/api/communities/${communityId}/membership`);
  }

  /**
   * Generate community suggestions using AI
   * Requires: name, organization_id
   */
  async generate(input: GenerateCommunityInput): Promise<ApiResponse<GeneratedCommunityData>> {
    return api.post<GeneratedCommunityData>('/api/communities/generate', input, { timeout: 60000 });
  }

  /**
   * Increment view count for a community
   */
  async incrementViews(id: string): Promise<ApiResponse<{ views_count: number }>> {
    return api.post<{ views_count: number }>(`/api/communities/${id}/views`, {});
  }

  // ORGANIZATION MEMBER MANAGEMENT METHODS
  /**
   * Get all members of a community (for organization)
   */
  async getCommunityMembers(
    communityId: string,
    filters?: { status?: MemberStatus; limit?: number; offset?: number; search?: string }
  ): Promise<ApiResponse<{ data: CommunityMember[]; count: number; statusCounts: Record<string, number> }>> {
    return api.get(`/api/communities/${communityId}/members`, filters);
  }

  /**
   * Get a single membership details (for organization)
   */
  async getMembershipDetails(membershipId: string): Promise<ApiResponse<CommunityMemberDetails>> {
    return api.get(`/api/communities/members/${membershipId}`);
  }

  /**
   * Update membership status (for organization)
   */
  async updateMembershipStatus(
    membershipId: string,
    status: MemberStatus,
    rejectionReason?: string
  ): Promise<ApiResponse<CommunityMember>> {
    return api.put(`/api/communities/members/${membershipId}/status`, {
      status,
      rejection_reason: rejectionReason,
    });
  }

  /**
   * Update internal notes for a member (for organization)
   */
  async updateMemberNotes(membershipId: string, notes: string): Promise<ApiResponse<CommunityMember>> {
    return api.put(`/api/communities/members/${membershipId}/notes`, { notes });
  }

  /**
   * Update rating for a member (for organization)
   */
  async updateMemberRating(membershipId: string, rating: number): Promise<ApiResponse<CommunityMember>> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    return api.put(`/api/communities/members/${membershipId}/rating`, { rating });
  }

  /**
   * Delete a membership (hard delete, allows member to reapply)
   */
  async deleteMember(membershipId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/communities/members/${membershipId}`);
  }

  // MEMBER PERMISSIONS
  /**
   * Get permissions for a specific member
   */
  async getMemberPermissions(membershipId: string): Promise<ApiResponse<{
    permissions: MemberPermissions;
    isCustom: boolean;
    communityDefaults: MemberPermissions;
    role: 'ADMIN' | 'MEMBER';
  }>> {
    return api.get(`/api/communities/members/${membershipId}/permissions`);
  }

  /**
   * Update permissions for a specific member
   * Pass null to reset to community defaults
   */
  async updateMemberPermissions(
    membershipId: string,
    permissions: Partial<MemberPermissions> | null
  ): Promise<ApiResponse<{
    permissions: MemberPermissions;
    isCustom: boolean;
    message: string;
  }>> {
    return api.put(`/api/communities/members/${membershipId}/permissions`, { permissions });
  }

  /**
   * Get default permissions for a community
   */
  async getCommunityDefaultPermissions(communityId: string): Promise<ApiResponse<MemberPermissions>> {
    return api.get(`/api/communities/${communityId}/default-permissions`);
  }

  /**
   * Update default permissions for a community
   */
  async updateCommunityDefaultPermissions(
    communityId: string,
    permissions: Partial<MemberPermissions>
  ): Promise<ApiResponse<MemberPermissions>> {
    return api.put(`/api/communities/${communityId}/default-permissions`, permissions);
  }
}

// --- Additional Types ---

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface MemberPermissions {
  can_post: boolean;
  can_create_event: boolean;
  can_create_poll: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
  can_post: true,
  can_create_event: false,
  can_create_poll: false,
};

export interface CommunityMember {
  id: string;
  community_id: string;
  talent_id: string;
  role: 'ADMIN' | 'MEMBER';
  status: MemberStatus;
  answers?: MembershipAnswer[];
  accepted_rules?: boolean;
  internal_notes?: string;
  rating?: number;
  viewed_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  joined_at?: string;
  created_at?: string;
  updated_at?: string;
  unread_messages?: number;
  talent?: {
    id: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
    profile_picture_url?: string;
    city?: string;
    country?: string;
    bio?: string;
    current_role?: string;
  };
}

export interface CommunityMemberDetails extends CommunityMember {
  community?: {
    id: string;
    name: string;
    application_questions?: string[];
    rules?: string;
  };
  talent?: {
    id: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
    profile_picture_url?: string;
    city?: string;
    country?: string;
    bio?: string;
    headline?: string;
  };
}

export const communityService = new CommunityService();
