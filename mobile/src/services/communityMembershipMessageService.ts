/**
 * Community Membership Message Service
 * Handles messaging between admins and community members
 */

import { api, ApiResponse } from './api';


export interface MembershipMessage {
  id: string;
  membership_id: string;
  sender_type: 'TALENT' | 'ORGANIZATION';
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  proposed_datetime?: string;
  datetime_type?: 'MEETING_PROPOSAL' | 'EVENT_INVITATION' | 'AVAILABILITY';
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageFilters {
  limit?: number;
  offset?: number;
}

export interface SendMessageData {
  content: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  proposed_datetime?: string;
  datetime_type?: 'MEETING_PROPOSAL' | 'EVENT_INVITATION' | 'AVAILABILITY';
}

// --- Service Class ---

class CommunityMembershipMessageService {
  /**
   * Get all messages for a membership
   */
  async getMessages(
    membershipId: string,
    filters?: MessageFilters
  ): Promise<ApiResponse<MembershipMessage[]>> {
    return api.get<MembershipMessage[]>(`/api/communities/members/${membershipId}/messages`, filters);
  }

  /**
   * Send a message in a membership conversation
   */
  async sendMessage(
    membershipId: string,
    data: SendMessageData
  ): Promise<ApiResponse<MembershipMessage>> {
    return api.post<MembershipMessage>(`/api/communities/members/${membershipId}/messages`, data);
  }

  /**
   * Mark all messages as read
   */
  async markAllAsRead(membershipId: string): Promise<ApiResponse<{ marked: number }>> {
    return api.put(`/api/communities/members/${membershipId}/messages/read-all`, {});
  }

  /**
   * Get message history with pagination
   */
  async getMessageHistory(
    membershipId: string,
    beforeMessageId?: string,
    limit: number = 50
  ): Promise<ApiResponse<MembershipMessage[]>> {
    const params: Record<string, any> = { limit };
    if (beforeMessageId) {
      params.before = beforeMessageId;
    }
    return api.get<MembershipMessage[]>(`/api/communities/members/${membershipId}/messages`, params);
  }
}

export const communityMembershipMessageService = new CommunityMembershipMessageService();
