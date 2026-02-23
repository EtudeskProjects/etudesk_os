/**
 * Space Constants
 * Data and utilities for bookable spaces
 * Synchronized with backend types
 */

import { Visibility, getVisibilityLabel } from '../types/models';
import { getLabel } from '../utils/labels';

// --- Space Types ---

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
  // Reunion
  SALLE_REUNION: 'SALLE_REUNION',
  SALLE_CONFERENCE: 'SALLE_CONFERENCE',
  CABINE_APPEL: 'CABINE_APPEL',
  // Atelier
  ATELIER: 'ATELIER',
  LABORATOIRE: 'LABORATOIRE',
  STUDIO: 'STUDIO',
  // Evenement
  SALLE_EVENEMENT: 'SALLE_EVENEMENT',
  ROOFTOP: 'ROOFTOP',
  TERRASSE: 'TERRASSE',
} as const;

export type SpaceType = (typeof SPACE_TYPES)[keyof typeof SPACE_TYPES];

export const getSpaceTypeLabel = (type: string): string =>
  getLabel('spaceTypes', type);

// Density: m2 per person for capacity calculation
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

// Categories for filtering
export const SPACE_CATEGORIES = {
  FORMATION: 'FORMATION',
  TRAVAIL: 'TRAVAIL',
  REUNION: 'REUNION',
  ATELIER: 'ATELIER',
  EVENEMENT: 'EVENEMENT',
} as const;

export type SpaceCategory = (typeof SPACE_CATEGORIES)[keyof typeof SPACE_CATEGORIES];

export const getSpaceCategoryLabel = (cat: string): string =>
  getLabel('spaceCategories', cat);

// Map space types to categories
export const SPACE_TYPE_CATEGORIES: Record<SpaceType, SpaceCategory> = {
  SALLE_COURS: 'FORMATION',
  SALLE_INFORMATIQUE: 'FORMATION',
  AMPHITHEATRE: 'FORMATION',
  SALLE_FORMATION: 'FORMATION',
  OPEN_SPACE: 'TRAVAIL',
  BUREAU_PRIVE: 'TRAVAIL',
  POSTE_NOMADE: 'TRAVAIL',
  SALLE_REUNION: 'REUNION',
  SALLE_CONFERENCE: 'REUNION',
  CABINE_APPEL: 'REUNION',
  ATELIER: 'ATELIER',
  LABORATOIRE: 'ATELIER',
  STUDIO: 'ATELIER',
  SALLE_EVENEMENT: 'EVENEMENT',
  ROOFTOP: 'EVENEMENT',
  TERRASSE: 'EVENEMENT',
};

// --- Space Type Data For Forms ---

export function getSpaceTypeData(): Array<{
  id: SpaceType;
  label: string;
  icon: string;
  density: number;
  category: SpaceCategory;
}> {
  return [
    // Formation
    { id: 'SALLE_COURS', label: getSpaceTypeLabel('SALLE_COURS'), icon: 'book-open', density: 2, category: 'FORMATION' },
    { id: 'SALLE_INFORMATIQUE', label: getSpaceTypeLabel('SALLE_INFORMATIQUE'), icon: 'monitor', density: 3, category: 'FORMATION' },
    { id: 'AMPHITHEATRE', label: getSpaceTypeLabel('AMPHITHEATRE'), icon: 'tv', density: 0.8, category: 'FORMATION' },
    { id: 'SALLE_FORMATION', label: getSpaceTypeLabel('SALLE_FORMATION'), icon: 'graduation-cap', density: 2.5, category: 'FORMATION' },
    // Travail
    { id: 'OPEN_SPACE', label: getSpaceTypeLabel('OPEN_SPACE'), icon: 'layout', density: 7, category: 'TRAVAIL' },
    { id: 'BUREAU_PRIVE', label: getSpaceTypeLabel('BUREAU_PRIVE'), icon: 'square', density: 12, category: 'TRAVAIL' },
    { id: 'POSTE_NOMADE', label: getSpaceTypeLabel('POSTE_NOMADE'), icon: 'laptop', density: 4, category: 'TRAVAIL' },
    // Reunion
    { id: 'SALLE_REUNION', label: getSpaceTypeLabel('SALLE_REUNION'), icon: 'users', density: 2.5, category: 'REUNION' },
    { id: 'SALLE_CONFERENCE', label: getSpaceTypeLabel('SALLE_CONFERENCE'), icon: 'mic', density: 1.5, category: 'REUNION' },
    { id: 'CABINE_APPEL', label: getSpaceTypeLabel('CABINE_APPEL'), icon: 'phone', density: 2, category: 'REUNION' },
    // Atelier
    { id: 'ATELIER', label: getSpaceTypeLabel('ATELIER'), icon: 'tool', density: 5, category: 'ATELIER' },
    { id: 'LABORATOIRE', label: getSpaceTypeLabel('LABORATOIRE'), icon: 'flask-conical', density: 8, category: 'ATELIER' },
    { id: 'STUDIO', label: getSpaceTypeLabel('STUDIO'), icon: 'camera', density: 6, category: 'ATELIER' },
    // Evenement
    { id: 'SALLE_EVENEMENT', label: getSpaceTypeLabel('SALLE_EVENEMENT'), icon: 'calendar', density: 1, category: 'EVENEMENT' },
    { id: 'ROOFTOP', label: getSpaceTypeLabel('ROOFTOP'), icon: 'sun', density: 2, category: 'EVENEMENT' },
    { id: 'TERRASSE', label: getSpaceTypeLabel('TERRASSE'), icon: 'sunset', density: 2, category: 'EVENEMENT' },
  ];
}

