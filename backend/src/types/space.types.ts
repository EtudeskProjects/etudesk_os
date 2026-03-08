/**
 * Space Types
 * Bookable spaces directly linked to Organizations
 */

// --- Enums & Constants ---

export const SPACE_TYPES = {
  // Formation
  SALLE_COURS: 'SALLE_COURS',
  SALLE_INFORMATIQUE: 'SALLE_INFORMATIQUE',
  AMPHITHEATRE: 'AMPHITHEATRE',
  SALLE_FORMATION: 'SALLE_FORMATION',

  // Travail
  OPEN_SPACE: 'OPEN_SPACE',
  BUREAU_PRIVE: 'BUREAU_PRIVE',
  POSTE_NOMADE: 'POSTE_NOMADE',

  // Réunion
  SALLE_REUNION: 'SALLE_REUNION',
  SALLE_CONFERENCE: 'SALLE_CONFERENCE',
  CABINE_APPEL: 'CABINE_APPEL',

  // Atelier
  ATELIER: 'ATELIER',
  LABORATOIRE: 'LABORATOIRE',
  STUDIO: 'STUDIO',

  // Événement
  SALLE_EVENEMENT: 'SALLE_EVENEMENT',
  ROOFTOP: 'ROOFTOP',
  TERRASSE: 'TERRASSE',
} as const;

export type SpaceType = (typeof SPACE_TYPES)[keyof typeof SPACE_TYPES];

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  SALLE_COURS: 'Salle de cours',
  SALLE_INFORMATIQUE: 'Salle informatique',
  AMPHITHEATRE: 'Amphithéâtre',
  SALLE_FORMATION: 'Salle de formation',
  OPEN_SPACE: 'Open space',
  BUREAU_PRIVE: 'Bureau privé',
  POSTE_NOMADE: 'Poste nomade',
  SALLE_REUNION: 'Salle de réunion',
  SALLE_CONFERENCE: 'Salle de conférence',
  CABINE_APPEL: 'Cabine d\'appel',
  ATELIER: 'Atelier',
  LABORATOIRE: 'Laboratoire',
  STUDIO: 'Studio',
  SALLE_EVENEMENT: 'Salle événementielle',
  ROOFTOP: 'Rooftop',
  TERRASSE: 'Terrasse',
};

// Density: m² per person for capacity calculation
export const SPACE_TYPE_DENSITY: Record<SpaceType, number> = {
  SALLE_COURS: 2,
  SALLE_INFORMATIQUE: 3,
  AMPHITHEATRE: 0.8,
  SALLE_FORMATION: 2.5,
  OPEN_SPACE: 7,
  BUREAU_PRIVE: 12,
  POSTE_NOMADE: 4,
  SALLE_REUNION: 2.5,
  SALLE_CONFERENCE: 1.5,
  CABINE_APPEL: 2,
  ATELIER: 5,
  LABORATOIRE: 8,
  STUDIO: 6,
  SALLE_EVENEMENT: 1,
  ROOFTOP: 2,
  TERRASSE: 2,
};

export const SPACE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type SpaceStatus = (typeof SPACE_STATUS)[keyof typeof SPACE_STATUS];

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_METHOD = {
  PAYSTACK: 'PAYSTACK',
  WAVE: 'WAVE',
  ORANGE_MONEY: 'ORANGE_MONEY',
  MTN_MONEY: 'MTN_MONEY',
  MOOV_MONEY: 'MOOV_MONEY',
  CASH: 'CASH',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PRICING_TYPE = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type PricingType = (typeof PRICING_TYPE)[keyof typeof PRICING_TYPE];

export const UNAVAILABILITY_REASON = {
  MAINTENANCE: 'MAINTENANCE',
  HOLIDAY: 'HOLIDAY',
  PRIVATE_EVENT: 'PRIVATE_EVENT',
  OTHER: 'OTHER',
} as const;

export type UnavailabilityReason = (typeof UNAVAILABILITY_REASON)[keyof typeof UNAVAILABILITY_REASON];

export const SPACE_EQUIPMENT = [
  'VIDEOPROJECTOR',
  'WHITEBOARD',
  'FLIPCHART',
  'SCREEN',
  'SOUND_SYSTEM',
  'MICROPHONE',
  'WEBCAM',
  'TV_SCREEN',
  'VIDEO_CONFERENCE',
  'COMPUTERS',
  'PRINTERS',
  'PHONE',
] as const;

export type SpaceEquipment = (typeof SPACE_EQUIPMENT)[number];

export const SPACE_AMENITIES = [
  'WIFI',
  'AIR_CONDITIONING',
  'HEATING',
  'PARKING',
  'CAFETERIA',
  'KITCHEN',
  'RESTROOMS',
  'RECEPTION',
  'SECURITY',
  'ELEVATOR',
  'NATURAL_LIGHT',
  'SOUNDPROOF',
] as const;

export type SpaceAmenity = (typeof SPACE_AMENITIES)[number];

export const ACCESSIBILITY_FEATURES = [
  'WHEELCHAIR_ACCESS',
  'ELEVATOR',
  'ACCESSIBLE_RESTROOM',
  'WIDE_DOORS',
  'TACTILE_GUIDANCE',
  'HEARING_LOOP',
  'HANDICAP_PARKING',
  'BRAILLE_SIGNAGE',
] as const;

export type AccessibilityFeature = (typeof ACCESSIBILITY_FEATURES)[number];


export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;

  // Type
  type: SpaceType;

  // Physical
  surface_m2: number;
  capacity: number;
  floor_number: number;

  // Location
  address?: string;
  city?: string;
  region?: string;
  country: string;
  coordinates?: { lat: number; lng: number };

  // Features
  equipment: string[];
  amenities: string[];
  sectors: string[]; // Activity sectors (max 5)

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
  deposit_amount?: number;
  payment_collection_info?: string;

  // Booking settings
  is_bookable: boolean;
  min_booking_hours: number;
  max_booking_hours: number;
  advance_booking_days: number;
  cancellation_hours: number;

  // Contact
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;

  // Relations
  organization_id: string;
  created_by?: string;

  // Status
  status: SpaceStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Computed (from joins)
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  availabilities?: SpaceAvailability[];
  active_bookings_count?: number;
}

