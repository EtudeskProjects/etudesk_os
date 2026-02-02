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

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER';

export const OPPORTUNITY_TYPES = {
  EMPLOYMENT: "EMPLOYMENT",
  INTERNSHIP: "INTERNSHIP",
  ENTREPRENEURSHIP: "ENTREPRENEURSHIP",
  ALTERNATION: "ALTERNATION",
  FREELANCE: "FREELANCE",
  VOLUNTEER: "VOLUNTEER"
} as const;
export type OpportunityType = typeof OPPORTUNITY_TYPES[keyof typeof OPPORTUNITY_TYPES];

// Types d'espaces internes
export const SPACE_TYPES = {
  // Formation
  SALLE_COURS: "SALLE_COURS",
  SALLE_INFORMATIQUE: "SALLE_INFORMATIQUE",
  AMPHITHEATRE: "AMPHITHEATRE",
  SALLE_FORMATION: "SALLE_FORMATION",
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
  LABORATOIRE: "LABORATOIRE",
  STUDIO: "STUDIO",
  // Événement
  SALLE_EVENEMENT: "SALLE_EVENEMENT",
  ROOFTOP: "ROOFTOP",
  TERRASSE: "TERRASSE"
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

// Densité m² par personne selon le type d'espace
export const SPACE_TYPE_DENSITY: Record<SpaceType, number> = {
  [SPACE_TYPES.SALLE_COURS]: 2,
  [SPACE_TYPES.SALLE_INFORMATIQUE]: 3,
  [SPACE_TYPES.AMPHITHEATRE]: 0.8,
  [SPACE_TYPES.SALLE_FORMATION]: 2.5,
  [SPACE_TYPES.OPEN_SPACE]: 7,
  [SPACE_TYPES.BUREAU_PRIVE]: 12,
  [SPACE_TYPES.POSTE_NOMADE]: 4,
  [SPACE_TYPES.SALLE_REUNION]: 2.5,
  [SPACE_TYPES.SALLE_CONFERENCE]: 1.5,
  [SPACE_TYPES.CABINE_APPEL]: 2,
  [SPACE_TYPES.ATELIER]: 5,
  [SPACE_TYPES.LABORATOIRE]: 8,
  [SPACE_TYPES.STUDIO]: 6,
  [SPACE_TYPES.SALLE_EVENEMENT]: 1,
  [SPACE_TYPES.ROOFTOP]: 2,
  [SPACE_TYPES.TERRASSE]: 2
};

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
  bio?: string;
  avatar_url?: string;

  email: string;
  phone?: string;

  gender?: string;

  city?: string;
  region?: string;
  country?: string;
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

// ═══════════════════════════════════════════════════════════════
// RELATION INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface TalentSkill {
  id: UUID;
  talent_id: UUID;
  canonical_name: string;
  type: SkillType;

  proficiency_level: ProficiencyLevel;
  source?: string;
  document_id?: UUID;
  context?: string;
  created_at?: ISOTimestamp;
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
  created_at: ISOTimestamp;
  visibility?: Visibility;
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


