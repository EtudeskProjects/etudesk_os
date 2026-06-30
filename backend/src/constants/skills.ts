/**
 * Skills Constants
 * Aligned with the digital skills referential (datasets/etudesk_digital_skills)
 * and the EVALUATION_FRAMEWORK. The catalog (competencies table) is the single
 * source of truth; talent_skills rows are catalog-constrained UserCompetency rows.
 */

// --- Catalog competency types (competencies.type — lowercase, 5 types) ---

export const CATALOG_TYPES = {
  KNOWLEDGE: 'knowledge',
  HARD_SKILL: 'hard_skill',
  SOFT_SKILL: 'soft_skill',
  TOOL_PLATFORM: 'tool_platform',
  LANGUAGE: 'language',
} as const;

export type CatalogType = (typeof CATALOG_TYPES)[keyof typeof CATALOG_TYPES];

export function isValidCatalogType(type: string): type is CatalogType {
  return Object.values(CATALOG_TYPES).includes(type as CatalogType);
}

/**
 * Map a free-text / legacy skill type label to a canonical catalog type.
 * The single harmonization point so every surface (CV generator, document
 * normalizers, exports) speaks the 5 referential types — not legacy "hard"/"soft".
 * Returns undefined when nothing maps (callers fall back to a neutral default).
 */
export function canonicalCatalogType(raw?: string): CatalogType | undefined {
  const t = (raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!t) return undefined;
  if (isValidCatalogType(t)) return t;
  if (/(knowledge|connaissance|savoir|concept|theory|theorie)/.test(t)) return CATALOG_TYPES.KNOWLEDGE;
  if (/(soft|behaviou?r|comportement|interpersonnel|relationnel)/.test(t)) return CATALOG_TYPES.SOFT_SKILL;
  if (/(tool|platform|plateforme|outil|software|logiciel|saas|framework)/.test(t)) return CATALOG_TYPES.TOOL_PLATFORM;
  if (/(language|langue|langage)/.test(t)) return CATALOG_TYPES.LANGUAGE;
  if (/(hard|technical|technique|tech|metier|business)/.test(t)) return CATALOG_TYPES.HARD_SKILL;
  return undefined;
}

// --- Levels (talent_skills.level — aligned to EVALUATION_FRAMEWORK) ---

export const LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  MASTER: 'master',
} as const;

export type Level = (typeof LEVELS)[keyof typeof LEVELS];

export const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'advanced', 'master'];

export const LEVEL_SCORE: Record<Level, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  master: 4,
};

export const SCORE_LEVEL: Record<number, Level> = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'master',
};

export function isValidLevel(level: string): level is Level {
  return LEVEL_ORDER.includes(level as Level);
}

export function levelToScore(level: Level): number {
  return LEVEL_SCORE[level] ?? 1;
}

export function scoreToLevel(score: number): Level {
  return SCORE_LEVEL[Math.max(1, Math.min(4, Math.round(score)))];
}

// --- Skill origin (talent_skills.origin) ---

export const SKILL_ORIGINS = {
  DECLARED: 'declared',     // User manually declared the skill
  INFERRED: 'inferred',     // AI inferred from quiz/conversation
  EXTRACTED: 'extracted',   // Extracted from uploaded documents (CV/diploma)
  VALIDATED: 'validated',   // System-validated via participation (opp/community/space)
} as const;

export type SkillOrigin = (typeof SKILL_ORIGINS)[keyof typeof SKILL_ORIGINS];

export function isValidSkillOrigin(origin: string): origin is SkillOrigin {
  return Object.values(SKILL_ORIGINS).includes(origin as SkillOrigin);
}

// --- Decay state (talent_skills.decay_state) ---

export const DECAY_STATES = {
  ACTIVE: 'active',
  STALE: 'stale',
  ARCHIVED: 'archived',
} as const;

export type DecayState = (typeof DECAY_STATES)[keyof typeof DECAY_STATES];

// --- Versions ---
// CATALOG_VERSION is authoritative in the DB (competencies.catalog_version, set by
// the seed from the manifest). This is the framework version used at write time.

export const FRAMEWORK_VERSION = '2026-06-24';

// --- Document Skill Extraction Limits ---

export const SKILL_EXTRACTION_LIMITS = {
  MIN_SKILLS_PER_DOCUMENT: 3,
  MAX_SKILLS_PER_DOCUMENT: 30,
} as const;
