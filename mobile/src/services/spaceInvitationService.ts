/**
 * Space Invitation Service
 * Handles all space invitation-related API calls
 */

import { api, ApiResponse } from './api';

// Types

export interface SpaceInvitation {
  id: string;
  space_id: string;
  invited_by: string;
  invitee_talent_id?: string;
  invitee_email: string;
  invitee_name?: string;
  message?: string;
  invitation_token?: string;
  sent_at: string;
  expires_at: string;
  created_at: string;
  // Joined data
  invited_by_name?: string;
  invited_by_avatar?: string;
  space_name?: string;
  space_description?: string;
  cover_image_url?: string;
  space_type?: string;
  city?: string;
  country?: string;
  hourly_rate?: number;
  daily_rate?: number;
  capacity?: number;
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

export interface SendSpaceInvitationData {
  email: string;
  name?: string;
  message?: string;
}

export interface SendSpaceInvitationsResult {
  sent: number;
  failed: number;
  invitations: Array<{
    id: string;
    email: string;
    name?: string;
    is_registered_user: boolean;
  }>;
  errors: Array<{
    email: string;
    error: string;
  }>;
}

export interface AcceptSpaceInvitationResult {
  success: boolean;
  message: string;
  space_id?: string;
}

// Service

class SpaceInvitationService {
  // Admin methods (for space managers)

  /**
   * Send invitations to book a space
   */
  async sendInvitations(
    spaceId: string,
    invitations: SendSpaceInvitationData[]
  ): Promise<ApiResponse<SendSpaceInvitationsResult>> {
    return api.post(`/api/spaces/${spaceId}/invitations`, { invitations });
  }

  /**
   * Get all invitations for a space (admin view)
   */
  async getSpaceInvitations(
    spaceId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: SpaceInvitation[];
    count: number;
  }>> {
    return api.get(`/api/spaces/${spaceId}/invitations`, filters);
  }

  /**
   * Cancel a pending invitation (DELETE from DB)
   */
  async cancelInvitation(
    spaceId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/spaces/${spaceId}/invitations/${invitationId}`);
  }

  /**
   * Resend an invitation email
   */
  async resendInvitation(
    spaceId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/spaces/${spaceId}/invitations/${invitationId}/resend`, {});
  }

  // User methods (for invitees)

  /**
   * Get invitations received by current user
   */
  async getMyInvitations(
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: SpaceInvitation[];
    count: number;
  }>> {
    return api.get('/api/space-invitations/me', filters);
  }

  /**
   * Accept an invitation (DELETE from DB after)
   */
  async acceptInvitation(invitationId: string): Promise<ApiResponse<AcceptSpaceInvitationResult>> {
    return api.post(`/api/space-invitations/${invitationId}/accept`, {});
  }

  /**
   * Decline an invitation (DELETE from DB)
   */
  async declineInvitation(
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/space-invitations/${invitationId}/decline`, {});
  }

  /**
   * Verify invitation by token (for email links)
   */
  async verifyInvitationToken(
    token: string
  ): Promise<ApiResponse<{
    data: {
      id: string;
      space_id: string;
      space_name: string;
      space_description?: string;
      cover_image_url?: string;
      space_type?: string;
      hourly_rate?: number;
      daily_rate?: number;
      invited_by_name: string;
      message?: string;
      expires_at: string;
    };
  }>> {
    return api.get(`/api/space-invitations/token/${token}`);
  }

  // Helper methods

  /**
   * Get pending invitations count for badge display
   */
  async getPendingInvitationsCount(): Promise<number> {
    try {
      const response = await this.getMyInvitations({ limit: 100 });
      return response.data?.count || 0;
    } catch {
      return 0;
    }
  }
}

export const spaceInvitationService = new SpaceInvitationService();
