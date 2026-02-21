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

export const SECTOR_DATA: Array<{ id: Sector; label: string }> = [
  { id: 'DIGITAL', label: 'Digital & Tech' },
  { id: 'FINANCE', label: 'Finance & Banque' },
  { id: 'COMMERCE', label: 'Commerce & Distribution' },
  { id: 'HEALTH', label: 'Santé' },
  { id: 'EDUCATION', label: 'Éducation & Formation' },
  { id: 'INDUSTRY', label: 'Industrie' },
  { id: 'CONSTRUCTION', label: 'BTP & Construction' },
  { id: 'ENERGY', label: 'Énergie' },
  { id: 'ENVIRONMENT', label: 'Environnement' },
  { id: 'AGRICULTURE', label: 'Agriculture & Agroalimentaire' },
  { id: 'TRANSPORT', label: 'Transport & Logistique' },
  { id: 'TOURISM', label: 'Tourisme & Hôtellerie' },
  { id: 'MEDIA', label: 'Média & Communication' },
  { id: 'PROFESSIONAL_SERVICES', label: 'Services professionnels' },
  { id: 'RESEARCH', label: 'Recherche & Innovation' },
  { id: 'PUBLIC', label: 'Secteur public' },
  { id: 'SECURITY', label: 'Sécurité' },
  { id: 'SOCIAL_IMPACT', label: 'Impact social & ONG' },
  { id: 'PERSONAL_SERVICES', label: 'Services à la personne' },
  { id: 'CRAFTS', label: 'Artisanat' },
  { id: 'RESOURCES', label: 'Ressources naturelles' },
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

export const PROFILE_TAG_DATA: Array<{ id: ProfileTag; label: string }> = [
  { id: 'STUDENT', label: 'Étudiant' },
  { id: 'PUPIL', label: 'Élève' },
  { id: 'JOB_SEEKER', label: "En recherche d'emploi" },
  { id: 'SALARIED', label: 'Salarié' },
  { id: 'ENTREPRENEUR', label: 'Entrepreneur' },
  { id: 'CIVIL_SERVANT', label: 'Fonctionnaire' },
  { id: 'MANAGER', label: 'Manager' },
  { id: 'CONSULTANT', label: 'Consultant' },
  { id: 'INVESTOR', label: 'Investisseur' },
  { id: 'CONTENT_CREATOR', label: 'Créateur de contenu' },
  { id: 'COACH', label: 'Coach / Formateur' },
  { id: 'RETIRED', label: 'Retraité' },
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

export const GOAL_DATA: Array<{ id: Goal; label: string }> = [
  { id: 'LEARN_NEW_SKILLS', label: 'Apprendre de nouvelles compétences' },
  { id: 'PREPARE_EXAMS', label: 'Préparer des examens / concours' },
  { id: 'FIND_JOB', label: 'Trouver un emploi' },
  { id: 'ADVANCE_CAREER', label: 'Évoluer dans ma carrière' },
  { id: 'RESEARCH_SUPPORT', label: 'Aide à la recherche' },
  { id: 'IMPROVE_PRODUCTIVITY', label: 'Améliorer ma productivité' },
  { id: 'COLLABORATIVE_LEARNING', label: 'Apprentissage collaboratif' },
  { id: 'TEACH_OR_MENTOR', label: 'Enseigner ou mentorer' },
  { id: 'BUILD_NETWORK_OR_VISIBILITY', label: 'Développer mon réseau / visibilité' },
  { id: 'CONTRIBUTE_OR_GIVE_BACK', label: 'Contribuer / Redonner' },
];

export const MAX_GOALS = 3;

