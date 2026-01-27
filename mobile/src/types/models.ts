// Types synchronisés avec le backend
// Dernière mise à jour: 19 janvier 2026

export type UUID = string;
export type ISODate = string;
export type ISOTimestamp = string;

// ═══════════════════════════════════════════════════════════════
// INTERFACES - USER & AUTH
// ═══════════════════════════════════════════════════════════════

export interface User {
  id: UUID;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  phoneVerified?: boolean;
  // Profile info (from talent profile if exists)
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  // Profile link
  talentId?: UUID;
  hasTalentProfile?: boolean;
  // Onboarding status
  onboardingComplete?: boolean;
  // Organization memberships
  organizationMemberships?: Array<{
    organizationId: UUID;
    role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
  }>;
  // Timestamps
  createdAt?: ISOTimestamp;
  updatedAt?: ISOTimestamp;
  lastLoginAt?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// ENUMS - OPPORTUNITY
// ═══════════════════════════════════════════════════════════════

export const OPPORTUNITY_TYPES = {
  EMPLOYMENT: 'EMPLOYMENT',
  INTERNSHIP: 'INTERNSHIP',
  ENTREPRENEURSHIP: 'ENTREPRENEURSHIP',
  ALTERNATION: 'ALTERNATION',
  FREELANCE: 'FREELANCE',
  VOLUNTEER: 'VOLUNTEER',
} as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[keyof typeof OPPORTUNITY_TYPES];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  EMPLOYMENT: 'Emploi',
  INTERNSHIP: 'Stage',
  ENTREPRENEURSHIP: 'Entrepreneuriat',
  ALTERNATION: 'Alternance',
  FREELANCE: 'Freelance',
  VOLUNTEER: 'Bénévolat',
};

// Contract type (type de contrat)
export const CONTRACT_TYPES = {
  CDI: 'CDI',
  CDD: 'CDD',
  APPRENTICESHIP: 'APPRENTICESHIP',
  INTERNSHIP: 'INTERNSHIP',
  FREELANCE: 'FREELANCE',
  SERVICE: 'SERVICE',
  INTERIM: 'INTERIM',
} as const;
export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  APPRENTICESHIP: 'Apprentissage',
  INTERNSHIP: 'Stage',
  FREELANCE: 'Freelance',
  SERVICE: 'Prestation',
  INTERIM: 'Intérim',
};

// Work rhythm (rythme de travail)
export const WORK_RHYTHMS = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  FLEXIBLE: 'FLEXIBLE',
  OCCASIONAL: 'OCCASIONAL',
} as const;
export type WorkRhythm = (typeof WORK_RHYTHMS)[keyof typeof WORK_RHYTHMS];

export const WORK_RHYTHM_LABELS: Record<WorkRhythm, string> = {
  FULL_TIME: 'Temps plein',
  PART_TIME: 'Temps partiel',
  FLEXIBLE: 'Flexible',
  OCCASIONAL: 'Ponctuel',
};


export const LOCATION_TYPES = {
  ON_SITE: 'ON_SITE',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
} as const;
export type LocationType = (typeof LOCATION_TYPES)[keyof typeof LOCATION_TYPES];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  ON_SITE: 'Sur site',
  REMOTE: 'À distance',
  HYBRID: 'Hybride',
};


export const COMPENSATION_FREQUENCIES = {
  HOURLY: 'HOURLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  PROJECT: 'PROJECT',
} as const;
export type CompensationFrequency = (typeof COMPENSATION_FREQUENCIES)[keyof typeof COMPENSATION_FREQUENCIES];

export const COMPENSATION_FREQUENCY_LABELS: Record<CompensationFrequency, string> = {
  HOURLY: 'heure',
  MONTHLY: 'mois',
  YEARLY: 'an',
  PROJECT: 'projet',
};