// --- Status ---

export const SPACE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type SpaceStatus = (typeof SPACE_STATUS)[keyof typeof SPACE_STATUS];

export const getSpaceStatusLabel = (status: string): string =>
  getLabel('spaceStatus', status);

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const getBookingStatusLabel = (status: string): string =>
  getLabel('bookingStatus', status);

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const getPaymentStatusLabel = (status: string): string =>
  getLabel('paymentStatus', status);

// --- Pricing ---

export const PRICING_TYPES = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type PricingType = (typeof PRICING_TYPES)[keyof typeof PRICING_TYPES];

export const getSpacePricingTypeLabel = (type: string): string =>
  getLabel('spacePricingTypes', type);

export const getSpacePricingUnit = (type: string): string =>
  getLabel('spacePricingUnits', type);

// --- Equipment & Amenities ---

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

export const getSpaceEquipmentLabel = (eq: string): string =>
  getLabel('spaceEquipment', eq);

export function getSpaceEquipmentData(): Array<{ id: SpaceEquipment; label: string; icon: string }> {
  return [
    { id: 'VIDEOPROJECTOR', label: getSpaceEquipmentLabel('VIDEOPROJECTOR'), icon: 'projector' },
    { id: 'WHITEBOARD', label: getSpaceEquipmentLabel('WHITEBOARD'), icon: 'square' },
    { id: 'FLIPCHART', label: getSpaceEquipmentLabel('FLIPCHART'), icon: 'clipboard' },
    { id: 'SCREEN', label: getSpaceEquipmentLabel('SCREEN'), icon: 'monitor' },
    { id: 'SOUND_SYSTEM', label: getSpaceEquipmentLabel('SOUND_SYSTEM'), icon: 'speaker' },
    { id: 'MICROPHONE', label: getSpaceEquipmentLabel('MICROPHONE'), icon: 'mic' },
    { id: 'WEBCAM', label: getSpaceEquipmentLabel('WEBCAM'), icon: 'camera' },
    { id: 'TV_SCREEN', label: getSpaceEquipmentLabel('TV_SCREEN'), icon: 'tv' },
    { id: 'VIDEO_CONFERENCE', label: getSpaceEquipmentLabel('VIDEO_CONFERENCE'), icon: 'video' },
    { id: 'COMPUTERS', label: getSpaceEquipmentLabel('COMPUTERS'), icon: 'laptop' },
    { id: 'PRINTERS', label: getSpaceEquipmentLabel('PRINTERS'), icon: 'printer' },
    { id: 'PHONE', label: getSpaceEquipmentLabel('PHONE'), icon: 'phone' },
  ];
}

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

export const getSpaceAmenityLabel = (amenity: string): string =>
  getLabel('spaceAmenities', amenity);

