/**
 * Skills Constants
 * Aligned with database schema (talent_skills table)
 */

// --- Skill Types Talent_skills.Type ---

export const SKILL_TYPES = {
  KNOWLEDGE: 'KNOWLEDGE',       // Savoir (theoretical knowledge)
  SOFT_SKILL: 'SOFT_SKILL',     // Savoir-être (soft skills / behavioral)
  HARD_SKILL: 'HARD_SKILL',     // Savoir-faire (practical skills)
} as const;

export type SkillType = (typeof SKILL_TYPES)[keyof typeof SKILL_TYPES];

export function isValidSkillType(type: string): type is SkillType {
  return Object.values(SKILL_TYPES).includes(type as SkillType);
}

// --- Proficiency Levels Talent_skills.Proficiency_level ---

export const PROFICIENCY_LEVELS = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  EXPERT: 'EXPERT',
  MASTER: 'MASTER',
} as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[keyof typeof PROFICIENCY_LEVELS];

export function isValidProficiencyLevel(level: string): level is ProficiencyLevel {
  return Object.values(PROFICIENCY_LEVELS).includes(level as ProficiencyLevel);
}

// --- Skill Origin Talent_skills.Origin ---

export const SKILL_ORIGINS = {
  DECLARED: 'declared',     // User manually declared the skill
  INFERRED: 'inferred',     // AI inferred from profile/activity
  EXTRACTED: 'extracted',   // Extracted from uploaded documents
} as const;

export type SkillOrigin = (typeof SKILL_ORIGINS)[keyof typeof SKILL_ORIGINS];

export function isValidSkillOrigin(origin: string): origin is SkillOrigin {
  return Object.values(SKILL_ORIGINS).includes(origin as SkillOrigin);
}

// --- Document Skill Extraction Limits ---

export const SKILL_EXTRACTION_LIMITS = {
  MIN_SKILLS_PER_DOCUMENT: 3,
  MAX_SKILLS_PER_DOCUMENT: 30,
} as const;