export const OPPORTUNITY_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  FILLED: 'FILLED',
  EXPIRED: 'EXPIRED',
} as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUS)[keyof typeof OPPORTUNITY_STATUS];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  DRAFT: 'Brouillon',
  OPEN: 'Publiée',
  PAUSED: 'En pause',
  FILLED: 'Pourvue',
  EXPIRED: 'Expirée',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - ORGANIZATION
// ═══════════════════════════════════════════════════════════════

export const ORGANIZATION_TYPES = {
  COMPANY: 'COMPANY',
  STARTUP: 'STARTUP',
  NGO: 'NGO',
  ASSOCIATION: 'ASSOCIATION',
  EDUCATIONAL_INSTITUTION: 'EDUCATIONAL_INSTITUTION',
  PUBLIC_ADMINISTRATION: 'PUBLIC_ADMINISTRATION',
  TRAINING_CENTER: 'TRAINING_CENTER',
  CONSULTING_FIRM: 'CONSULTING_FIRM',
  RECRUITMENT_AGENCY: 'RECRUITMENT_AGENCY',
  FINANCIAL_INSTITUTION: 'FINANCIAL_INSTITUTION',
  RESEARCH_CENTER: 'RESEARCH_CENTER',
  COOPERATIVE: 'COOPERATIVE',
  SOCIAL_ENTERPRISE: 'SOCIAL_ENTERPRISE',
} as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[keyof typeof ORGANIZATION_TYPES];

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  COMPANY: 'Entreprise',
  STARTUP: 'Startup',
  NGO: 'ONG',
  ASSOCIATION: 'Association',
  EDUCATIONAL_INSTITUTION: "Établissement d'enseignement",
  PUBLIC_ADMINISTRATION: 'Administration publique',
  TRAINING_CENTER: 'Cabinet de formation',
  CONSULTING_FIRM: 'Cabinet de conseil',
  RECRUITMENT_AGENCY: 'Cabinet de recrutement',
  FINANCIAL_INSTITUTION: 'Institution financière',
  RESEARCH_CENTER: 'Centre de recherche',
  COOPERATIVE: 'Coopérative',
  SOCIAL_ENTERPRISE: 'Entreprise sociale',
};

export const ORGANIZATION_SIZES = {
  SOLO: 'SOLO',
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type OrganizationSize = (typeof ORGANIZATION_SIZES)[keyof typeof ORGANIZATION_SIZES];

export const ORGANIZATION_SIZE_LABELS: Record<OrganizationSize, string> = {
  SOLO: '1 personne',
  SMALL: '2-10 employés',
  MEDIUM: '11-50 employés',
  LARGE: '51-200 employés',
  ENTERPRISE: '200+ employés',
};

export const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  NOT_STARTED: 'NOT_STARTED',
} as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'En cours de vérification',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
  NOT_STARTED: 'Non démarré',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - SPACE (Espaces réservables)
// ═══════════════════════════════════════════════════════════════

// Types d'espaces réservables
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

// Équipements de sécurité
export const SAFETY_EQUIPMENT = {
  EXTINCTEUR: 'EXTINCTEUR',
  DETECTEUR_FUMEE: 'DETECTEUR_FUMEE',
  ALARME_INCENDIE: 'ALARME_INCENDIE',
  SORTIE_SECOURS: 'SORTIE_SECOURS',
  PLAN_EVACUATION: 'PLAN_EVACUATION',
  ECLAIRAGE_SECOURS: 'ECLAIRAGE_SECOURS',
  SPRINKLER: 'SPRINKLER',
  DESENFUMAGE: 'DESENFUMAGE',
  PORTE_COUPE_FEU: 'PORTE_COUPE_FEU',
} as const;
export type SafetyEquipment = (typeof SAFETY_EQUIPMENT)[keyof typeof SAFETY_EQUIPMENT];

