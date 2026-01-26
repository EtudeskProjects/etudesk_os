// Données pour les hubs/espaces - synchronisées avec les modèles

import {
  HUB_TYPES,
  HUB_TYPE_LABELS,
  ACCESS_TYPES,
  ACCESS_TYPE_LABELS,
  HUB_USAGE_CATEGORIES,
  HUB_USAGE_CATEGORY_LABELS,
  SPACE_TYPES,
  SPACE_TYPE_LABELS,
  SAFETY_EQUIPMENT,
  SAFETY_EQUIPMENT_LABELS,
  ACCESSIBILITY_FEATURES,
  ACCESSIBILITY_FEATURE_LABELS,
  PRICING_TYPES,
  PRICING_TYPE_LABELS,
  HubType,
  AccessType,
  HubUsageCategory,
  SpaceType,
  SafetyEquipment,
  AccessibilityFeature,
  PricingType,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// OPTIONS FORMATÉES POUR LES FORMULAIRES - TYPES DE HUB
// ═══════════════════════════════════════════════════════════════

export const HUB_TYPE_DATA: Array<{ id: HubType; label: string; description: string; icon: string }> = [
  { id: 'COWORKING', label: HUB_TYPE_LABELS.COWORKING, description: 'Espace de travail partagé', icon: 'briefcase' },
  { id: 'INCUBATOR', label: HUB_TYPE_LABELS.INCUBATOR, description: 'Accompagnement de startups', icon: 'rocket' },
  { id: 'ACCELERATOR', label: HUB_TYPE_LABELS.ACCELERATOR, description: 'Programme d\'accélération', icon: 'zap' },
  { id: 'LAB', label: HUB_TYPE_LABELS.LAB, description: 'Laboratoire d\'innovation', icon: 'flask' },
  { id: 'MAKERSPACE', label: HUB_TYPE_LABELS.MAKERSPACE, description: 'Atelier de fabrication', icon: 'tool' },
  { id: 'TRAINING_CENTER', label: HUB_TYPE_LABELS.TRAINING_CENTER, description: 'Centre de formation', icon: 'book-open' },
  { id: 'CERTIFICATION_CENTER', label: HUB_TYPE_LABELS.CERTIFICATION_CENTER, description: 'Certification et examens', icon: 'award' },
  { id: 'UNIVERSITY', label: HUB_TYPE_LABELS.UNIVERSITY, description: 'Campus universitaire', icon: 'graduation-cap' },
  { id: 'VIRTUAL_COMMUNITY', label: HUB_TYPE_LABELS.VIRTUAL_COMMUNITY, description: 'Espace 100% en ligne', icon: 'globe' },
];

export const HUB_ACCESS_TYPE_DATA: Array<{ id: AccessType; label: string; description: string }> = [
  { id: 'PUBLIC', label: ACCESS_TYPE_LABELS.PUBLIC, description: 'Accès libre sans inscription' },
  { id: 'MEMBERSHIP', label: ACCESS_TYPE_LABELS.MEMBERSHIP, description: 'Abonnement ou adhésion requise' },
];

// ═══════════════════════════════════════════════════════════════
// CATÉGORIES D'USAGE
// ═══════════════════════════════════════════════════════════════

export const HUB_USAGE_DATA: Array<{ id: HubUsageCategory; label: string; description: string; icon: string }> = [
  { id: 'FORMATION', label: HUB_USAGE_CATEGORY_LABELS.FORMATION, description: 'Cours, formations, certifications', icon: 'graduation-cap' },
  { id: 'TRAVAIL', label: HUB_USAGE_CATEGORY_LABELS.TRAVAIL, description: 'Coworking, bureaux partagés', icon: 'briefcase' },
  { id: 'REUNION', label: HUB_USAGE_CATEGORY_LABELS.REUNION, description: 'Salles de conférence, séminaires', icon: 'users' },
  { id: 'ATELIER', label: HUB_USAGE_CATEGORY_LABELS.ATELIER, description: 'Makerspaces, labs pratiques', icon: 'tool' },
  { id: 'MIXTE', label: HUB_USAGE_CATEGORY_LABELS.MIXTE, description: 'Multi-usage', icon: 'layers' },
];

// Mapping HubType vers HubUsageCategory
export const HUB_TYPE_TO_USAGE: Record<HubType, HubUsageCategory | null> = {
  COWORKING: 'TRAVAIL',
  LAB: 'ATELIER',
  INCUBATOR: 'TRAVAIL',
  ACCELERATOR: 'TRAVAIL',
  CERTIFICATION_CENTER: 'FORMATION',
  TRAINING_CENTER: 'FORMATION',
  UNIVERSITY: 'FORMATION',
  MAKERSPACE: 'ATELIER',
  VIRTUAL_COMMUNITY: null,
};

// ═══════════════════════════════════════════════════════════════
// TYPES D'ESPACES INTERNES
// ═══════════════════════════════════════════════════════════════

export const SPACE_TYPE_DATA: Array<{
  id: SpaceType;
  label: string;
  icon: string;
  density: number;
  category: HubUsageCategory | 'COMMUN';
}> = [
  // Formation
  { id: 'SALLE_COURS', label: SPACE_TYPE_LABELS.SALLE_COURS, icon: 'book-open', density: 2, category: 'FORMATION' },
  { id: 'SALLE_INFORMATIQUE', label: SPACE_TYPE_LABELS.SALLE_INFORMATIQUE, icon: 'monitor', density: 3, category: 'FORMATION' },
  { id: 'AMPHITHEATRE', label: SPACE_TYPE_LABELS.AMPHITHEATRE, icon: 'tv', density: 0.8, category: 'FORMATION' },
  // Travail
  { id: 'OPEN_SPACE', label: SPACE_TYPE_LABELS.OPEN_SPACE, icon: 'layout', density: 7, category: 'TRAVAIL' },
  { id: 'BUREAU_PRIVE', label: SPACE_TYPE_LABELS.BUREAU_PRIVE, icon: 'square', density: 12, category: 'TRAVAIL' },
  { id: 'POSTE_NOMADE', label: SPACE_TYPE_LABELS.POSTE_NOMADE, icon: 'laptop', density: 4, category: 'TRAVAIL' },
  // Réunion
  { id: 'SALLE_REUNION', label: SPACE_TYPE_LABELS.SALLE_REUNION, icon: 'users', density: 2.5, category: 'REUNION' },
  { id: 'SALLE_CONFERENCE', label: SPACE_TYPE_LABELS.SALLE_CONFERENCE, icon: 'mic', density: 1, category: 'REUNION' },
  { id: 'CABINE_APPEL', label: SPACE_TYPE_LABELS.CABINE_APPEL, icon: 'phone', density: 2, category: 'REUNION' },
  // Atelier
  { id: 'ATELIER', label: SPACE_TYPE_LABELS.ATELIER, icon: 'tool', density: 5, category: 'ATELIER' },
  { id: 'LABO', label: SPACE_TYPE_LABELS.LABO, icon: 'flask', density: 8, category: 'ATELIER' },
  // Communs
  { id: 'ACCUEIL', label: SPACE_TYPE_LABELS.ACCUEIL, icon: 'home', density: 10, category: 'COMMUN' },
  { id: 'CAFETERIA', label: SPACE_TYPE_LABELS.CAFETERIA, icon: 'coffee', density: 2, category: 'COMMUN' },
  { id: 'ESPACE_DETENTE', label: SPACE_TYPE_LABELS.ESPACE_DETENTE, icon: 'smile', density: 3, category: 'COMMUN' },
];

// Fonction pour calculer la capacité selon la surface et le type d'espace
export function calculateSpaceCapacity(surfaceM2: number, spaceType: SpaceType): number {
  const spaceData = SPACE_TYPE_DATA.find(s => s.id === spaceType);
  if (!spaceData) return 0;
  return Math.floor(surfaceM2 / spaceData.density);
}

// ═══════════════════════════════════════════════════════════════
// ÉQUIPEMENTS DE SÉCURITÉ
// ═══════════════════════════════════════════════════════════════

export const SAFETY_EQUIPMENT_DATA: Array<{
  id: SafetyEquipment;
  label: string;
  icon: string;
  required: boolean;
  minCapacityRequired: number; // Capacité minimum à partir de laquelle cet équipement est requis
}> = [
  { id: 'EXTINCTEUR', label: SAFETY_EQUIPMENT_LABELS.EXTINCTEUR, icon: 'flame', required: true, minCapacityRequired: 0 },
  { id: 'DETECTEUR_FUMEE', label: SAFETY_EQUIPMENT_LABELS.DETECTEUR_FUMEE, icon: 'alert-circle', required: true, minCapacityRequired: 0 },
  { id: 'ALARME_INCENDIE', label: SAFETY_EQUIPMENT_LABELS.ALARME_INCENDIE, icon: 'bell', required: true, minCapacityRequired: 50 },
  { id: 'SORTIE_SECOURS', label: SAFETY_EQUIPMENT_LABELS.SORTIE_SECOURS, icon: 'log-out', required: true, minCapacityRequired: 50 },
  { id: 'PLAN_EVACUATION', label: SAFETY_EQUIPMENT_LABELS.PLAN_EVACUATION, icon: 'map', required: true, minCapacityRequired: 0 },
  { id: 'ECLAIRAGE_SECOURS', label: SAFETY_EQUIPMENT_LABELS.ECLAIRAGE_SECOURS, icon: 'zap', required: false, minCapacityRequired: 100 },
  { id: 'SPRINKLER', label: SAFETY_EQUIPMENT_LABELS.SPRINKLER, icon: 'droplet', required: false, minCapacityRequired: 700 },
  { id: 'DESENFUMAGE', label: SAFETY_EQUIPMENT_LABELS.DESENFUMAGE, icon: 'wind', required: false, minCapacityRequired: 300 },
  { id: 'PORTE_COUPE_FEU', label: SAFETY_EQUIPMENT_LABELS.PORTE_COUPE_FEU, icon: 'shield', required: false, minCapacityRequired: 300 },
];

// Fonction pour obtenir les équipements requis selon la capacité
export function getRequiredSafetyEquipment(maxCapacity: number): SafetyEquipment[] {
  return SAFETY_EQUIPMENT_DATA
    .filter(eq => eq.minCapacityRequired <= maxCapacity)
    .map(eq => eq.id);
}

// ═══════════════════════════════════════════════════════════════
// ÉQUIPEMENTS D'ACCESSIBILITÉ
// ═══════════════════════════════════════════════════════════════

export const ACCESSIBILITY_DATA: Array<{ id: AccessibilityFeature; label: string; icon: string; description: string }> = [
  { id: 'RAMPE_ACCES', label: ACCESSIBILITY_FEATURE_LABELS.RAMPE_ACCES, icon: 'trending-up', description: 'Rampe pour fauteuils roulants' },
  { id: 'ASCENSEUR', label: ACCESSIBILITY_FEATURE_LABELS.ASCENSEUR, icon: 'arrow-up', description: 'Ascenseur accessible PMR' },
  { id: 'WC_ACCESSIBLE', label: ACCESSIBILITY_FEATURE_LABELS.WC_ACCESSIBLE, icon: 'droplet', description: 'Toilettes adaptées' },
  { id: 'PORTES_LARGES', label: ACCESSIBILITY_FEATURE_LABELS.PORTES_LARGES, icon: 'maximize', description: 'Largeur minimale 90cm' },
  { id: 'GUIDAGE_TACTILE', label: ACCESSIBILITY_FEATURE_LABELS.GUIDAGE_TACTILE, icon: 'navigation', description: 'Bandes podotactiles' },
  { id: 'BOUCLE_AUDITIVE', label: ACCESSIBILITY_FEATURE_LABELS.BOUCLE_AUDITIVE, icon: 'headphones', description: 'Pour malentendants' },
  { id: 'PARKING_HANDICAPE', label: ACCESSIBILITY_FEATURE_LABELS.PARKING_HANDICAPE, icon: 'car', description: 'Places réservées PMR' },
  { id: 'SIGNALISATION_BRAILLE', label: ACCESSIBILITY_FEATURE_LABELS.SIGNALISATION_BRAILLE, icon: 'eye-off', description: 'Pour malvoyants' },
];

// ═══════════════════════════════════════════════════════════════
// ÉQUIPEMENTS / AMENITIES (existant conservé)
// ═══════════════════════════════════════════════════════════════

export const HUB_AMENITIES = {
  WIFI: 'WIFI',
  PARKING: 'PARKING',
  MEETING_ROOMS: 'MEETING_ROOMS',
  PHONE_BOOTHS: 'PHONE_BOOTHS',
  KITCHEN: 'KITCHEN',
  CAFETERIA: 'CAFETERIA',
  LOCKER: 'LOCKER',
  PRINTER: 'PRINTER',
  PROJECTOR: 'PROJECTOR',
  WHITEBOARD: 'WHITEBOARD',
  AIR_CONDITIONING: 'AIR_CONDITIONING',
  SECURITY_24H: 'SECURITY_24H',
  RECEPTION: 'RECEPTION',
  MAIL_SERVICE: 'MAIL_SERVICE',
  EVENT_SPACE: 'EVENT_SPACE',
  ROOFTOP: 'ROOFTOP',
  GYM: 'GYM',
  CHILDCARE: 'CHILDCARE',
} as const;

export type HubAmenity = (typeof HUB_AMENITIES)[keyof typeof HUB_AMENITIES];

export const HUB_AMENITY_DATA: Array<{ id: HubAmenity; label: string; icon: string }> = [
  { id: 'WIFI', label: 'Wi-Fi haut débit', icon: 'wifi' },
  { id: 'PARKING', label: 'Parking', icon: 'car' },
  { id: 'MEETING_ROOMS', label: 'Salles de réunion', icon: 'users' },
  { id: 'PHONE_BOOTHS', label: 'Cabines téléphoniques', icon: 'phone' },
  { id: 'KITCHEN', label: 'Cuisine équipée', icon: 'utensils' },
  { id: 'CAFETERIA', label: 'Cafétéria', icon: 'coffee' },
  { id: 'LOCKER', label: 'Casiers', icon: 'lock' },
  { id: 'PRINTER', label: 'Imprimante', icon: 'printer' },
  { id: 'PROJECTOR', label: 'Vidéoprojecteur', icon: 'monitor' },
  { id: 'WHITEBOARD', label: 'Tableau blanc', icon: 'square' },
  { id: 'AIR_CONDITIONING', label: 'Climatisation', icon: 'thermometer' },
  { id: 'SECURITY_24H', label: 'Sécurité 24h/24', icon: 'shield' },
  { id: 'RECEPTION', label: 'Réception', icon: 'user' },
  { id: 'MAIL_SERVICE', label: 'Service courrier', icon: 'mail' },
  { id: 'EVENT_SPACE', label: 'Espace événementiel', icon: 'calendar' },
  { id: 'ROOFTOP', label: 'Rooftop / Terrasse', icon: 'sun' },
  { id: 'GYM', label: 'Salle de sport', icon: 'activity' },
  { id: 'CHILDCARE', label: 'Garde d\'enfants', icon: 'baby' },
];

// ═══════════════════════════════════════════════════════════════
// TYPES DE TARIFICATION
// ═══════════════════════════════════════════════════════════════

export const PRICING_TYPE_DATA: Array<{ id: PricingType; label: string; description: string }> = [
  { id: 'FREE', label: PRICING_TYPE_LABELS.FREE, description: 'Accès gratuit' },
  { id: 'HOURLY', label: PRICING_TYPE_LABELS.HOURLY, description: 'Paiement à l\'heure' },
  { id: 'DAILY', label: PRICING_TYPE_LABELS.DAILY, description: 'Paiement à la journée' },
  { id: 'MONTHLY', label: PRICING_TYPE_LABELS.MONTHLY, description: 'Abonnement mensuel' },
  { id: 'YEARLY', label: PRICING_TYPE_LABELS.YEARLY, description: 'Abonnement annuel' },
  { id: 'CUSTOM', label: PRICING_TYPE_LABELS.CUSTOM, description: 'Tarif personnalisé' },
];

// ═══════════════════════════════════════════════════════════════
// CAPACITÉS PRÉDÉFINIES (pour formulaires)
// ═══════════════════════════════════════════════════════════════

export const CAPACITY_DATA: Array<{ id: string; label: string; value: number }> = [
  { id: 'SMALL', label: '1-10 personnes', value: 10 },
  { id: 'MEDIUM', label: '11-30 personnes', value: 30 },
  { id: 'LARGE', label: '31-50 personnes', value: 50 },
  { id: 'XLARGE', label: '51-100 personnes', value: 100 },
  { id: 'XXLARGE', label: '100+ personnes', value: 200 },
];

// ═══════════════════════════════════════════════════════════════
// JOURS DE LA SEMAINE
// ═══════════════════════════════════════════════════════════════

export const WEEKDAYS = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
} as const;

