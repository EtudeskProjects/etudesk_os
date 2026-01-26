export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISOTimestamp = string; // ISO 8601
export type Vector = number[]; // for embeddings (1536 dimensions for OpenAI)
export type Coordinates = { x: number; y: number } | string; // Postgres POINT

// JSONB Types for structured data
export interface OpportunityLocation {
  city?: string;
  region?: string;
  country?: string; // ISO 3166-1 alpha-2
  coordinates?: Coordinates;
  is_primary?: boolean;
}

export interface ApplicationAnswer {
  question_id: string;
  question: string;
  answer: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS / ENUMS
// ═══════════════════════════════════════════════════════════════

export const SKILL_TYPES = {
  KNOWLEDGE: "KNOWLEDGE",
  SOFT_SKILL: "SOFT_SKILL",
  HARD_SKILL: "HARD_SKILL"
} as const;
export type SkillType = typeof SKILL_TYPES[keyof typeof SKILL_TYPES];

export const PROFICIENCY_LEVELS = {
  BEGINNER: "A",
  ELEMENTARY: "A+",
  INTERMEDIATE: "B",
  UPPER_INTERMEDIATE: "B+",
  ADVANCED: "C",
  EXPERT: "C+"
} as const;
export type ProficiencyLevel = typeof PROFICIENCY_LEVELS[keyof typeof PROFICIENCY_LEVELS];

export const OPPORTUNITY_TYPES = {
  EMPLOYMENT: "EMPLOYMENT",
  INTERNSHIP: "INTERNSHIP",
  ENTREPRENEURSHIP: "ENTREPRENEURSHIP",
  ALTERNATION: "ALTERNATION",
  FREELANCE: "FREELANCE",
  VOLUNTEER: "VOLUNTEER"
} as const;
export type OpportunityType = typeof OPPORTUNITY_TYPES[keyof typeof OPPORTUNITY_TYPES];

export const HUB_TYPES = {
  COWORKING: "COWORKING",
  LAB: "LAB",
  INCUBATOR: "INCUBATOR",
  ACCELERATOR: "ACCELERATOR",
  CERTIFICATION_CENTER: "CERTIFICATION_CENTER",
  TRAINING_CENTER: "TRAINING_CENTER",
  UNIVERSITY: "UNIVERSITY",
  MAKERSPACE: "MAKERSPACE",
  VIRTUAL_COMMUNITY: "VIRTUAL_COMMUNITY"
} as const;
export type HubType = typeof HUB_TYPES[keyof typeof HUB_TYPES];

// Catégories d'usage des hubs (pour conformité et calculs de capacité)
export const HUB_USAGE_CATEGORIES = {
  FORMATION: "FORMATION",
  TRAVAIL: "TRAVAIL",
  REUNION: "REUNION",
  ATELIER: "ATELIER",
  MIXTE: "MIXTE"
} as const;
export type HubUsageCategory = typeof HUB_USAGE_CATEGORIES[keyof typeof HUB_USAGE_CATEGORIES];

// Types d'espaces internes
export const SPACE_TYPES = {
  // Formation
  SALLE_COURS: "SALLE_COURS",
  SALLE_INFORMATIQUE: "SALLE_INFORMATIQUE",
  AMPHITHEATRE: "AMPHITHEATRE",
  // Travail
  OPEN_SPACE: "OPEN_SPACE",
  BUREAU_PRIVE: "BUREAU_PRIVE",
  POSTE_NOMADE: "POSTE_NOMADE",
  // Réunion
  SALLE_REUNION: "SALLE_REUNION",
  SALLE_CONFERENCE: "SALLE_CONFERENCE",
  CABINE_APPEL: "CABINE_APPEL",
  // Atelier
  ATELIER: "ATELIER",
  LABO: "LABO",
  // Communs
  ACCUEIL: "ACCUEIL",
  CAFETERIA: "CAFETERIA",
  ESPACE_DETENTE: "ESPACE_DETENTE"
} as const;
export type SpaceType = typeof SPACE_TYPES[keyof typeof SPACE_TYPES];

// Équipements de sécurité
export const SAFETY_EQUIPMENT = {
  EXTINCTEUR: "EXTINCTEUR",
  DETECTEUR_FUMEE: "DETECTEUR_FUMEE",
  ALARME_INCENDIE: "ALARME_INCENDIE",
  SORTIE_SECOURS: "SORTIE_SECOURS",
  PLAN_EVACUATION: "PLAN_EVACUATION",
  ECLAIRAGE_SECOURS: "ECLAIRAGE_SECOURS",
  SPRINKLER: "SPRINKLER",
  DESENFUMAGE: "DESENFUMAGE",
  PORTE_COUPE_FEU: "PORTE_COUPE_FEU"
} as const;
export type SafetyEquipment = typeof SAFETY_EQUIPMENT[keyof typeof SAFETY_EQUIPMENT];

// Équipements d'accessibilité
export const ACCESSIBILITY_FEATURES = {
  RAMPE_ACCES: "RAMPE_ACCES",
  ASCENSEUR: "ASCENSEUR",
  WC_ACCESSIBLE: "WC_ACCESSIBLE",
  PORTES_LARGES: "PORTES_LARGES",
  GUIDAGE_TACTILE: "GUIDAGE_TACTILE",
  BOUCLE_AUDITIVE: "BOUCLE_AUDITIVE",
  PARKING_HANDICAPE: "PARKING_HANDICAPE",
  SIGNALISATION_BRAILLE: "SIGNALISATION_BRAILLE"
} as const;
export type AccessibilityFeature = typeof ACCESSIBILITY_FEATURES[keyof typeof ACCESSIBILITY_FEATURES];

// Mapping HubType vers HubUsageCategory
export const HUB_TYPE_USAGE_MAP: Record<HubType, HubUsageCategory | null> = {
  [HUB_TYPES.COWORKING]: HUB_USAGE_CATEGORIES.TRAVAIL,
  [HUB_TYPES.LAB]: HUB_USAGE_CATEGORIES.ATELIER,
  [HUB_TYPES.INCUBATOR]: HUB_USAGE_CATEGORIES.TRAVAIL,
  [HUB_TYPES.ACCELERATOR]: HUB_USAGE_CATEGORIES.TRAVAIL,
  [HUB_TYPES.CERTIFICATION_CENTER]: HUB_USAGE_CATEGORIES.FORMATION,
  [HUB_TYPES.TRAINING_CENTER]: HUB_USAGE_CATEGORIES.FORMATION,
  [HUB_TYPES.UNIVERSITY]: HUB_USAGE_CATEGORIES.FORMATION,
  [HUB_TYPES.MAKERSPACE]: HUB_USAGE_CATEGORIES.ATELIER,
  [HUB_TYPES.VIRTUAL_COMMUNITY]: null // Pas d'espace physique
};

// Densité m² par personne selon le type d'espace
export const SPACE_TYPE_DENSITY: Record<SpaceType, number> = {
  [SPACE_TYPES.SALLE_COURS]: 2,
  [SPACE_TYPES.SALLE_INFORMATIQUE]: 3,
  [SPACE_TYPES.AMPHITHEATRE]: 0.8,
  [SPACE_TYPES.OPEN_SPACE]: 7,
  [SPACE_TYPES.BUREAU_PRIVE]: 12,
  [SPACE_TYPES.POSTE_NOMADE]: 4,
  [SPACE_TYPES.SALLE_REUNION]: 2.5,
  [SPACE_TYPES.SALLE_CONFERENCE]: 1,
  [SPACE_TYPES.CABINE_APPEL]: 2,
  [SPACE_TYPES.ATELIER]: 5,
  [SPACE_TYPES.LABO]: 8,
  [SPACE_TYPES.ACCUEIL]: 10,
  [SPACE_TYPES.CAFETERIA]: 2,
  [SPACE_TYPES.ESPACE_DETENTE]: 3
};

export const DOCUMENT_TYPES = {
  // Professional documents
  CV: "CV",
  CERTIFICATE: "CERTIFICATE",
  DIPLOMA: "DIPLOMA",
  LICENSE: "LICENSE",
  PORTFOLIO: "PORTFOLIO",
  RECOMMENDATION_LETTER: "RECOMMENDATION_LETTER",
  TRANSCRIPT: "TRANSCRIPT",
  PUBLICATION: "PUBLICATION",
  PATENT: "PATENT",
  // Identity/KYC documents
  ID_CARD: "ID_CARD",
  PASSPORT: "PASSPORT",
  DRIVER_LICENSE: "DRIVER_LICENSE",
  PROOF_OF_ADDRESS: "PROOF_OF_ADDRESS",
  // Other
  OTHER: "OTHER"
} as const;
export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

export const VERIFICATION_LEVELS = {
  NONE: 0,
  SELF_DECLARED: 1,
  PEER_ENDORSED: 2,
  DOCUMENT_BACKED: 3
} as const;
export type VerificationLevel = typeof VERIFICATION_LEVELS[keyof typeof VERIFICATION_LEVELS];

export const ORGANIZATION_TYPES = {
  COMPANY: "COMPANY",
  STARTUP: "STARTUP",
  NGO: "NGO",
  ASSOCIATION: "ASSOCIATION",
  EDUCATIONAL_INSTITUTION: "EDUCATIONAL_INSTITUTION",
  PUBLIC_ADMINISTRATION: "PUBLIC_ADMINISTRATION",
  TRAINING_CENTER: "TRAINING_CENTER",
  CONSULTING_FIRM: "CONSULTING_FIRM",
  RECRUITMENT_AGENCY: "RECRUITMENT_AGENCY",
  FINANCIAL_INSTITUTION: "FINANCIAL_INSTITUTION",
  RESEARCH_CENTER: "RESEARCH_CENTER",
  COOPERATIVE: "COOPERATIVE",
  SOCIAL_ENTERPRISE: "SOCIAL_ENTERPRISE"
} as const;
export type OrganizationType = typeof ORGANIZATION_TYPES[keyof typeof ORGANIZATION_TYPES];

// Labels français pour les types d'organisation
export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  [ORGANIZATION_TYPES.COMPANY]: "Entreprise",
  [ORGANIZATION_TYPES.STARTUP]: "Startup",
  [ORGANIZATION_TYPES.NGO]: "ONG",
  [ORGANIZATION_TYPES.ASSOCIATION]: "Association",
  [ORGANIZATION_TYPES.EDUCATIONAL_INSTITUTION]: "Établissement d'enseignement",
  [ORGANIZATION_TYPES.PUBLIC_ADMINISTRATION]: "Administration publique",
  [ORGANIZATION_TYPES.TRAINING_CENTER]: "Cabinet de formation",
  [ORGANIZATION_TYPES.CONSULTING_FIRM]: "Cabinet de conseil",
  [ORGANIZATION_TYPES.RECRUITMENT_AGENCY]: "Cabinet de recrutement",
  [ORGANIZATION_TYPES.FINANCIAL_INSTITUTION]: "Institution financière",
  [ORGANIZATION_TYPES.RESEARCH_CENTER]: "Centre de recherche",
  [ORGANIZATION_TYPES.COOPERATIVE]: "Coopérative",
  [ORGANIZATION_TYPES.SOCIAL_ENTERPRISE]: "Entreprise sociale"
} as const;