export function getSpaceAmenityData(): Array<{ id: SpaceAmenity; label: string; icon: string }> {
  return [
    { id: 'WIFI', label: getSpaceAmenityLabel('WIFI'), icon: 'wifi' },
    { id: 'AIR_CONDITIONING', label: getSpaceAmenityLabel('AIR_CONDITIONING'), icon: 'thermometer' },
    { id: 'HEATING', label: getSpaceAmenityLabel('HEATING'), icon: 'flame' },
    { id: 'PARKING', label: getSpaceAmenityLabel('PARKING'), icon: 'car' },
    { id: 'CAFETERIA', label: getSpaceAmenityLabel('CAFETERIA'), icon: 'coffee' },
    { id: 'KITCHEN', label: getSpaceAmenityLabel('KITCHEN'), icon: 'utensils' },
    { id: 'RESTROOMS', label: getSpaceAmenityLabel('RESTROOMS'), icon: 'droplet' },
    { id: 'RECEPTION', label: getSpaceAmenityLabel('RECEPTION'), icon: 'user' },
    { id: 'SECURITY', label: getSpaceAmenityLabel('SECURITY'), icon: 'shield' },
    { id: 'ELEVATOR', label: getSpaceAmenityLabel('ELEVATOR'), icon: 'arrow-up' },
    { id: 'NATURAL_LIGHT', label: getSpaceAmenityLabel('NATURAL_LIGHT'), icon: 'sun' },
    { id: 'SOUNDPROOF', label: getSpaceAmenityLabel('SOUNDPROOF'), icon: 'volume-x' },
  ];
}

// --- Accessibility ---

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

export const getAccessibilityFeatureLabel = (feat: string): string =>
  getLabel('spaceAccessibility', feat);

export function getAccessibilityData(): Array<{ id: AccessibilityFeature; label: string; icon: string }> {
  return [
    { id: 'WHEELCHAIR_ACCESS', label: getAccessibilityFeatureLabel('WHEELCHAIR_ACCESS'), icon: 'accessibility' },
    { id: 'ELEVATOR', label: getAccessibilityFeatureLabel('ELEVATOR'), icon: 'arrow-up' },
    { id: 'ACCESSIBLE_RESTROOM', label: getAccessibilityFeatureLabel('ACCESSIBLE_RESTROOM'), icon: 'droplet' },
    { id: 'WIDE_DOORS', label: getAccessibilityFeatureLabel('WIDE_DOORS'), icon: 'maximize' },
    { id: 'TACTILE_GUIDANCE', label: getAccessibilityFeatureLabel('TACTILE_GUIDANCE'), icon: 'navigation' },
    { id: 'HEARING_LOOP', label: getAccessibilityFeatureLabel('HEARING_LOOP'), icon: 'headphones' },
    { id: 'HANDICAP_PARKING', label: getAccessibilityFeatureLabel('HANDICAP_PARKING'), icon: 'car' },
    { id: 'BRAILLE_SIGNAGE', label: getAccessibilityFeatureLabel('BRAILLE_SIGNAGE'), icon: 'eye-off' },
  ];
}

// --- Weekdays ---

export function getWeekdays(): Array<{ id: number; label: string; short: string }> {
  return Array.from({ length: 7 }, (_, i) => ({
    id: i,
    label: getLabel('weekdays', String(i)),
    short: getLabel('weekdaysShort', String(i)),
  }));
}

// --- Visibility ---

export function getSpaceVisibilityData(): Array<{ id: Visibility; label: string; description: string }> {
  return [
    { id: 'PUBLIC', label: getVisibilityLabel('PUBLIC'), description: getLabel('opportunityVisibility', 'PUBLIC') },
    { id: 'PRIVATE', label: getVisibilityLabel('PRIVATE'), description: getLabel('opportunityVisibility', 'PRIVATE') },
  ];
}

// --- Utility Functions ---

/**
 * Calculate capacity based on surface and space type
 */
export function calculateSpaceCapacity(surfaceM2: number, spaceType: SpaceType): number {
  const density = SPACE_TYPE_DENSITY[spaceType] || 2;
  return Math.floor(surfaceM2 / density);
}

/**
 * Format price in FCFA (without decimals)
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' FCFA';
}

/**
 * Get day name from day number
 */
export function getDayName(dayOfWeek: number): string {
  return getLabel('weekdays', String(dayOfWeek));
}

/**
 * Get short day name from day number
 */
export function getDayShortName(dayOfWeek: number): string {
  return getLabel('weekdaysShort', String(dayOfWeek));
}

/**
 * Get space types by category
 */
export function getSpaceTypesByCategory(category: SpaceCategory): SpaceType[] {
  return getSpaceTypeData()
    .filter(st => st.category === category)
    .map(st => st.id);
}