export type Weekday = (typeof WEEKDAYS)[keyof typeof WEEKDAYS];

export const WEEKDAY_DATA: Array<{ id: Weekday; label: string; short: string }> = [
  { id: 'MONDAY', label: 'Lundi', short: 'Lun' },
  { id: 'TUESDAY', label: 'Mardi', short: 'Mar' },
  { id: 'WEDNESDAY', label: 'Mercredi', short: 'Mer' },
  { id: 'THURSDAY', label: 'Jeudi', short: 'Jeu' },
  { id: 'FRIDAY', label: 'Vendredi', short: 'Ven' },
  { id: 'SATURDAY', label: 'Samedi', short: 'Sam' },
  { id: 'SUNDAY', label: 'Dimanche', short: 'Dim' },
];

// ═══════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES DE CONFORMITÉ
// ═══════════════════════════════════════════════════════════════

export interface ComplianceCheckResult {
  isCompliant: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Vérifie la conformité d'un hub
 */
export function checkHubCompliance(hub: {
  surface_m2?: number;
  max_capacity?: number;
  is_accessible?: boolean;
  safety_equipment?: SafetyEquipment[];
  last_inspection_date?: string;
}): ComplianceCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Surface obligatoire
  if (!hub.surface_m2) {
    errors.push('Surface non renseignée');
  }