export const SECTORS = {
  AGRICULTURE: "AGRICULTURE",
  RESOURCES: "RESOURCES",
  ENERGY: "ENERGY",
  ENVIRONMENT: "ENVIRONMENT",
  INDUSTRY: "INDUSTRY",
  CONSTRUCTION: "CONSTRUCTION",
  TRANSPORT: "TRANSPORT",
  COMMERCE: "COMMERCE",
  FINANCE: "FINANCE",
  DIGITAL: "DIGITAL",
  MEDIA: "MEDIA",
  TOURISM: "TOURISM",
  HEALTH: "HEALTH",
  EDUCATION: "EDUCATION",
  PROFESSIONAL_SERVICES: "PROFESSIONAL_SERVICES",
  RESEARCH: "RESEARCH",
  PUBLIC: "PUBLIC",
  SECURITY: "SECURITY",
  SOCIAL_IMPACT: "SOCIAL_IMPACT",
  PERSONAL_SERVICES: "PERSONAL_SERVICES",
  CRAFTS: "CRAFTS"
} as const;
export type Sector = typeof SECTORS[keyof typeof SECTORS];

export const ORGANIZATION_SIZE = {
  SOLO: "SOLO",
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
  ENTERPRISE: "ENTERPRISE"
} as const;
export type OrganizationSize = typeof ORGANIZATION_SIZE[keyof typeof ORGANIZATION_SIZE];

