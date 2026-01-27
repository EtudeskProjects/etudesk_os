/**
 * Space Booking Message Service
 * Handles messaging between talents and organizations for space bookings
 */

import { api, ApiResponse } from './api';

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface BookingMessageAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface BookingMessage {
  id: string;
  booking_id: string;
  sender_type: 'talent' | 'organization' | 'TALENT' | 'ORGANIZATION';
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  attachments?: BookingMessageAttachment[];
  proposed_datetime?: string; // ISO datetime string for datetime proposals
  datetime_type?: 'BOOKING_PROPOSAL' | 'RESCHEDULE_REQUEST' | 'AVAILABILITY';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface BookingMessageFilters {
  limit?: number;
  offset?: number;
}

export interface SendBookingMessageData {
  content: string;
  attachments?: BookingMessageAttachment[];
  proposed_datetime?: string;
  datetime_type?: 'BOOKING_PROPOSAL' | 'RESCHEDULE_REQUEST' | 'AVAILABILITY';
}

// ═══════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

class SpaceBookingMessageService {
  /**
   * Get all messages for a booking
   */
  async getMessages(
    bookingId: string,
    filters?: BookingMessageFilters
  ): Promise<ApiResponse<BookingMessage[]>> {
    return api.get<BookingMessage[]>(`/api/spaces/bookings/${bookingId}/messages`, filters);
  }

  /**
   * Send a message in a booking conversation
   */
  async sendMessage(
    bookingId: string,
    data: SendBookingMessageData
  ): Promise<ApiResponse<BookingMessage>> {
    return api.post<BookingMessage>(`/api/spaces/bookings/${bookingId}/messages`, data);
  }

  /**
   * Mark all messages in a booking as read
   */
  async markAsRead(bookingId: string): Promise<ApiResponse<{ marked: number }>> {
    return api.put(`/api/spaces/bookings/${bookingId}/messages/read-all`, {});
  }

  /**
   * Mark a specific message as read
   */
  async markMessageAsRead(messageId: string): Promise<ApiResponse<BookingMessage>> {
    return api.put<BookingMessage>(`/api/spaces/booking-messages/${messageId}/read`, {});
  }

  /**
   * Get message history with pagination (for infinite scroll)
   */
  async getMessageHistory(
    bookingId: string,
    beforeMessageId?: string,
    limit: number = 50
  ): Promise<ApiResponse<BookingMessage[]>> {
    const params: Record<string, any> = { limit };
    if (beforeMessageId) {
      params.before = beforeMessageId;
    }
    return api.get<BookingMessage[]>(`/api/spaces/bookings/${bookingId}/messages`, params);
  }

  /**
   * Get unread messages count for a booking
   */
  async getUnreadCount(bookingId: string): Promise<ApiResponse<{ count: number }>> {
    return api.get(`/api/spaces/bookings/${bookingId}/messages/unread-count`);
  }
}

export const spaceBookingMessageService = new SpaceBookingMessageService();
