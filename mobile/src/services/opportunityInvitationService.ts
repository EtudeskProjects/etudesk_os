/**
 * Opportunity Invitation Service
 * Handles all opportunity invitation-related API calls
 */

import { api, ApiResponse } from './api';

// Types

export interface OpportunityInvitation {
  id: string;
  opportunity_id: string;
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
  opportunity_title?: string;
  opportunity_summary?: string;
  cover_image_url?: string;
  opportunity_type?: string;
  location_type?: string;
  locations?: any[];
  opportunity_status?: string;
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

export interface SendOpportunityInvitationData {
  email: string;
  name?: string;
  message?: string;
}

export interface SendOpportunityInvitationsResult {
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

export interface AcceptOpportunityInvitationResult {
  success: boolean;
  message: string;
  opportunity_id?: string;
}

// Service

class OpportunityInvitationService {
  // Admin methods (for opportunity managers)

  /**
   * Send invitations to view/apply to an opportunity
   */
  async sendInvitations(
    opportunityId: string,
    invitations: SendOpportunityInvitationData[]
  ): Promise<ApiResponse<SendOpportunityInvitationsResult>> {
    return api.post(`/api/opportunities/${opportunityId}/invitations`, { invitations });
  }

  /**
   * Get all invitations for an opportunity (admin view)
   */
  async getOpportunityInvitations(
    opportunityId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: OpportunityInvitation[];
    count: number;
  }>> {
    return api.get(`/api/opportunities/${opportunityId}/invitations`, filters);
  }

  /**
   * Cancel a pending invitation (DELETE from DB)
   */
  async cancelInvitation(
    opportunityId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/opportunities/${opportunityId}/invitations/${invitationId}`);
  }

  /**
   * Resend an invitation email
   */
  async resendInvitation(
    opportunityId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/opportunities/${opportunityId}/invitations/${invitationId}/resend`, {});
  }

  // User methods (for invitees)

  /**
   * Get invitations received by current user
   */
  async getMyInvitations(
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{
    data: OpportunityInvitation[];
    count: number;
  }>> {
    return api.get('/api/opportunity-invitations/me', filters);
  }

  /**
   * Accept an invitation (DELETE from DB after)
   */
  async acceptInvitation(invitationId: string): Promise<ApiResponse<AcceptOpportunityInvitationResult>> {
    return api.post(`/api/opportunity-invitations/${invitationId}/accept`, {});
  }

  /**
   * Decline an invitation (DELETE from DB)
   */
  async declineInvitation(
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.post(`/api/opportunity-invitations/${invitationId}/decline`, {});
  }

  /**
   * Verify invitation by token (for email links)
   */
  async verifyInvitationToken(
    token: string
  ): Promise<ApiResponse<{
    data: {
      id: string;
      opportunity_id: string;
      opportunity_title: string;
      opportunity_summary?: string;
      cover_image_url?: string;
      invited_by_name: string;
      message?: string;
      expires_at: string;
    };
  }>> {
    return api.get(`/api/opportunity-invitations/token/${token}`);
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

export const opportunityInvitationService = new OpportunityInvitationService();