export const PROJECT_TYPES = {
  ACADEMIC: "ACADEMIC",
  RESEARCH: "RESEARCH",
  OPEN_SOURCE: "OPEN_SOURCE",
  STARTUP: "STARTUP",
  CREATIVE: "CREATIVE",
  SOCIAL: "SOCIAL"
} as const;
export type ProjectType = typeof PROJECT_TYPES[keyof typeof PROJECT_TYPES];

export const PROJECT_VISIBILITY = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE"
} as const;
export type ProjectVisibility = typeof PROJECT_VISIBILITY[keyof typeof PROJECT_VISIBILITY];

export const PROJECT_STATUS = {
  IDEA: "IDEA",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED"
} as const;
export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

export const OPPORTUNITY_STATUS = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  PAUSED: "PAUSED",
  FILLED: "FILLED",
  EXPIRED: "EXPIRED"
} as const;
export type OpportunityStatus = typeof OPPORTUNITY_STATUS[keyof typeof OPPORTUNITY_STATUS];

export const APPLICATION_STATUS = {
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN_REVIEW",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED"
} as const;
export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

export const GROWTH_TREND = {
  DECLINING: "DECLINING",
  STABLE: "STABLE",
  GROWING: "GROWING",
  EMERGING: "EMERGING"
} as const;
export type GrowthTrend = typeof GROWTH_TREND[keyof typeof GROWTH_TREND];