export interface SpaceAvailability {
  id: string;
  space_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time: string; // "08:00"
  end_time: string; // "18:00"
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpaceUnavailability {
  id: string;
  space_id: string;
  start_datetime: string;
  end_datetime: string;
  reason?: UnavailabilityReason;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface SpaceBooking {
  id: string;

  // Relations
  space_id: string;
  organization_id: string;
  talent_id: string;

  // Period
  start_datetime: string;
  end_datetime: string;

  // Details
  purpose?: string;
  attendees_count?: number;
  special_requests?: string;

  // Pricing
  pricing_type: PricingType;
  unit_price: number;
  units_count: number;
  subtotal: number;
  deposit_amount: number;
  total_amount: number;

  // Payment
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  paid_at?: string;

  // Status
  status: BookingStatus;
  confirmed_at?: string;
  confirmed_by?: string;

  // Cancellation
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  refund_amount?: number;

  // Completion
  completed_at?: string;
  rating?: number;
  review?: string;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Computed (from joins)
  space?: Space;
  talent?: {
    id: string;
    first_name?: string;
    last_name?: string;
    display_name: string;
    avatar_url?: string;
    email?: string;
    phone?: string;
  };
}

// --- Api Request/Response Types ---

export interface CreateSpaceInput {
  name: string;
  description?: string;
  type: SpaceType;
  surface_m2: number;
  capacity?: number; // Auto-calculated if not provided
  floor_number?: number;
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
  deposit_amount?: number;
  is_bookable?: boolean;
  min_booking_hours?: number;
  max_booking_hours?: number;
  advance_booking_days?: number;
  cancellation_hours?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  organization_id: string;
  availabilities?: CreateAvailabilityInput[];
  booking_rules?: string[];
  questions?: string[];
  requires_approval?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  payment_collection_info?: string;
}

export interface UpdateSpaceInput extends Partial<Omit<CreateSpaceInput, 'organization_id'>> {}

export interface CreateAvailabilityInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  valid_from?: string;
  valid_until?: string;
}

export interface CreateBookingInput {
  space_id: string;
  start_datetime: string;
  end_datetime: string;
  purpose?: string;
  attendees_count?: number;
  special_requests?: string;
  payment_method?: PaymentMethod;
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
  date?: string; // Check availability for this date
  limit?: number;
  offset?: number;
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

// --- Utility Functions ---

export function calculateCapacity(surfaceM2: number, spaceType: SpaceType): number {
  const density = SPACE_TYPE_DENSITY[spaceType] || 2;
  return Math.floor(surfaceM2 / density);
}

export function calculateBookingPrice(
  space: Space,
  startDatetime: Date,
  endDatetime: Date
): {
  pricingType: PricingType;
  unitPrice: number;
  unitsCount: number;
  subtotal: number;
  deposit: number;
  total: number;
} {
  const hours = (endDatetime.getTime() - startDatetime.getTime()) / (1000 * 60 * 60);
  const days = hours / 24;

  let pricingType: PricingType;
  let unitPrice: number;
  let unitsCount: number;

  // Determine best pricing
  if (days >= 28 && space.monthly_rate) {
    pricingType = 'MONTHLY';
    unitPrice = space.monthly_rate;
    unitsCount = Math.ceil(days / 30);
  } else if (days >= 7 && space.weekly_rate) {
    pricingType = 'WEEKLY';
    unitPrice = space.weekly_rate;
    unitsCount = Math.ceil(days / 7);
  } else if (days >= 1 && space.daily_rate) {
    pricingType = 'DAILY';
    unitPrice = space.daily_rate;
    unitsCount = Math.ceil(days);
  } else {
    pricingType = 'HOURLY';
    unitPrice = space.hourly_rate || 0;
    unitsCount = Math.ceil(hours);
  }

  const subtotal = unitPrice * unitsCount;
  const deposit = space.deposit_amount || 0;
  const total = subtotal + deposit;

  return { pricingType, unitPrice, unitsCount, subtotal, deposit, total };
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' FCFA';
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[dayOfWeek] || '';
}