export const SAFETY_EQUIPMENT_LABELS: Record<SafetyEquipment, string> = {
  EXTINCTEUR: 'Extincteurs',
  DETECTEUR_FUMEE: 'Détecteurs de fumée',
  ALARME_INCENDIE: 'Alarme incendie',
  SORTIE_SECOURS: 'Sorties de secours',
  PLAN_EVACUATION: 'Plan d\'évacuation',
  ECLAIRAGE_SECOURS: 'Éclairage de secours',
  SPRINKLER: 'Sprinklers',
  DESENFUMAGE: 'Désenfumage',
  PORTE_COUPE_FEU: 'Portes coupe-feu',
};

// Équipements d'accessibilité
export const ACCESSIBILITY_FEATURES = {
  RAMPE_ACCES: 'RAMPE_ACCES',
  ASCENSEUR: 'ASCENSEUR',
  WC_ACCESSIBLE: 'WC_ACCESSIBLE',
  PORTES_LARGES: 'PORTES_LARGES',
  GUIDAGE_TACTILE: 'GUIDAGE_TACTILE',
  BOUCLE_AUDITIVE: 'BOUCLE_AUDITIVE',
  PARKING_HANDICAPE: 'PARKING_HANDICAPE',
  SIGNALISATION_BRAILLE: 'SIGNALISATION_BRAILLE',
} as const;
export type AccessibilityFeature = (typeof ACCESSIBILITY_FEATURES)[keyof typeof ACCESSIBILITY_FEATURES];

export const ACCESSIBILITY_FEATURE_LABELS: Record<AccessibilityFeature, string> = {
  RAMPE_ACCES: 'Rampe d\'accès',
  ASCENSEUR: 'Ascenseur adapté',
  WC_ACCESSIBLE: 'Toilettes accessibles',
  PORTES_LARGES: 'Portes larges (≥90cm)',
  GUIDAGE_TACTILE: 'Guidage au sol',
  BOUCLE_AUDITIVE: 'Boucle auditive',
  PARKING_HANDICAPE: 'Places parking PMR',
  SIGNALISATION_BRAILLE: 'Signalisation braille',
};

// Types de tarification
export const PRICING_TYPES = {
  FREE: 'FREE',
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;
export type PricingType = (typeof PRICING_TYPES)[keyof typeof PRICING_TYPES];

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  FREE: 'Gratuit',
  HOURLY: 'À l\'heure',
  DAILY: 'À la journée',
  MONTHLY: 'Abonnement mensuel',
  YEARLY: 'Abonnement annuel',
  CUSTOM: 'Sur devis',
};

export const ACCESS_TYPES = {
  PUBLIC: 'PUBLIC',
  MEMBERSHIP: 'MEMBERSHIP',
} as const;
export type AccessType = (typeof ACCESS_TYPES)[keyof typeof ACCESS_TYPES];

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  PUBLIC: 'Accès libre',
  MEMBERSHIP: 'Adhésion requise',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - COMMUNITY
// ═══════════════════════════════════════════════════════════════

export const COMMUNITY_TYPES = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  HYBRID: 'HYBRID',
} as const;
export type CommunityType = (typeof COMMUNITY_TYPES)[keyof typeof COMMUNITY_TYPES];

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  ONLINE: 'En ligne',
  OFFLINE: 'Présentiel',
  HYBRID: 'Hybride',
};

export const VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PUBLIC: 'Publique',
  PRIVATE: 'Privée',
};

export const COMMUNITY_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type CommunityStatus = (typeof COMMUNITY_STATUS)[keyof typeof COMMUNITY_STATUS];

export const COMMUNITY_STATUS_LABELS: Record<CommunityStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - MENTORSHIP
// ═══════════════════════════════════════════════════════════════

export const MENTORSHIP_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
} as const;
export type MentorshipStatus = (typeof MENTORSHIP_STATUS)[keyof typeof MENTORSHIP_STATUS];

export const MENTORSHIP_STATUS_LABELS: Record<MentorshipStatus, string> = {
  ACTIVE: 'Actif',
  PAUSED: 'En pause',
  COMPLETED: 'Terminé',
};

