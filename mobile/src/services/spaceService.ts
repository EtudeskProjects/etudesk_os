/**
 * Space Service
 * Handles all space-related API calls
 * Spaces are bookable rooms/areas directly linked to Organizations
 */

import { api, ApiResponse } from './api';
import type { SpaceType as ModelSpaceType, Visibility } from '../types/models';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type SpaceType = ModelSpaceType;

export type SpaceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';
export type PricingType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type PaymentMethod = 'PAYSTACK' | 'WAVE' | 'ORANGE_MONEY' | 'MTN_MONEY' | 'MOOV_MONEY' | 'CASH';

export interface SpaceAvailability {
  id: string;
  space_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time: string; // "08:00"
  end_time: string; // "18:00"
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: SpaceType;
  surface_m2: number;
  capacity: number;
  // Location
  address?: string;
  city?: string;
  region?: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  // Features
  equipment: string[];
  amenities: string[];
  sectors?: string[]; // Activity sectors (max 5)
  // Accessibility
  is_accessible: boolean;
  accessibility_features: string[];
  accessibility_notes?: string;
  // Media
  cover_image_url?: string;
  gallery_images: string[];
  // Pricing (FCFA)
  hourly_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Booking settings
  is_bookable: boolean;
  min_booking_hours: number;
  max_booking_hours: number;
  advance_booking_days: number;
  cancellation_hours: number;
  booking_rules?: string[]; // Booking rules/conditions (TEXT[])
  questions?: string[]; // Questions asked during booking (TEXT[])
  requires_approval?: boolean;
  // Contact
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  // Relations
  organization_id: string;
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  // Status & Visibility
  status: SpaceStatus;
  visibility?: Visibility; // PUBLIC, PRIVATE - defaults to PUBLIC
  // Computed
  availabilities?: SpaceAvailability[];
  active_bookings_count?: number;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface SpaceBooking {
  id: string;
  space_id: string;
  organization_id: string;
  talent_id: string;
  start_datetime: string;
  end_datetime: string;
  purpose?: string;
  attendees_count?: number;
  special_requests?: string;
  // Pricing
  pricing_type: PricingType;
  unit_price: number;
  units_count: number;
  subtotal: number;
  total_amount: number;
  // Payment
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  paid_at?: string;
  // Status
  status: BookingStatus;
  confirmed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  // Relations
  space?: Space;
  talent?: {
    id: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    avatar_url?: string;
    profile_picture_url?: string;
    email?: string;
    phone?: string;
    headline?: string;
    city?: string;
    country?: string;
    bio?: string;
  };
  // Internal notes (org only)
  internal_notes?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface SpaceFilters {
  organization_id?: string;
  type?: SpaceType;
  city?: string;
  country?: string;
  min_capacity?: number;
  max_capacity?: number;
  is_bookable?: boolean;
  is_accessible?: boolean;
  date?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSpaceData {
  name: string;
  description?: string;
  type: SpaceType;
  surface_m2: number;
  capacity?: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  equipment?: string[];
  amenities?: string[];
  sectors?: string[];
  is_accessible?: boolean;
  accessibility_features?: string[];
  accessibility_notes?: string;
  cover_image_url?: string;
  gallery_images?: string[];
  hourly_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  is_bookable?: boolean;
  min_booking_hours?: number;
  max_booking_hours?: number;
  advance_booking_days?: number;
  cancellation_hours?: number;
  booking_rules?: string[];
  questions?: string[];
  requires_approval?: boolean;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  organization_id: string;
  visibility?: Visibility;
  availabilities?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    valid_from?: string;
    valid_until?: string;
  }>;
}

export interface UpdateSpaceData extends Partial<Omit<CreateSpaceData, 'organization_id'>> {}

export interface GenerateSpaceInput {
  name: string;
  type: SpaceType;
  organization_id: string;
  existing_data?: Partial<CreateSpaceData>;
}

export interface GeneratedSpaceData {
  suggested_name?: string;
  description?: string;
  sectors?: string[];
  equipment?: string[];
  amenities?: string[];
  surface_m2?: number;
  capacity?: number;
  rules?: string;
  hourly_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  questions?: string[];
}

export interface CreateBookingData {
  space_id: string;
  start_datetime: string;
  end_datetime: string;
  purpose?: string;
  attendees_count?: number;
  special_requests?: string;
  payment_method?: PaymentMethod;
}

export interface BookingFilters {
  space_id?: string;
  organization_id?: string;
  talent_id?: string;
  status?: BookingStatus;
  payment_status?: PaymentStatus;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface AvailabilityCheckResult {
  available: boolean;
  conflicts?: Array<{
    start_datetime: string;
    end_datetime: string;
    type: 'booking' | 'unavailability';
  }>;
  pricing?: {
    pricing_type: PricingType;
    unit_price: number;
    units_count: number;
    subtotal: number;
    total: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

class SpaceService {
  /**
   * Get all spaces with optional filters
   */
  async getAll(filters?: SpaceFilters): Promise<ApiResponse<Space[]>> {
    return api.get<Space[]>('/api/spaces', filters);
  }

  /**
   * Get a single space by ID
   */
  async getById(id: string): Promise<ApiResponse<Space>> {
    return api.get<Space>(`/api/spaces/${id}`);
  }

  /**
   * Get a single space by slug
   */
  async getBySlug(slug: string): Promise<ApiResponse<Space>> {
    return api.get<Space>(`/api/spaces/slug/${slug}`);
  }

  /**
   * Get spaces for a specific organization
   */
  async getByOrganization(
    orgId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<Space[]>> {
    return api.get<Space[]>(`/api/spaces/organization/${orgId}`, filters);
  }

  /**
   * Create a new space
   */
  async create(data: CreateSpaceData): Promise<ApiResponse<Space>> {
    return api.post<Space>('/api/spaces', data);
  }

  /**
   * Update an existing space
   */
  async update(id: string, data: UpdateSpaceData): Promise<ApiResponse<Space>> {
    return api.put<Space>(`/api/spaces/${id}`, data);
  }

  /**
   * Delete a space (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/spaces/${id}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // AVAILABILITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get space availabilities
   */
  async getAvailabilities(spaceId: string): Promise<ApiResponse<SpaceAvailability[]>> {
    return api.get<SpaceAvailability[]>(`/api/spaces/${spaceId}/availabilities`);
  }

  /**
   * Set space availabilities (replaces all existing)
   */
  async setAvailabilities(
    spaceId: string,
    availabilities: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      valid_from?: string;
      valid_until?: string;
    }>
  ): Promise<ApiResponse<SpaceAvailability[]>> {
    return api.put<SpaceAvailability[]>(`/api/spaces/${spaceId}/availabilities`, { availabilities });
  }

  /**
   * Check availability for a time slot
   */
  async checkAvailability(
    spaceId: string,
    startDatetime: string,
    endDatetime: string
  ): Promise<ApiResponse<AvailabilityCheckResult>> {
    return api.get<AvailabilityCheckResult>(`/api/spaces/${spaceId}/availability-check`, {
      start_datetime: startDatetime,
      end_datetime: endDatetime,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOKING MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a booking
   */
  async createBooking(spaceId: string, data: Omit<CreateBookingData, 'space_id'>): Promise<ApiResponse<SpaceBooking>> {
    return api.post<SpaceBooking>(`/api/spaces/${spaceId}/book`, data);
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId: string): Promise<ApiResponse<SpaceBooking>> {
    return api.get<SpaceBooking>(`/api/spaces/bookings/${bookingId}`);
  }

  /**
   * Get bookings for organization
   */
  async getOrganizationBookings(orgId: string, filters?: BookingFilters): Promise<ApiResponse<SpaceBooking[]>> {
    return api.get<SpaceBooking[]>(`/api/spaces/bookings/organization/${orgId}`, filters);
  }

  /**
   * Get my bookings (as talent)
   */
  async getMyBookings(filters?: BookingFilters): Promise<ApiResponse<SpaceBooking[]>> {
    return api.get<SpaceBooking[]>('/api/spaces/bookings/my', filters);
  }

  /**
   * Confirm a booking (organization action)
   */
  async confirmBooking(bookingId: string): Promise<ApiResponse<SpaceBooking>> {
    return api.post<SpaceBooking>(`/api/spaces/bookings/${bookingId}/confirm`);
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<ApiResponse<SpaceBooking>> {
    return api.post<SpaceBooking>(`/api/spaces/bookings/${bookingId}/cancel`, { reason });
  }

  /**
   * Complete a booking
   */
  async completeBooking(bookingId: string, rating?: number, review?: string): Promise<ApiResponse<SpaceBooking>> {
    return api.post<SpaceBooking>(`/api/spaces/bookings/${bookingId}/complete`, { rating, review });
  }

  /**
   * Mark booking as no-show
   */
  async markNoShow(bookingId: string): Promise<ApiResponse<SpaceBooking>> {
    return api.post<SpaceBooking>(`/api/spaces/bookings/${bookingId}/no-show`);
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<ApiResponse<SpaceBooking>> {
    return api.put<SpaceBooking>(`/api/spaces/bookings/${bookingId}/status`, { status });
  }

  /**
   * Update booking internal notes
   */
  async updateBookingNotes(bookingId: string, notes: string): Promise<ApiResponse<SpaceBooking>> {
    return api.put<SpaceBooking>(`/api/spaces/bookings/${bookingId}/notes`, { internal_notes: notes });
  }

  /**
   * Delete a booking
   */
  async deleteBooking(bookingId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return api.delete(`/api/spaces/bookings/${bookingId}`);
  }

  /**
   * Get bookings for a specific space (for organization management)
   */
  async getSpaceBookings(spaceId: string, filters?: BookingFilters): Promise<ApiResponse<SpaceBooking[]>> {
    return api.get<SpaceBooking[]>(`/api/spaces/${spaceId}/bookings`, filters);
  }

  /**
   * Generate space suggestions using AI
   * Requires: name, type, organization_id
   */
  async generate(input: GenerateSpaceInput): Promise<ApiResponse<GeneratedSpaceData>> {
    return api.post<GeneratedSpaceData>('/api/spaces/generate', input, { timeout: 60000 });
  }

  /**
   * Increment view count for a space
   */
  async incrementViews(id: string): Promise<ApiResponse<{ views_count: number }>> {
    return api.post<{ views_count: number }>(`/api/spaces/${id}/views`);
  }
}

export const spaceService = new SpaceService();
