// Données du modèle Talent - synchronisées avec le backend

// --- Secteurs 5 Choix Max ---

export const SECTORS = {
  AGRICULTURE: 'AGRICULTURE',
  RESOURCES: 'RESOURCES',
  ENERGY: 'ENERGY',
  ENVIRONMENT: 'ENVIRONMENT',
  INDUSTRY: 'INDUSTRY',
  CONSTRUCTION: 'CONSTRUCTION',
  TRANSPORT: 'TRANSPORT',
  COMMERCE: 'COMMERCE',
  FINANCE: 'FINANCE',
  DIGITAL: 'DIGITAL',
  MEDIA: 'MEDIA',
  TOURISM: 'TOURISM',
  HEALTH: 'HEALTH',
  EDUCATION: 'EDUCATION',
  PROFESSIONAL_SERVICES: 'PROFESSIONAL_SERVICES',
  RESEARCH: 'RESEARCH',
  PUBLIC: 'PUBLIC',
  SECURITY: 'SECURITY',
  SOCIAL_IMPACT: 'SOCIAL_IMPACT',
  PERSONAL_SERVICES: 'PERSONAL_SERVICES',
  CRAFTS: 'CRAFTS',
} as const;

export type Sector = (typeof SECTORS)[keyof typeof SECTORS];

export interface LabeledItem<T> {
  id: T;
  label: string;
  labelKey: string;
}

export const SECTOR_DATA: Array<LabeledItem<Sector>> = [
  { id: 'DIGITAL', label: 'Digital & Tech', labelKey: 'labels.sectors.DIGITAL' },
  { id: 'FINANCE', label: 'Finance & Banking', labelKey: 'labels.sectors.FINANCE' },
  { id: 'COMMERCE', label: 'Commerce & Retail', labelKey: 'labels.sectors.COMMERCE' },
  { id: 'HEALTH', label: 'Health', labelKey: 'labels.sectors.HEALTH' },
  { id: 'EDUCATION', label: 'Education & Training', labelKey: 'labels.sectors.EDUCATION' },
  { id: 'INDUSTRY', label: 'Industry', labelKey: 'labels.sectors.INDUSTRY' },
  { id: 'CONSTRUCTION', label: 'Construction', labelKey: 'labels.sectors.CONSTRUCTION' },
  { id: 'ENERGY', label: 'Energy', labelKey: 'labels.sectors.ENERGY' },
  { id: 'ENVIRONMENT', label: 'Environment', labelKey: 'labels.sectors.ENVIRONMENT' },
  { id: 'AGRICULTURE', label: 'Agriculture & Food', labelKey: 'labels.sectors.AGRICULTURE' },
  { id: 'TRANSPORT', label: 'Transport & Logistics', labelKey: 'labels.sectors.TRANSPORT' },
  { id: 'TOURISM', label: 'Tourism & Hospitality', labelKey: 'labels.sectors.TOURISM' },
  { id: 'MEDIA', label: 'Media & Communication', labelKey: 'labels.sectors.MEDIA' },
  { id: 'PROFESSIONAL_SERVICES', label: 'Professional Services', labelKey: 'labels.sectors.PROFESSIONAL_SERVICES' },
  { id: 'RESEARCH', label: 'Research & Innovation', labelKey: 'labels.sectors.RESEARCH' },
  { id: 'PUBLIC', label: 'Public Sector', labelKey: 'labels.sectors.PUBLIC' },
  { id: 'SECURITY', label: 'Security', labelKey: 'labels.sectors.SECURITY' },
  { id: 'SOCIAL_IMPACT', label: 'Social Impact & NGO', labelKey: 'labels.sectors.SOCIAL_IMPACT' },
  { id: 'PERSONAL_SERVICES', label: 'Personal Services', labelKey: 'labels.sectors.PERSONAL_SERVICES' },
  { id: 'CRAFTS', label: 'Crafts', labelKey: 'labels.sectors.CRAFTS' },
  { id: 'RESOURCES', label: 'Natural Resources', labelKey: 'labels.sectors.RESOURCES' },
];

export const MAX_SECTORS = 5;

// --- Profile Tags 3 Choix Max ---

export const PROFILE_TAG = {
  STUDENT: 'STUDENT',
  PUPIL: 'PUPIL',
  JOB_SEEKER: 'JOB_SEEKER',
  SALARIED: 'SALARIED',
  ENTREPRENEUR: 'ENTREPRENEUR',
  CIVIL_SERVANT: 'CIVIL_SERVANT',
  MANAGER: 'MANAGER',
  CONSULTANT: 'CONSULTANT',
  INVESTOR: 'INVESTOR',
  CONTENT_CREATOR: 'CONTENT_CREATOR',
  COACH: 'COACH',
  RETIRED: 'RETIRED',
} as const;