export const MENTOR_AVAILABILITY = {
  WEEKDAYS: 'WEEKDAYS',
  WEEKENDS: 'WEEKENDS',
  EVENINGS: 'EVENINGS',
  FLEXIBLE: 'FLEXIBLE',
} as const;
export type MentorAvailability = (typeof MENTOR_AVAILABILITY)[keyof typeof MENTOR_AVAILABILITY];

export const MENTOR_AVAILABILITY_LABELS: Record<MentorAvailability, string> = {
  WEEKDAYS: 'En semaine',
  WEEKENDS: 'Week-ends',
  EVENINGS: 'Soirées',
  FLEXIBLE: 'Flexible',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - DOCUMENT
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ENUMS - NOTIFICATIONS & CALENDAR
// ═══════════════════════════════════════════════════════════════

export const NOTIFICATION_TYPES = {
  OPPORTUNITY: 'OPPORTUNITY',
  MENTORSHIP: 'MENTORSHIP',
  COMMUNITY: 'COMMUNITY',
  MESSAGE: 'MESSAGE',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const CALENDAR_EVENT_TYPES = {
  INTERVIEW: 'INTERVIEW',
  MENTORSHIP: 'MENTORSHIP',
  BOOKING: 'BOOKING',
  DEADLINE: 'DEADLINE',
} as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[keyof typeof CALENDAR_EVENT_TYPES];

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  INTERVIEW: 'Entretien',
  MENTORSHIP: 'Session mentorat',
  BOOKING: 'Réservation',
  DEADLINE: 'Date limite',
};

// ═══════════════════════════════════════════════════════════════
// ENUMS - PAYMENT
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_PROVIDERS = {
  ORANGE_MONEY: 'ORANGE_MONEY',
  MTN_MONEY: 'MTN_MONEY',
  MOOV_MONEY: 'MOOV_MONEY',
  WAVE: 'WAVE',
  PUSH: 'PUSH',
  DJAMO: 'DJAMO',
  CARD: 'CARD',
} as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  PUSH: 'Push',
  DJAMO: 'Djamo',
  CARD: 'Carte bancaire',
};

export const PAYMENT_PROVIDER_COLORS: Record<PaymentProvider, string> = {
  ORANGE_MONEY: '#FF6600',
  MTN_MONEY: '#FFCC00',
  MOOV_MONEY: '#0066CC',
  WAVE: '#1DC7EA',
  PUSH: '#22C55E',
  DJAMO: '#6B4EFF',
  CARD: '#1A1A1A',
};

// ═══════════════════════════════════════════════════════════════
// INTERFACES - LOCATION
// ═══════════════════════════════════════════════════════════════

