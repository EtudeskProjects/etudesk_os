/**
 * Space Constants
 * Data and utilities for bookable spaces
 * Synchronized with backend types
 */

import { Visibility, VISIBILITY_LABELS } from '../types/models';

// ═══════════════════════════════════════════════════════════════
// SPACE TYPES
// ═══════════════════════════════════════════════════════════════

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

export const SPACE_CATEGORY_LABELS: Record<SpaceCategory, string> = {
  FORMATION: 'Formation',
  TRAVAIL: 'Travail',
  REUNION: 'Reunion',
  ATELIER: 'Atelier',
  EVENEMENT: 'Evenement',
};

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

// ═══════════════════════════════════════════════════════════════
// SPACE TYPE DATA FOR FORMS
// ═══════════════════════════════════════════════════════════════

export const SPACE_TYPE_DATA: Array<{
  id: SpaceType;
  label: string;
  icon: string;
  density: number;
  category: SpaceCategory;
}> = [
  // Formation
  { id: 'SALLE_COURS', label: SPACE_TYPE_LABELS.SALLE_COURS, icon: 'book-open', density: 2, category: 'FORMATION' },
  { id: 'SALLE_INFORMATIQUE', label: SPACE_TYPE_LABELS.SALLE_INFORMATIQUE, icon: 'monitor', density: 3, category: 'FORMATION' },
  { id: 'AMPHITHEATRE', label: SPACE_TYPE_LABELS.AMPHITHEATRE, icon: 'tv', density: 0.8, category: 'FORMATION' },
  { id: 'SALLE_FORMATION', label: SPACE_TYPE_LABELS.SALLE_FORMATION, icon: 'graduation-cap', density: 2.5, category: 'FORMATION' },
  // Travail
  { id: 'OPEN_SPACE', label: SPACE_TYPE_LABELS.OPEN_SPACE, icon: 'layout', density: 7, category: 'TRAVAIL' },
  { id: 'BUREAU_PRIVE', label: SPACE_TYPE_LABELS.BUREAU_PRIVE, icon: 'square', density: 12, category: 'TRAVAIL' },
  { id: 'POSTE_NOMADE', label: SPACE_TYPE_LABELS.POSTE_NOMADE, icon: 'laptop', density: 4, category: 'TRAVAIL' },
  // Reunion
  { id: 'SALLE_REUNION', label: SPACE_TYPE_LABELS.SALLE_REUNION, icon: 'users', density: 2.5, category: 'REUNION' },
  { id: 'SALLE_CONFERENCE', label: SPACE_TYPE_LABELS.SALLE_CONFERENCE, icon: 'mic', density: 1.5, category: 'REUNION' },
  { id: 'CABINE_APPEL', label: SPACE_TYPE_LABELS.CABINE_APPEL, icon: 'phone', density: 2, category: 'REUNION' },
  // Atelier
  { id: 'ATELIER', label: SPACE_TYPE_LABELS.ATELIER, icon: 'tool', density: 5, category: 'ATELIER' },
  { id: 'LABORATOIRE', label: SPACE_TYPE_LABELS.LABORATOIRE, icon: 'flask-conical', density: 8, category: 'ATELIER' },
  { id: 'STUDIO', label: SPACE_TYPE_LABELS.STUDIO, icon: 'camera', density: 6, category: 'ATELIER' },
  // Evenement
  { id: 'SALLE_EVENEMENT', label: SPACE_TYPE_LABELS.SALLE_EVENEMENT, icon: 'calendar', density: 1, category: 'EVENEMENT' },
  { id: 'ROOFTOP', label: SPACE_TYPE_LABELS.ROOFTOP, icon: 'sun', density: 2, category: 'EVENEMENT' },
  { id: 'TERRASSE', label: SPACE_TYPE_LABELS.TERRASSE, icon: 'sunset', density: 2, category: 'EVENEMENT' },
];

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════

export const SPACE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type SpaceStatus = (typeof SPACE_STATUS)[keyof typeof SPACE_STATUS];

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  MAINTENANCE: 'Maintenance',
};

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmee',
  CANCELLED: 'Annulee',
  COMPLETED: 'Terminee',
  NO_SHOW: 'Absent',
};

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
  PARTIAL: 'Partiel',
  PAID: 'Paye',
  REFUNDED: 'Rembourse',
};

// ═══════════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════════

export const PRICING_TYPES = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type PricingType = (typeof PRICING_TYPES)[keyof typeof PRICING_TYPES];

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  HOURLY: 'A l\'heure',
  DAILY: 'A la journee',
  WEEKLY: 'A la semaine',
  MONTHLY: 'Au mois',
};

