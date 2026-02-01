/**
 * Space Booking Service
 * Extended service for space bookings with detailed management capabilities
 */

import { api, ApiResponse } from './api';
import {
  SpaceBooking,
  BookingStatus,
  PaymentStatus,
  Space,
} from './spaceService';
import { Talent, Organization } from '../types/models';

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface SpaceBookingDetails extends SpaceBooking {
  talent?: Talent;
  space?: Space;
  organization?: Organization;
  messages_count?: number;
  unread_messages_count?: number;
  internal_notes?: string;
  rating?: number;
}

export interface BookingFilters {
  status?: BookingStatus;
  space_id?: string;
  talent_id?: string;
  start_date?: string;
  end_date?: string;
  payment_status?: PaymentStatus;
  limit?: number;
  offset?: number;
}

export interface UpdateBookingStatusData {
  status: BookingStatus;
  reason?: string;
}

export interface BookingExportResult {
  url: string;
  expires_at: string;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

class SpaceBookingService {
  // ─────────────────────────────────────────────────────────────
  // BOOKING DETAILS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get detailed booking information with related entities
   */
  async getBookingDetails(bookingId: string): Promise<ApiResponse<SpaceBookingDetails>> {
    return api.get<SpaceBookingDetails>(`/api/spaces/bookings/${bookingId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TALENT ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all bookings for the current talent
   */
  async getMyBookings(filters?: BookingFilters): Promise<ApiResponse<SpaceBookingDetails[]>> {
    return api.get<SpaceBookingDetails[]>('/api/spaces/bookings/my', filters);
  }

  // ─────────────────────────────────────────────────────────────
  // ORGANIZATION ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all bookings for an organization
   */
  async getOrganizationBookings(
    orgId: string,
    filters?: BookingFilters
  ): Promise<ApiResponse<SpaceBookingDetails[]>> {
    return api.get<SpaceBookingDetails[]>(`/api/spaces/bookings/organization/${orgId}`, filters);
  }

  /**
   * Get bookings for a specific space
   */
  async getSpaceBookings(
    spaceId: string,
    filters?: BookingFilters
  ): Promise<ApiResponse<SpaceBookingDetails[]>> {
    return api.get<SpaceBookingDetails[]>(`/api/spaces/${spaceId}/bookings`, filters);
  }

  // ─────────────────────────────────────────────────────────────
  // BOOKING MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Update booking status with optional reason
   */
  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    reason?: string
  ): Promise<ApiResponse<SpaceBookingDetails>> {
    return api.put<SpaceBookingDetails>(`/api/spaces/bookings/${bookingId}/status`, {
      status,
      reason,
    });
  }

  /**
   * Update internal notes for a booking (organization only)
   */
  async updateInternalNotes(
    bookingId: string,
    notes: string
  ): Promise<ApiResponse<SpaceBookingDetails>> {
    return api.put<SpaceBookingDetails>(`/api/spaces/bookings/${bookingId}/notes`, { internal_notes: notes });
  }

  /**
   * Update rating for a booking (1-5 stars)
   */
  async updateRating(bookingId: string, rating: number): Promise<ApiResponse<SpaceBookingDetails>> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    return api.put<SpaceBookingDetails>(`/api/spaces/bookings/${bookingId}/rating`, { rating });
  }

  /**
   * Delete a booking (hard delete)
   */
  async deleteBooking(bookingId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/spaces/bookings/${bookingId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // EXPORT ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Export bookings to PDF for a specific space
   */
  async exportBookingsPdf(
    spaceId: string,
    filters?: BookingFilters
  ): Promise<ApiResponse<BookingExportResult>> {
    return api.post<BookingExportResult>(`/api/spaces/${spaceId}/bookings/export`, {
      ...filters,
      format: 'pdf',
    });
  }

  /**
   * Export bookings to CSV for a specific space
   */
  async exportBookingsCsv(
    spaceId: string,
    filters?: BookingFilters
  ): Promise<ApiResponse<BookingExportResult>> {
    return api.post<BookingExportResult>(`/api/spaces/${spaceId}/bookings/export`, {
      ...filters,
      format: 'csv',
    });
  }

  /**
   * Get CSV export URL for bookings (for direct download)
   */
  getExportCsvUrl(spaceId: string, options?: BookingFilters): string {
    const baseUrl = api.getBaseUrl();
    let url = `${baseUrl}/api/spaces/${spaceId}/bookings/export-csv`;
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.start_date) params.append('start_date', options.start_date);
    if (options?.end_date) params.append('end_date', options.end_date);
    if (options?.payment_status) params.append('payment_status', options.payment_status);
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  // ─────────────────────────────────────────────────────────────
  // STATISTICS & COUNTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get booking counts by status for a space
   */
  async getBookingCounts(spaceId: string): Promise<ApiResponse<Record<BookingStatus, number>>> {
    return api.get(`/api/spaces/${spaceId}/bookings/counts`);
  }
}

export const spaceBookingService = new SpaceBookingService();