export interface OpportunityLocation {
  city?: string;
  region?: string;
  country?: string;
  is_primary?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - OPPORTUNITY
// ═══════════════════════════════════════════════════════════════

export interface OpportunityAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface Opportunity {
  id: UUID;
  slug: string;
  title: string;
  type?: OpportunityType;
  contract_type?: ContractType;
  work_rhythm?: WorkRhythm;
  summary?: string;
  requirements?: string;
  nice_to_have?: string;
  // Sectors
  sectors?: string[];
  // Compensation (min/max/frequency/currency only)
  compensation_min?: number;
  compensation_max?: number;
  currency?: string;
  compensation_frequency?: CompensationFrequency;
  // Location
  location_type?: LocationType;
  locations?: OpportunityLocation[];
  // Media
  cover_image_url?: string;
  images?: string[];
  attachments?: OpportunityAttachment[];
  // Dates
  posted_at?: ISOTimestamp;
  deadline?: ISOTimestamp;
  start_date?: ISODate;
  duration?: string;
  // Status
  status?: OpportunityStatus;
  // Metrics (utilisé dans explore.tsx et gestion.tsx)
  views_count?: number;
  applications_count?: number;
  // User interaction state (utilisé dans explore.tsx)
  is_saved?: boolean;
  is_applied?: boolean;
  // Application requirements
  cv_required?: boolean;
  application_questions?: ApplicationQuestion[];
  // Relations
  organization?: Organization;
  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - APPLICATION QUESTIONS
// ═══════════════════════════════════════════════════════════════

export interface ApplicationQuestion {
  id: string;
  question: string;
  required: boolean;
  max_length?: number; // Default 200 characters
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - ORGANIZATION
// ═══════════════════════════════════════════════════════════════

export interface Organization {
  id: UUID;
  slug: string;
  name: string;
  type?: OrganizationType;
  sectors?: string[];
  size?: OrganizationSize;
  description?: string;
  logo_url?: string;
  website_url?: string;
  // Contact
  email?: string;
  phone?: string;
  contact_email?: string;
  contact_phone?: string;
  // Location
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  // Goals
  goals?: string[];
  // Verification
  verification_status?: VerificationStatus;
  // Culture & Info
  culture_summary?: string;
  employees_count?: number;
  // Metrics
  opportunities_count?: number;
  views_count?: number;
  // User role in this org (utilisé dans SpaceContext)
  user_role?: 'admin' | 'member';
  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - TALENT (inclut données Mentor)
// ═══════════════════════════════════════════════════════════════

export interface MentorTestimonial {
  id: UUID;
  author_name: string;
  author_avatar_url?: string;
  content: string;
  rating: number;
  date: ISODate;
}

export interface Talent {
  id: UUID;
  slug: string;
  // === IDENTITÉ ===
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  // === PROFIL ===
  bio?: string;
  gender?: 'M' | 'F' | 'OTHER';
  birthday?: ISODate;
  // === LOCALISATION ===
  city?: string;
  region?: string;
  country?: string;
  // === PRÉFÉRENCES ===
  remote_ready?: boolean;
  willing_to_relocate?: boolean;
  // === COMPÉTENCES & INTÉRÊTS ===
  sectors?: string[];
  profile_tags?: string[];
  goals?: string[];
  skills?: string[];
  languages?: string[];
  // === EXPÉRIENCE ===
  years_experience?: number;
  current_role?: string;
  current_company?: string;
  // === MENTOR (nullable si pas mentor) ===
  is_mentor?: boolean;
  mentor_bio?: string;
  mentor_expertise_areas?: string[];
  mentor_availability?: MentorAvailability;
  mentor_price_per_session?: number;
  mentor_currency?: string;
  mentor_response_time?: string; // ex: "< 24h"
  mentor_is_published?: boolean;
  // === MÉTRIQUES MENTOR ===
  mentees_count?: number;
  mentor_rating?: number;
  mentor_reviews_count?: number;
  mentor_sessions_completed?: number;
  mentor_testimonials?: MentorTestimonial[];
  // === MÉTRIQUES PROFIL ===
  profile_views_count?: number;
  // === VÉRIFICATION ===
  verification_status?: VerificationStatus;
  // === TIMESTAMPS ===
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

// Alias pour compatibilité avec les vues existantes
export type Mentor = Talent;

// ═══════════════════════════════════════════════════════════════
// INTERFACES - SPACE (Espaces réservables)
// Note: Space types/interfaces are defined in spaceService.ts
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// INTERFACES - COMMUNITY
// ═══════════════════════════════════════════════════════════════

export interface CommunityMemberPreview {
  id: UUID;
  display_name: string;
  avatar_url?: string;
  role?: 'ADMIN' | 'MEMBER';
  city?: string;
  country?: string;
  bio?: string;
  joined_at?: ISODate;
}

export interface Community {
  id: UUID;
  slug: string;
  name: string;
  type?: CommunityType;
  description?: string;
  // Visibility & Access
  visibility?: Visibility;
  access_type?: AccessType; // Legacy, maps to visibility
  // Pricing
  is_paid?: boolean;
  monthly_price?: number;
  currency?: string;
  // Rules & Questions
  rules?: string;
  application_questions?: string[] | ApplicationQuestion[];
  // Tags & Sectors
  tags?: string[]; // Max 3 tags
  sectors?: string[];
  // Images
  cover_image_url?: string; // Hero image (main image)
  images?: string[]; // Gallery images
  // Location (pour communautés offline/hybrid)
  city?: string;
  region?: string;
  country?: string;
  // Metrics
  members_count?: number;
  activities_count?: number;
  views_count?: number;
  // User state
  is_member?: boolean;
  // Members preview
  members_preview?: CommunityMemberPreview[];
  moderators?: CommunityMemberPreview[];
  // Contact
  website_url?: string;
  // Relations
  organization?: Organization;
  organization_id?: string;
  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export interface Notification {
  id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  action_url?: string;
  created_at: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - CALENDAR
// ═══════════════════════════════════════════════════════════════

export interface CalendarEvent {
  id: UUID;
  type: CalendarEventType;
  title: string;
  date: ISODate;
  time?: string;
  end_time?: string;
  location?: string;
  description?: string;
  // Related entities
  opportunity_id?: UUID;
  mentor_id?: UUID;
  space_id?: UUID;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - PAYMENT
// ═══════════════════════════════════════════════════════════════

export interface PaymentMethod {
  id: UUID;
  provider: PaymentProvider;
  phone?: string;
  card_last_four?: string;
  is_default: boolean;
  created_at: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - GRAPH (utilisé dans graphe.tsx)
// ═══════════════════════════════════════════════════════════════

export const GRAPH_NODE_TYPES = {
  OPPORTUNITIES: 'opportunities',
  COMMUNITIES: 'communities',
  SPACES: 'spaces',
  MENTORS: 'mentors',
  DOCUMENTS: 'documents',
} as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[keyof typeof GRAPH_NODE_TYPES];

export const GRAPH_NODE_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  COMPLETED: 'completed',
  SAVED: 'saved',
} as const;
export type GraphNodeStatus = (typeof GRAPH_NODE_STATUS)[keyof typeof GRAPH_NODE_STATUS];

export interface GraphSubNode {
  id: string;
  label: string;
  status: GraphNodeStatus;
}

export interface GraphNode {
  id: GraphNodeType;
  label: string;
  color: string;
  count: number;
  angle: number;
  subNodes: GraphSubNode[];
  relationToCenter?: string;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - DASHBOARD / GESTION (utilisé dans gestion.tsx)
// ═══════════════════════════════════════════════════════════════

export interface DashboardStatCard {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  change_positive?: boolean;
}

export const ACTIVITY_TYPES = {
  OPPORTUNITY: 'opportunity',
  COMMUNITY: 'community',
  SPACE: 'space',
  MENTORSHIP: 'mentorship',
} as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

export interface DashboardActivity {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  date: string;
  views?: number;
  applications?: number;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - APPLICATIONS (candidatures)
// ═══════════════════════════════════════════════════════════════

export const APPLICATION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Soumise',
  IN_REVIEW: 'En cours d\'examen',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
};

export interface ApplicationAnswer {
  question_id: string;
  answer: string;
}

export interface Application {
  id: UUID;
  opportunity_id: UUID;
  talent_id: UUID;
  organization_id: UUID;
  status: ApplicationStatus;
  // Documents
  resume_url?: string;
  // Answers to application questions
  answers?: ApplicationAnswer[];
  // Organization notes (internal)
  internal_notes?: string;
  rating?: number; // 1-5 stars
  // Interview scheduling
  interview_scheduled_at?: ISOTimestamp;
  interview_type?: 'PHONE' | 'VIDEO' | 'IN_PERSON';
  interview_location?: string;
  interview_notes?: string;
  // Relations
  opportunity?: Opportunity;
  talent?: Talent;
  // Timestamps
  applied_at: ISOTimestamp;
  viewed_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

export interface ApplicationMessageAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export type DatetimeType = 'INTERVIEW_PROPOSAL' | 'MEETING_REQUEST' | 'AVAILABILITY';

export interface ApplicationMessage {
  id: UUID;
  application_id: UUID;
  sender_type: 'TALENT' | 'ORGANIZATION';
  sender_id: UUID;
  sender_name?: string;
  content: string;
  attachments?: ApplicationMessageAttachment[];
  // Datetime sharing for interview scheduling
  proposed_datetime?: ISOTimestamp;
  datetime_type?: DatetimeType;
  // Read status
  is_read?: boolean;
  read_at?: ISOTimestamp;
  // Timestamps
  created_at: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - MENTORSHIP SESSIONS
// ═══════════════════════════════════════════════════════════════

export interface MentorshipSession {
  id: UUID;
  mentor_id: UUID;
  mentee_id: UUID;
  status: MentorshipStatus;
  topic?: string;
  scheduled_at?: ISOTimestamp;
  duration_minutes?: number;
  meeting_url?: string;
  notes?: string;
  rating?: number;
  // Relations
  mentor?: Talent;
  mentee?: Talent;
  // Timestamps
  created_at: ISOTimestamp;
  completed_at?: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// ORGANIZATION MEMBERS & PERMISSIONS
// ═══════════════════════════════════════════════════════════════

export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  INACTIVE: 'INACTIVE',
} as const;
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Actif',
  INVITED: 'Invitation envoyée',
  INACTIVE: 'Inactif',
};

// ═══════════════════════════════════════════════════════════════
// ORGANIZATION ROLES (simplified - no granular permissions)
// ═══════════════════════════════════════════════════════════════

export const ORGANIZATION_ROLES = {
  OWNER: 'OWNER',       // Full control
  ADMIN: 'ADMIN',       // Can do everything except delete organization
  MANAGER: 'MANAGER',   // Can manage opportunities, communities, spaces (CRUD)
  OBSERVATEUR: 'OBSERVATEUR', // Read-only access
} as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  OBSERVATEUR: 'Observateur',
};

export const ORGANIZATION_ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  OWNER: 'Contrôle total de l\'organisation',
  ADMIN: 'Accès complet sauf suppression',
  MANAGER: 'Gestion des contenus (opportunités, espaces, communautés)',
  OBSERVATEUR: 'Accès en lecture seule',
};

// Role-based permission helpers
export const canManageContent = (role: OrganizationRole): boolean =>
  role === ORGANIZATION_ROLES.OWNER || role === ORGANIZATION_ROLES.ADMIN || role === ORGANIZATION_ROLES.MANAGER;

export const canManageMembers = (role: OrganizationRole): boolean =>
  role === ORGANIZATION_ROLES.OWNER || role === ORGANIZATION_ROLES.ADMIN;

export const canInviteMembers = (role: OrganizationRole): boolean =>
  role === ORGANIZATION_ROLES.OWNER || role === ORGANIZATION_ROLES.ADMIN;

export const canEditOrganization = (role: OrganizationRole): boolean =>
  role === ORGANIZATION_ROLES.OWNER || role === ORGANIZATION_ROLES.ADMIN;

export interface OrganizationMember {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  role: OrganizationRole;
  status: MemberStatus;
  // User info
  display_name: string;
  email: string;
  avatar_url?: string;
  title?: string;
  // Metadata
  invited_by?: UUID;
  invited_at?: ISOTimestamp;
  joined_at?: ISOTimestamp;
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export interface OrganizationInvitation {
  id: UUID;
  organization_id: UUID;
  email: string;
  role: OrganizationRole;
  token: string;
  invited_by: UUID;
  invited_by_name?: string;
  expires_at: ISOTimestamp;
  status: InvitationStatus;
  created_at: ISOTimestamp;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES - ASSISTANT / CHAT (utilisé dans assistant.tsx)
// ═══════════════════════════════════════════════════════════════

export const ASSISTANT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
  LEGAL: 'legal',
} as const;
export type AssistantMode = (typeof ASSISTANT_MODES)[keyof typeof ASSISTANT_MODES];

export interface AssistantMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp?: ISOTimestamp;
}
