/**
 * Application Message Service
 * Handles messaging between talents and organizations for applications
 */

import { api, ApiResponse } from './api';
import { ApplicationMessage } from '../types/models';


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
    size: number;
  }>;
  // Datetime sharing for interview scheduling
  proposed_datetime?: string; // ISO datetime string
  datetime_type?: 'INTERVIEW_PROPOSAL' | 'MEETING_REQUEST' | 'AVAILABILITY';
}

// --- Service Class ---

class ApplicationMessageService {
  /**
   * Get all messages for an application
   */
  async getMessages(
    applicationId: string,
    filters?: MessageFilters
  ): Promise<ApiResponse<ApplicationMessage[]>> {
    return api.get<ApplicationMessage[]>(`/api/applications/${applicationId}/messages`, filters);
  }

  /**
   * Send a message in an application conversation
   */
  async sendMessage(
    applicationId: string,
    data: SendMessageData
  ): Promise<ApiResponse<ApplicationMessage>> {
    return api.post<ApplicationMessage>(`/api/applications/${applicationId}/messages`, data);
  }

  /**
   * Mark all messages in an application as read
   */
  async markAllAsRead(applicationId: string): Promise<ApiResponse<{ marked: number }>> {
    return api.put(`/api/applications/${applicationId}/messages/read-all`, {});
  }

  /**
   * Get message history with pagination (for infinite scroll)
   */
  async getMessageHistory(
    applicationId: string,
    beforeMessageId?: string,
    limit: number = 20
  ): Promise<ApiResponse<ApplicationMessage[]>> {
    const params: Record<string, any> = { limit };
    if (beforeMessageId) {
      params.before = beforeMessageId;
    }
    return api.get<ApplicationMessage[]>(`/api/applications/${applicationId}/messages`, params);
  }
}

export const applicationMessageService = new ApplicationMessageService();
