/**
 * Community Invitation Service
 * Handles all community invitation-related API calls
 */

import { api, ApiResponse } from './api';
import { Community } from '../types/models';


export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
export type InvitationRole = 'ADMIN' | 'MEMBER';

export interface CommunityInvitation {
  id: string;
  community_id: string;
  invited_by: string;
  invitee_talent_id?: string;
  invitee_email: string;
  invitee_name?: string;
  message?: string;
  role: InvitationRole;
  status: InvitationStatus;
  invitation_token?: string;
  sent_at: string;
  viewed_at?: string;
  responded_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  invited_by_name?: string;
  invited_by_avatar?: string;
  community_name?: string;
  community_description?: string;
  cover_image_url?: string;
  community_type?: string;
  visibility?: string;
  members_count?: number;
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

export interface SendInvitationData {
  email: string;
  name?: string;
  message?: string;
  role?: InvitationRole;
}

export interface SendInvitationsResult {
  sent: number;
  failed: number;
  invitations: Array<{
    id: string;
    email: string;
    name?: string;
    role: InvitationRole;
    is_registered_user: boolean;
    status: InvitationStatus;
  }>;
  errors: Array<{
    email: string;
    error: string;
  }>;
}

export interface AcceptInvitationResult {
  success: boolean;
  message: string;
  community_id?: string;
  invitation_id?: string;
}

// --- Service ---

class CommunityInvitationService {
  // ADMIN METHODS (for community managers)
  /**
   * Send invitations to join a community
   */
  async sendInvitations(
    communityId: string,
    invitations: SendInvitationData[]
  ): Promise<ApiResponse<SendInvitationsResult>> {
    return api.post(`/api/communities/${communityId}/invitations`, { invitations });
  }

  /**
   * Get all invitations for a community (admin view)
   */
  async getCommunityInvitations(
    communityId: string,
    filters?: { status?: InvitationStatus; limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: CommunityInvitation[];
    count: number;
    statusCounts: Record<string, number>;
  }>> {
    return api.get(`/api/communities/${communityId}/invitations`, filters);
  }

  /**
   * Cancel a pending invitation
   */
  async cancelInvitation(
    communityId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/communities/${communityId}/invitations/${invitationId}`);
  }

  /**
   * Resend an invitation email
   */
  async resendInvitation(
    communityId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/communities/${communityId}/invitations/${invitationId}/resend`, {});
  }

  // USER METHODS (for invitees)
  /**
   * Get invitations received by current user
   */
  async getMyInvitations(
    filters?: { status?: InvitationStatus; limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: CommunityInvitation[];
    count: number;
    statusCounts: Record<string, number>;
  }>> {
    return api.get('/api/community-invitations/me', filters);
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(invitationId: string): Promise<ApiResponse<AcceptInvitationResult>> {
    return api.post(`/api/community-invitations/${invitationId}/accept`, {});
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/community-invitations/${invitationId}/decline`, {});
  }

  /**
   * Verify invitation by token (for email links)
   */
  async verifyInvitationToken(
    token: string
  ): Promise<ApiResponse<{
    data: {
      id: string;
      community_name: string;
      community_description?: string;
      cover_image_url?: string;
      invited_by_name: string;
      message?: string;
      role: InvitationRole;
      expires_at: string;
    };
  }>> {
    return api.get(`/api/community-invitations/token/${token}`);
  }

  // HELPER METHODS
  /**
   * Get pending invitations count for badge display
   */
  async getPendingInvitationsCount(): Promise<number> {
    try {
      const response = await this.getMyInvitations({ status: 'PENDING', limit: 1 });
      return response.data?.statusCounts?.PENDING || 0;
    } catch {
      return 0;
    }
  }
}

export const communityInvitationService = new CommunityInvitationService();