export type ProfileTag = (typeof PROFILE_TAG)[keyof typeof PROFILE_TAG];

export const PROFILE_TAG_DATA: Array<LabeledItem<ProfileTag>> = [
  { id: 'STUDENT', label: 'Student', labelKey: 'labels.profileTags.STUDENT' },
  { id: 'PUPIL', label: 'Pupil', labelKey: 'labels.profileTags.PUPIL' },
  { id: 'JOB_SEEKER', label: 'Job Seeker', labelKey: 'labels.profileTags.JOB_SEEKER' },
  { id: 'SALARIED', label: 'Employee', labelKey: 'labels.profileTags.SALARIED' },
  { id: 'ENTREPRENEUR', label: 'Entrepreneur', labelKey: 'labels.profileTags.ENTREPRENEUR' },
  { id: 'CIVIL_SERVANT', label: 'Civil Servant', labelKey: 'labels.profileTags.CIVIL_SERVANT' },
  { id: 'MANAGER', label: 'Manager', labelKey: 'labels.profileTags.MANAGER' },
  { id: 'CONSULTANT', label: 'Consultant', labelKey: 'labels.profileTags.CONSULTANT' },
  { id: 'INVESTOR', label: 'Investor', labelKey: 'labels.profileTags.INVESTOR' },
  { id: 'CONTENT_CREATOR', label: 'Content Creator', labelKey: 'labels.profileTags.CONTENT_CREATOR' },
  { id: 'COACH', label: 'Coach / Trainer', labelKey: 'labels.profileTags.COACH' },
  { id: 'RETIRED', label: 'Retired', labelKey: 'labels.profileTags.RETIRED' },
];

export const MAX_PROFILE_TAGS = 3;

// --- Goals / Objectifs 3 Choix Max ---

export const GOAL = {
  LEARN_NEW_SKILLS: 'LEARN_NEW_SKILLS',
  PREPARE_EXAMS: 'PREPARE_EXAMS',
  FIND_JOB: 'FIND_JOB',
  ADVANCE_CAREER: 'ADVANCE_CAREER',
  RESEARCH_SUPPORT: 'RESEARCH_SUPPORT',
  IMPROVE_PRODUCTIVITY: 'IMPROVE_PRODUCTIVITY',
  COLLABORATIVE_LEARNING: 'COLLABORATIVE_LEARNING',
  TEACH_OR_MENTOR: 'TEACH_OR_MENTOR',
  BUILD_NETWORK_OR_VISIBILITY: 'BUILD_NETWORK_OR_VISIBILITY',
  CONTRIBUTE_OR_GIVE_BACK: 'CONTRIBUTE_OR_GIVE_BACK',
} as const;

export type Goal = (typeof GOAL)[keyof typeof GOAL];

export const GOAL_DATA: Array<LabeledItem<Goal>> = [
  { id: 'LEARN_NEW_SKILLS', label: 'Learn new skills', labelKey: 'labels.goals.LEARN_NEW_SKILLS' },
  { id: 'PREPARE_EXAMS', label: 'Prepare for exams', labelKey: 'labels.goals.PREPARE_EXAMS' },
  { id: 'FIND_JOB', label: 'Find a job', labelKey: 'labels.goals.FIND_JOB' },
  { id: 'ADVANCE_CAREER', label: 'Advance my career', labelKey: 'labels.goals.ADVANCE_CAREER' },
  { id: 'RESEARCH_SUPPORT', label: 'Research support', labelKey: 'labels.goals.RESEARCH_SUPPORT' },
  { id: 'IMPROVE_PRODUCTIVITY', label: 'Improve my productivity', labelKey: 'labels.goals.IMPROVE_PRODUCTIVITY' },
  { id: 'COLLABORATIVE_LEARNING', label: 'Collaborative learning', labelKey: 'labels.goals.COLLABORATIVE_LEARNING' },
  { id: 'TEACH_OR_MENTOR', label: 'Teach or mentor', labelKey: 'labels.goals.TEACH_OR_MENTOR' },
  { id: 'BUILD_NETWORK_OR_VISIBILITY', label: 'Build network / visibility', labelKey: 'labels.goals.BUILD_NETWORK_OR_VISIBILITY' },
  { id: 'CONTRIBUTE_OR_GIVE_BACK', label: 'Contribute / Give back', labelKey: 'labels.goals.CONTRIBUTE_OR_GIVE_BACK' },
];

export const MAX_GOALS = 3;