// Contract type (type de contrat)
export const CONTRACT_TYPE = {
  CDI: "CDI",
  CDD: "CDD",
  APPRENTICESHIP: "APPRENTICESHIP",
  INTERNSHIP: "INTERNSHIP",
  FREELANCE: "FREELANCE",
  SERVICE: "SERVICE",
  INTERIM: "INTERIM"
} as const;
export type ContractType = typeof CONTRACT_TYPE[keyof typeof CONTRACT_TYPE];

// Work rhythm (rythme de travail)
export const WORK_RHYTHM = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  FLEXIBLE: "FLEXIBLE",
  OCCASIONAL: "OCCASIONAL"
} as const;
export type WorkRhythm = typeof WORK_RHYTHM[keyof typeof WORK_RHYTHM];

// Legacy alias for backward compatibility
export const WORK_TYPE = CONTRACT_TYPE;
export type WorkType = ContractType;

export const COMPENSATION_TYPE = {
  PAID: "PAID",
  UNPAID: "UNPAID",
  EQUITY: "EQUITY",
  STIPEND: "STIPEND"
} as const;
export type CompensationType = typeof COMPENSATION_TYPE[keyof typeof COMPENSATION_TYPE];

export const COMPENSATION_FREQUENCY = {
  HOURLY: "HOURLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
  PROJECT: "PROJECT"
} as const;
export type CompensationFrequency = typeof COMPENSATION_FREQUENCY[keyof typeof COMPENSATION_FREQUENCY];

export const LOCATION_TYPE = {
  ON_SITE: "ON_SITE",
  REMOTE: "REMOTE",
  HYBRID: "HYBRID"
} as const;
export type LocationType = typeof LOCATION_TYPE[keyof typeof LOCATION_TYPE];

export const LINK_TYPE = {
  DEMO: "DEMO",
  REPOSITORY: "REPOSITORY",
  DOCUMENTATION: "DOCUMENTATION",
  ARTICLE: "ARTICLE",
  VIDEO: "VIDEO"
} as const;
export type LinkType = typeof LINK_TYPE[keyof typeof LINK_TYPE];

export const CONTRIBUTION_TYPE = {
  CREATOR: "CREATOR",
  CONTRIBUTOR: "CONTRIBUTOR",
  ADVISOR: "ADVISOR",
  SPONSOR: "SPONSOR"
} as const;
export type ContributionType = typeof CONTRIBUTION_TYPE[keyof typeof CONTRIBUTION_TYPE];

export const DEGREE_TYPE = {
  HIGH_SCHOOL: "HIGH_SCHOOL",
  BACHELOR: "BACHELOR",
  MASTER: "MASTER",
  PHD: "PHD",
  CERTIFICATE: "CERTIFICATE",
  BOOTCAMP: "BOOTCAMP"
} as const;
export type DegreeType = typeof DEGREE_TYPE[keyof typeof DEGREE_TYPE];

export const POSTER_ROLE = {
  POSTER: "POSTER",
  RECRUITER: "RECRUITER",
  HIRING_MANAGER: "HIRING_MANAGER"
} as const;
export type PosterRole = typeof POSTER_ROLE[keyof typeof POSTER_ROLE];

export const RELATIONSHIP_TYPE = {
  COLLEAGUE: "COLLEAGUE",
  CLASSMATE: "CLASSMATE",
  MET_AT_EVENT: "MET_AT_EVENT",
  ONLINE: "ONLINE",
  OTHER: "OTHER"
} as const;
export type RelationshipType = typeof RELATIONSHIP_TYPE[keyof typeof RELATIONSHIP_TYPE];