  // Capacité obligatoire
  if (!hub.max_capacity) {
    errors.push('Capacité maximale non définie');
  }

  // Sécurité selon capacité
  if (hub.max_capacity) {
    const required = getRequiredSafetyEquipment(hub.max_capacity);
    const current = hub.safety_equipment || [];
    const missing = required.filter(eq => !current.includes(eq));

    missing.forEach(eq => {
      const eqData = SAFETY_EQUIPMENT_DATA.find(e => e.id === eq);
      errors.push(`Équipement requis manquant: ${eqData?.label || eq}`);
    });
  }

  // Accessibilité (obligatoire depuis 2015)
  if (!hub.is_accessible) {
    warnings.push('Établissement non accessible aux personnes handicapées');
  }

  // Inspection récente (recommandé tous les 3 ans)
  if (hub.last_inspection_date) {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    if (new Date(hub.last_inspection_date) < threeYearsAgo) {
      warnings.push('Dernière inspection de sécurité > 3 ans');
    }
  } else {
    warnings.push('Date de dernière inspection non renseignée');
  }

  return {
    isCompliant: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Calcule la capacité totale d'un hub basée sur ses espaces
 */
export function calculateTotalHubCapacity(spaces: Array<{ type: SpaceType; capacity: number }>): number {
  const nonCountedTypes: SpaceType[] = ['ACCUEIL', 'CAFETERIA', 'ESPACE_DETENTE'];

  return spaces.reduce((total, space) => {
    if (nonCountedTypes.includes(space.type)) return total;
    return total + space.capacity;
  }, 0);
}
