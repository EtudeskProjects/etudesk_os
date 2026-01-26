/**
 * Invitation Service
 * Handles organization invitation API operations for the invited user
 */

import { api, ApiResponse } from './api';
import { OrganizationRole } from '../types/models';

export interface ReceivedInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  expires_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  // Organization info
  organization_name: string;
  organization_logo?: string;
  organization_type?: string;
  organization_sectors?: string[];
  // Inviter info
  invited_by_name?: string;
  invited_by_avatar?: string;
}

export interface AcceptInvitationData {
  member_id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
  role: OrganizationRole;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  data: AcceptInvitationData;
}

export interface InvitationByTokenResponse {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  expires_at: string;
  status: string;
  organization_name: string;
  organization_logo?: string;
  organization_type?: string;
  invited_by_name?: string;
}

/**
 * Get all pending invitations for the current user
 */
async function getReceivedInvitations(): Promise<ApiResponse<ReceivedInvitation[]>> {
  return api.get<ReceivedInvitation[]>('/api/organizations/invitations/received');
}

/**
 * Accept an invitation
 */
async function acceptInvitation(invitationId: string): Promise<ApiResponse<AcceptInvitationResponse>> {
  return api.post<AcceptInvitationResponse>(`/api/organizations/invitations/${invitationId}/accept`, {});
}

/**
 * Decline an invitation
 */
async function declineInvitation(invitationId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return api.post<{ success: boolean; message: string }>(`/api/organizations/invitations/${invitationId}/decline`, {});
}

/**
 * Get invitation details by token (for deep linking)
 */
async function getInvitationByToken(token: string): Promise<ApiResponse<InvitationByTokenResponse>> {
  return api.get<InvitationByTokenResponse>(`/api/organizations/invitations/by-token/${token}`);
}

export const invitationService = {
  getReceivedInvitations,
  acceptInvitation,
  declineInvitation,
  getInvitationByToken,
};