export const MEMBERSHIP_TYPE = {
  MEMBER: "MEMBER",
  ALUMNI: "ALUMNI",
  STAFF: "STAFF"
} as const;
export type MembershipType = typeof MEMBERSHIP_TYPE[keyof typeof MEMBERSHIP_TYPE];

export const SKILL_RELATIONSHIP_TYPE = {
  PREREQUISITE_FOR: "PREREQUISITE_FOR",
  COMPLEMENTARY: "COMPLEMENTARY",
  ALTERNATIVE: "ALTERNATIVE"
} as const;
export type SkillRelationshipType = typeof SKILL_RELATIONSHIP_TYPE[keyof typeof SKILL_RELATIONSHIP_TYPE];

export const HUB_RELATIONSHIP = {
  OWNER: "OWNER",
  PARTNER: "PARTNER",
  SPONSOR: "SPONSOR",
  TENANT: "TENANT"
} as const;
export type HubRelationship = typeof HUB_RELATIONSHIP[keyof typeof HUB_RELATIONSHIP];

export const ORG_VERIFICATION_STATUS = {
  CLAIMED: "CLAIMED",
  VERIFIED: "VERIFIED",
  OFFICIAL: "OFFICIAL"
} as const;
export type OrgVerificationStatus = typeof ORG_VERIFICATION_STATUS[keyof typeof ORG_VERIFICATION_STATUS];

// General verification status (for talents, users, KYC)
export const VERIFICATION_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED"
} as const;
export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

export const COMMUNITY_TYPE = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  HYBRID: "HYBRID"
} as const;
export type CommunityType = typeof COMMUNITY_TYPE[keyof typeof COMMUNITY_TYPE];

export const ACCESS_TYPE = {
  PUBLIC: "PUBLIC",
  MEMBERSHIP: "MEMBERSHIP"
} as const;
export type AccessType = typeof ACCESS_TYPE[keyof typeof ACCESS_TYPE];

export const VISIBILITY = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE"
} as const;
export type Visibility = typeof VISIBILITY[keyof typeof VISIBILITY];

export const PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
} as const;
export type Priority = typeof PRIORITY[keyof typeof PRIORITY];

export const BOOKING_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED"
} as const;
export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

export const PROFILE_TAG = {
  STUDENT: "STUDENT",
  PUPIL: "PUPIL",
  JOB_SEEKER: "JOB_SEEKER",
  SALARIED: "SALARIED",
  ENTREPRENEUR: "ENTREPRENEUR",
  CIVIL_SERVANT: "CIVIL_SERVANT",
  MANAGER: "MANAGER",
  CONSULTANT: "CONSULTANT",
  INVESTOR: "INVESTOR",
  CONTENT_CREATOR: "CONTENT_CREATOR",
  COACH: "COACH",
  RETIRED: "RETIRED"
} as const;
export type ProfileTag = typeof PROFILE_TAG[keyof typeof PROFILE_TAG];

export const GOAL = {
  LEARN_NEW_SKILLS: "LEARN_NEW_SKILLS",
  PREPARE_EXAMS: "PREPARE_EXAMS",
  FIND_JOB: "FIND_JOB",
  ADVANCE_CAREER: "ADVANCE_CAREER",
  RESEARCH_SUPPORT: "RESEARCH_SUPPORT",
  IMPROVE_PRODUCTIVITY: "IMPROVE_PRODUCTIVITY",
  COLLABORATIVE_LEARNING: "COLLABORATIVE_LEARNING",
  TEACH_OR_MENTOR: "TEACH_OR_MENTOR"
} as const;
export type Goal = typeof GOAL[keyof typeof GOAL];

export const DOCUMENT_VERIFICATION_STATUS = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED"
} as const;
export type DocumentVerificationStatus = typeof DOCUMENT_VERIFICATION_STATUS[keyof typeof DOCUMENT_VERIFICATION_STATUS];

export const DOCUMENT_CATEGORY = {
  IDENTITY: "IDENTITY",
  PROFESSIONAL: "PROFESSIONAL",
  ACADEMIC: "ACADEMIC",
  OTHER: "OTHER"
} as const;
export type DocumentCategory = typeof DOCUMENT_CATEGORY[keyof typeof DOCUMENT_CATEGORY];

export const DOCUMENT_VISIBILITY = {
  PRIVATE: "PRIVATE",
  SHARED: "SHARED",
  PUBLIC: "PUBLIC"
} as const;
export type DocumentVisibility = typeof DOCUMENT_VISIBILITY[keyof typeof DOCUMENT_VISIBILITY];