export const PRICING_TYPE_UNITS: Record<PricingType, string> = {
  HOURLY: '/heure',
  DAILY: '/jour',
  WEEKLY: '/semaine',
  MONTHLY: '/mois',
};

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT & AMENITIES
// ═══════════════════════════════════════════════════════════════

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

export const SPACE_EQUIPMENT_LABELS: Record<SpaceEquipment, string> = {
  VIDEOPROJECTOR: 'Vidéoprojecteur',
  WHITEBOARD: 'Tableau blanc',
  FLIPCHART: 'Paperboard',
  SCREEN: 'Écran',
  SOUND_SYSTEM: 'Système audio',
  MICROPHONE: 'Microphone',
  WEBCAM: 'Webcam',
  TV_SCREEN: 'Écran TV',
  VIDEO_CONFERENCE: 'Vidéoconférence',
  COMPUTERS: 'Ordinateurs',
  PRINTERS: 'Imprimantes',
  PHONE: 'Téléphone',
};

export const SPACE_EQUIPMENT_DATA: Array<{ id: SpaceEquipment; label: string; icon: string }> = [
  { id: 'VIDEOPROJECTOR', label: SPACE_EQUIPMENT_LABELS.VIDEOPROJECTOR, icon: 'projector' },
  { id: 'WHITEBOARD', label: SPACE_EQUIPMENT_LABELS.WHITEBOARD, icon: 'square' },
  { id: 'FLIPCHART', label: SPACE_EQUIPMENT_LABELS.FLIPCHART, icon: 'clipboard' },
  { id: 'SCREEN', label: SPACE_EQUIPMENT_LABELS.SCREEN, icon: 'monitor' },
  { id: 'SOUND_SYSTEM', label: SPACE_EQUIPMENT_LABELS.SOUND_SYSTEM, icon: 'speaker' },
  { id: 'MICROPHONE', label: SPACE_EQUIPMENT_LABELS.MICROPHONE, icon: 'mic' },
  { id: 'WEBCAM', label: SPACE_EQUIPMENT_LABELS.WEBCAM, icon: 'camera' },
  { id: 'TV_SCREEN', label: SPACE_EQUIPMENT_LABELS.TV_SCREEN, icon: 'tv' },
  { id: 'VIDEO_CONFERENCE', label: SPACE_EQUIPMENT_LABELS.VIDEO_CONFERENCE, icon: 'video' },
  { id: 'COMPUTERS', label: SPACE_EQUIPMENT_LABELS.COMPUTERS, icon: 'laptop' },
  { id: 'PRINTERS', label: SPACE_EQUIPMENT_LABELS.PRINTERS, icon: 'printer' },
  { id: 'PHONE', label: SPACE_EQUIPMENT_LABELS.PHONE, icon: 'phone' },
];

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

export const SPACE_AMENITY_LABELS: Record<SpaceAmenity, string> = {
  WIFI: 'Wi-Fi',
  AIR_CONDITIONING: 'Climatisation',
  HEATING: 'Chauffage',
  PARKING: 'Parking',
  CAFETERIA: 'Cafétéria',
  KITCHEN: 'Cuisine',
  RESTROOMS: 'Sanitaires',
  RECEPTION: 'Accueil',
  SECURITY: 'Sécurité',
  ELEVATOR: 'Ascenseur',
  NATURAL_LIGHT: 'Lumière naturelle',
  SOUNDPROOF: 'Insonorisation',
};

export const SPACE_AMENITY_DATA: Array<{ id: SpaceAmenity; label: string; icon: string }> = [
  { id: 'WIFI', label: SPACE_AMENITY_LABELS.WIFI, icon: 'wifi' },
  { id: 'AIR_CONDITIONING', label: SPACE_AMENITY_LABELS.AIR_CONDITIONING, icon: 'thermometer' },
  { id: 'HEATING', label: SPACE_AMENITY_LABELS.HEATING, icon: 'flame' },
  { id: 'PARKING', label: SPACE_AMENITY_LABELS.PARKING, icon: 'car' },
  { id: 'CAFETERIA', label: SPACE_AMENITY_LABELS.CAFETERIA, icon: 'coffee' },
  { id: 'KITCHEN', label: SPACE_AMENITY_LABELS.KITCHEN, icon: 'utensils' },
  { id: 'RESTROOMS', label: SPACE_AMENITY_LABELS.RESTROOMS, icon: 'droplet' },
  { id: 'RECEPTION', label: SPACE_AMENITY_LABELS.RECEPTION, icon: 'user' },
  { id: 'SECURITY', label: SPACE_AMENITY_LABELS.SECURITY, icon: 'shield' },
  { id: 'ELEVATOR', label: SPACE_AMENITY_LABELS.ELEVATOR, icon: 'arrow-up' },
  { id: 'NATURAL_LIGHT', label: SPACE_AMENITY_LABELS.NATURAL_LIGHT, icon: 'sun' },
  { id: 'SOUNDPROOF', label: SPACE_AMENITY_LABELS.SOUNDPROOF, icon: 'volume-x' },
];

