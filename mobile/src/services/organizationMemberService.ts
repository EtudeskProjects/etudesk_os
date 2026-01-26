/**
 * Organization Member Service
 * Handles organization member management API operations
 */

import { api, ApiResponse } from './api';
import { OrganizationMember, OrganizationInvitation, OrganizationRole } from '../types/models';

export interface InviteMemberData {
  email: string;
  role?: OrganizationRole;
}

export interface UpdateMemberData {
  role?: OrganizationRole;
}

/**
 * Get all members of an organization
 */
async function getMembers(orgId: string): Promise<ApiResponse<OrganizationMember[]>> {
  return api.get<OrganizationMember[]>(`/api/organizations/${orgId}/members`);
}

/**
 * Get pending invitations for an organization
 */
async function getInvitations(orgId: string): Promise<ApiResponse<OrganizationInvitation[]>> {
  return api.get<OrganizationInvitation[]>(`/api/organizations/${orgId}/invitations`);
}

/**
 * Invite a member to the organization
 */
async function inviteMember(orgId: string, data: InviteMemberData): Promise<ApiResponse<OrganizationInvitation>> {
  return api.post<OrganizationInvitation>(`/api/organizations/${orgId}/invitations`, data);
}

/**
 * Update a member's role/permissions
 */
async function updateMember(orgId: string, memberId: string, data: UpdateMemberData): Promise<ApiResponse<OrganizationMember>> {
  return api.put<OrganizationMember>(`/api/organizations/${orgId}/members/${memberId}`, data);
}

/**
 * Remove a member from the organization
 */
async function removeMember(orgId: string, memberId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return api.delete<{ success: boolean; message: string }>(`/api/organizations/${orgId}/members/${memberId}`);
}

/**
 * Cancel an invitation
 */
async function cancelInvitation(orgId: string, invitationId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return api.delete<{ success: boolean; message: string }>(`/api/organizations/${orgId}/invitations/${invitationId}`);
}

/**
 * Resend an invitation
 */
async function resendInvitation(orgId: string, invitationId: string): Promise<ApiResponse<OrganizationInvitation>> {
  return api.post<OrganizationInvitation>(`/api/organizations/${orgId}/invitations/${invitationId}/resend`, {});
}

export const organizationMemberService = {
  getMembers,
  getInvitations,
  inviteMember,
  updateMember,
  removeMember,
  cancelInvitation,
  resendInvitation,
};