export const COMMUNITY_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED"
} as const;
export type CommunityStatus = typeof COMMUNITY_STATUS[keyof typeof COMMUNITY_STATUS];

// ═══════════════════════════════════════════════════════════════
// CORE INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface Talent {
  id: UUID;
  slug: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;

  email: string;
  phone?: string;

  city?: string;
  region?: string;
  country?: string;
  coordinates?: Coordinates;
  remote_ready?: boolean;
  willing_to_relocate?: boolean;

  // Profile
  profile_tags?: ProfileTag[]; // Max recommandé: plusieurs tags
  goals?: Goal[]; // Max 3

  embedding?: Vector;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface Skill {
  id: UUID;
  canonical_name: string;
  slug: string;
  aliases?: string[];

  type: SkillType;
  domain?: string;

  parent_skill_id?: UUID;

  esco_uri?: string;
  onet_code?: string;

  embedding?: Vector;
  typical_evidence?: string[];
  growth_trend?: GrowthTrend;

  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface Project {
  id: UUID;
  title: string;
  slug: string;
  description?: string;

  type?: ProjectType;
  visibility?: ProjectVisibility;

  started_at?: ISODate;
  ended_at?: ISODate;
  status?: ProjectStatus;

  thumbnail_url?: string;
  gallery?: string[];

  embedding?: Vector;

  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface ProjectLink {
  id: UUID;
  project_id: UUID;
  type: LinkType;
  url: string;
  title?: string;
}

export interface Organization {
  id: UUID;
  name: string;
  slug: string;

  type?: OrganizationType;
  sectors?: Sector[]; // Plusieurs secteurs possibles
  size?: OrganizationSize;

  description?: string;
  logo_url?: string;
  website_url?: string;

  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  headquarters_coordinates?: Coordinates;

  verification_status?: OrgVerificationStatus;

  embedding?: Vector;
  culture_summary?: string;

  // Ownership
  created_by?: UUID; // Talent qui a créé l'organisation

  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface Community {
  id: UUID;
  name: string;
  slug: string;
  type?: CommunityType;

  description?: string;
  rules?: string;
  application_questions?: string[];

  // Tags (replaces categories)
  tags?: string[]; // Max 3
  // Sectors
  sectors?: Sector[]; // Max 5

  // Visibility (replaces access_type)
  visibility?: Visibility;
  // Legacy access_type for backward compatibility
  access_type?: AccessType;

  // Pricing
  is_paid?: boolean;
  monthly_price?: number;
  currency?: string; // ISO currency code (XOF, EUR, USD, etc.)
  trial_period_days?: 0 | 1 | 3 | 7 | 30; // Free trial period in days

  // Location
  city?: string;
  region?: string;
  country?: string;
  coordinates?: Coordinates;

  // Media
  cover_image_url?: string;
  images?: string[]; // Array of image URLs

  status?: CommunityStatus;
  embedding?: Vector;

  // Ownership
  created_by?: UUID; // Talent qui a créé la communauté
  organization_id?: UUID; // Organization that owns the community

  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

// Structure de tarification pour les hubs
export interface HubPricing {
  type: 'FREE' | 'HOURLY' | 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  base_amount?: number;
  currency?: string; // XOF, EUR, USD
  includes_tax?: boolean;
  description?: string;
  membership_required?: boolean;
  deposit_amount?: number;
}

// Espace interne d'un hub (salle, bureau, etc.)
export interface HubSpace {
  id: string;
  name: string;
  type: SpaceType;

  // Dimensions
  surface_m2: number;
  capacity: number; // Calculé automatiquement selon densité

  // Localisation dans le hub
  floor: number; // 0 = RDC, -1 = sous-sol, 1+ = étages

  // Caractéristiques
  is_accessible: boolean; // Accessible PMR
  equipment?: string[]; // Équipements spécifiques

  // Réservation
  is_bookable: boolean;
  hourly_rate?: number;
  daily_rate?: number;
  currency?: string;

  // Média
  image_url?: string;
}

export interface Hub {
  id: UUID;
  name: string;
  slug: string;

  type?: HubType;
  description?: string;
  amenities?: string[];

  // Localisation
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  coordinates?: Coordinates;

  // Caractéristiques physiques
  usage_category?: HubUsageCategory;
  surface_m2?: number;
  max_capacity?: number;
  floors_count?: number;

  // Accessibilité
  is_accessible?: boolean;
  accessibility_features?: AccessibilityFeature[];
  accessibility_info_url?: string;

  // Sécurité
  safety_equipment?: SafetyEquipment[];
  last_inspection_date?: ISODate;
  safety_certificate_url?: string;

  // Espaces internes
  spaces?: HubSpace[];

  // Accès et tarification
  access_type?: AccessType;
  pricing?: HubPricing;

  // Ownership
  created_by?: UUID;
  organization_id?: UUID;

  // Embedding pour recherche sémantique
  embedding?: Vector;

  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface Opportunity {
  id: UUID;
  title: string;
  slug: string;

  type?: OpportunityType;
  contract_type?: ContractType;
  work_rhythm?: WorkRhythm;

  summary?: string;
  requirements?: string;
  nice_to_have?: string;

  compensation_min?: number;
  compensation_max?: number;
  currency?: string;
  compensation_frequency?: CompensationFrequency;

  location_type?: LocationType;
  locations?: OpportunityLocation[];

  posted_at?: ISOTimestamp;
  deadline?: ISOTimestamp;
  start_date?: ISODate;
  duration?: string; // Interval

  status?: OpportunityStatus;

  // Organization and sectors
  organization_id?: UUID;
  sectors?: string[];

  // Media
  cover_image_url?: string;
  images?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type?: string;
    size?: number;
  }>;

  // Application settings
  cv_required?: boolean;
  application_questions?: Array<{
    id: string;
    question: string;
    required: boolean;
    max_length?: number;
  }>;

  // Metrics (computed/optional)
  views_count?: number;
  applications_count?: number;

  // Internal fields (not exposed to frontend typically)
  embedding?: Vector;
  ideal_candidate_summary?: string;

  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp; // Soft delete
}

export interface Document {
  id: UUID;
  talent_id: UUID;
  title: string;
  type: DocumentType;
  category: DocumentCategory;

  // File storage
  file_url?: string;
  front_image_url?: string;  // For identity documents
  back_image_url?: string;   // For identity documents
  file_hash?: string;
  file_size?: number;
  mime_type?: string;

  // Metadata
  issued_by?: string;
  issued_at?: ISODate;
  expires_at?: ISODate;
  credential_id?: string;
  verification_url?: string;

  // Verification
  verification_status: DocumentVerificationStatus;
  rejection_reason?: string;
  verified_by?: UUID;
  verified_at?: ISOTimestamp;
  submitted_at?: ISOTimestamp;

  // Skill extraction
  skills_extracted?: boolean;
  skills_extracted_at?: ISOTimestamp;
  extracted_text?: string;
  summary?: string;

  // Visibility & flags
  visibility?: DocumentVisibility;
  is_primary?: boolean;

  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
  deleted_at?: ISOTimestamp;
}

export interface DocumentRequirement {
  id: UUID;
  feature: string;
  required_category?: DocumentCategory;
  required_type?: DocumentType;
  must_be_verified: boolean;
  description_fr?: string;
  description_en?: string;
  priority: number;
  is_active: boolean;
}

export interface DocumentSkill {
  id: UUID;
  document_id: UUID;
  skill_id?: UUID;
  skill_name: string;
  relevance_score?: number;
  is_auto_generated: boolean;
}

// ═══════════════════════════════════════════════════════════════
// RELATION INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface TalentSkill {
  id: UUID;
  talent_id: UUID;
  skill_id: UUID;

  proficiency_level: ProficiencyLevel;
  self_assessed?: boolean;
  endorsed_count: number;
  verified_by?: UUID[]; // Documents qui prouvent cette compétence

  years_of_experience?: number;
  last_used_at?: ISODate;
  context?: string;
}

export interface TalentProject {
  id: UUID;
  talent_id: UUID;
  project_id: UUID;

  role?: string;
  contribution_type?: ContributionType;
  contribution_summary?: string;
  started_at?: ISODate;
  ended_at?: ISODate;
  is_highlighted?: boolean;
}

export interface TalentExperience {
  id: UUID;
  talent_id: UUID;
  organization_id: UUID;

  job_title: string;
  work_type?: WorkType;

  started_at: ISODate;
  ended_at?: ISODate;
  is_current?: boolean;

  responsibilities?: string;
  city?: string;
  country?: string;
  remote?: boolean;

  verified?: boolean;
  verified_by?: UUID; // Document ou Talent qui vérifie
}

export interface TalentEducation {
  id: UUID;
  talent_id: UUID;
  organization_id: UUID;

  degree_type?: DegreeType;
  field_of_study?: string;

  started_at?: ISODate;
  ended_at?: ISODate;
  graduated?: boolean;
  gpa?: number;
  honors?: string[];
  thesis_title?: string;
}

export interface OpportunityApplication {
  id: UUID;
  talent_id: UUID;
  opportunity_id: UUID;

  applied_at: ISOTimestamp;
  status: ApplicationStatus;
  cover_letter?: string;
  custom_answers?: ApplicationAnswer[];
}

export interface TalentLearningGoal {
  id: UUID;
  talent_id: UUID;
  skill_id: UUID;

  priority?: Priority;
  reason?: string;
  target_level?: ProficiencyLevel;
  created_at: ISOTimestamp;
}

export interface SkillEndorsement {
  id: UUID;
  endorser_id: UUID;
  talent_skill_id: UUID;

  relationship_context?: string;
  comment?: string;
  created_at: ISOTimestamp;
}

export interface OpportunityPoster {
  id: UUID;
  opportunity_id: UUID;

  poster_talent_id?: UUID;
  poster_organization_id?: UUID;

  role?: PosterRole;
  posted_at: ISOTimestamp;
}

export interface OpportunityBookmark {
  talent_id: UUID;
  opportunity_id: UUID;
  created_at: ISOTimestamp;
  notes?: string;
}

export interface Connection {
  id: UUID;
  from_talent_id: UUID;
  to_talent_id: UUID;

  relationship_type?: RelationshipType;
  context?: string;
  connected_at: ISOTimestamp;
}

export interface Recommendation {
  id: UUID;
  recommender_id: UUID;
  recommended_id: UUID;

  relationship?: string;
  recommendation_text?: string;
  highlighted_skill_ids?: UUID[];

  created_at: ISOTimestamp;
  visibility?: DocumentVisibility;
}

export interface CommunityMember {
  id: UUID;
  talent_id: UUID;
  community_id: UUID;

  // Role & Type (Simplified: ADMIN = org members, MEMBER = everyone else)
  role?: 'ADMIN' | 'MEMBER';
  membership_type?: MembershipType;
  permissions?: string[]; // Granular permission overrides

  // Status
  status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';

  // Application
  answers?: Array<{ question: string; answer: string }>; // Membership application answers
  accepted_rules?: boolean;

  // Dates
  joined_at?: ISODate;
  left_at?: ISODate;
  is_active?: boolean;

  // Rejection
  rejected_at?: ISOTimestamp;
  rejection_reason?: string;

  // Timestamps
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

export interface HubBooking {
  id: UUID;
  talent_id: UUID;
  hub_id: UUID;

  booking_date?: ISOTimestamp;
  duration?: string; // Interval
  status?: BookingStatus;
}

export interface TalentDocument {
  talent_id: UUID;
  document_id: UUID;

  uploaded_at: ISOTimestamp;
  is_primary?: boolean;
}

export interface OrganizationHub {
  organization_id: UUID;
  hub_id: UUID;

  relationship?: HubRelationship;
}

export interface SkillRelation {
  from_skill_id: UUID;
  to_skill_id: UUID;

  relationship_type?: SkillRelationshipType;
  strength?: number;
}

export interface SkillEvolution {
  from_skill_id: UUID;
  to_skill_id: UUID;

  typical_path?: string;
}

// ═══════════════════════════════════════════════════════════════
// SKILL RELATION INTERFACES (Auto-generated by LLM)
// ═══════════════════════════════════════════════════════════════

export interface ProjectSkill {
  project_id: UUID;
  skill_id: UUID;
  relevance_score?: number;
  is_auto_generated?: boolean;
  created_at?: ISOTimestamp;
}

export interface OpportunitySkill {
  opportunity_id: UUID;
  skill_id: UUID;
  is_required?: boolean;
  proficiency_level?: ProficiencyLevel;
  relevance_score?: number;
  is_auto_generated?: boolean;
  created_at?: ISOTimestamp;
}

export interface HubSkill {
  hub_id: UUID;
  skill_id: UUID;
  relevance_score?: number;
  is_auto_generated?: boolean;
  created_at?: ISOTimestamp;
}

export interface CommunitySkill {
  community_id: UUID;
  skill_id: UUID;
  relevance_score?: number;
  is_auto_generated?: boolean;
  created_at?: ISOTimestamp;
}

export interface OrganizationSkill {
  organization_id: UUID;
  skill_id: UUID;
  relevance_score?: number;
  is_auto_generated?: boolean;
  created_at?: ISOTimestamp;
}