// ═══════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════

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

export const ACCESSIBILITY_FEATURE_LABELS: Record<AccessibilityFeature, string> = {
  WHEELCHAIR_ACCESS: 'Acces fauteuil roulant',
  ELEVATOR: 'Ascenseur accessible',
  ACCESSIBLE_RESTROOM: 'Toilettes accessibles',
  WIDE_DOORS: 'Portes larges (>90cm)',
  TACTILE_GUIDANCE: 'Guidage tactile',
  HEARING_LOOP: 'Boucle auditive',
  HANDICAP_PARKING: 'Parking PMR',
  BRAILLE_SIGNAGE: 'Signalisation braille',
};

export const ACCESSIBILITY_DATA: Array<{ id: AccessibilityFeature; label: string; icon: string }> = [
  { id: 'WHEELCHAIR_ACCESS', label: ACCESSIBILITY_FEATURE_LABELS.WHEELCHAIR_ACCESS, icon: 'accessibility' },
  { id: 'ELEVATOR', label: ACCESSIBILITY_FEATURE_LABELS.ELEVATOR, icon: 'arrow-up' },
  { id: 'ACCESSIBLE_RESTROOM', label: ACCESSIBILITY_FEATURE_LABELS.ACCESSIBLE_RESTROOM, icon: 'droplet' },
  { id: 'WIDE_DOORS', label: ACCESSIBILITY_FEATURE_LABELS.WIDE_DOORS, icon: 'maximize' },
  { id: 'TACTILE_GUIDANCE', label: ACCESSIBILITY_FEATURE_LABELS.TACTILE_GUIDANCE, icon: 'navigation' },
  { id: 'HEARING_LOOP', label: ACCESSIBILITY_FEATURE_LABELS.HEARING_LOOP, icon: 'headphones' },
  { id: 'HANDICAP_PARKING', label: ACCESSIBILITY_FEATURE_LABELS.HANDICAP_PARKING, icon: 'car' },
  { id: 'BRAILLE_SIGNAGE', label: ACCESSIBILITY_FEATURE_LABELS.BRAILLE_SIGNAGE, icon: 'eye-off' },
];

// ═══════════════════════════════════════════════════════════════
// WEEKDAYS
// ═══════════════════════════════════════════════════════════════

export const WEEKDAYS = [
  { id: 0, label: 'Dimanche', short: 'Dim' },
  { id: 1, label: 'Lundi', short: 'Lun' },
  { id: 2, label: 'Mardi', short: 'Mar' },
  { id: 3, label: 'Mercredi', short: 'Mer' },
  { id: 4, label: 'Jeudi', short: 'Jeu' },
  { id: 5, label: 'Vendredi', short: 'Ven' },
  { id: 6, label: 'Samedi', short: 'Sam' },
] as const;

// ═══════════════════════════════════════════════════════════════
// VISIBILITY
// ═══════════════════════════════════════════════════════════════

export const SPACE_VISIBILITY_DATA: Array<{ id: Visibility; label: string; description: string }> = [
  { id: 'PUBLIC', label: VISIBILITY_LABELS.PUBLIC, description: 'Visible dans l\'exploration et la recherche' },
  { id: 'PRIVATE', label: VISIBILITY_LABELS.PRIVATE, description: 'Seuls les membres de l\'organisation peuvent voir' },
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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
  const day = WEEKDAYS.find(d => d.id === dayOfWeek);
  return day?.label || '';
}

/**
 * Get short day name from day number
 */
export function getDayShortName(dayOfWeek: number): string {
  const day = WEEKDAYS.find(d => d.id === dayOfWeek);
  return day?.short || '';
}

/**
 * Get space types by category
 */
export function getSpaceTypesByCategory(category: SpaceCategory): SpaceType[] {
  return SPACE_TYPE_DATA
    .filter(st => st.category === category)
    .map(st => st.id);
}
