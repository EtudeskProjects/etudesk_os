/**
 * Shared skills vocabulary — aligned with the digital skills referential (backend).
 *
 * Single source of truth for the mobile app: per-type icon + color + i18n label,
 * proficiency levels, origins and decay state. Used by the skills screen, talent
 * profile, copilot cards and entity skill-tag chips so a given skill TYPE always
 * gets the same icon everywhere.
 */

import {
  BookOpen,
  Wrench,
  Users,
  Boxes,
  Languages,
  Gem,
  User,
  Sparkles,
  FileText,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { ThemeColors, withOpacity } from './theme';

// --- Catalog competency types (lowercase, 5 types) ---

export type CatalogType = 'knowledge' | 'hard_skill' | 'soft_skill' | 'tool_platform' | 'language';

export const CATALOG_TYPES: CatalogType[] = ['knowledge', 'hard_skill', 'soft_skill', 'tool_platform', 'language'];

/** Coerce a value to a catalog competency type (5-type set). */
export function normalizeType(value?: string | null): CatalogType {
  const v = (value || '').toLowerCase();
  if (v === 'knowledge' || v === 'hard_skill' || v === 'soft_skill' || v === 'tool_platform' || v === 'language') {
    return v;
  }
  return 'hard_skill';
}

interface TypeConfig {
  Icon: LucideIcon;
  color: (c: ThemeColors) => string;
  labelKey: string; // i18n key under labels.skillTypes
}

const TYPE_CONFIG: Record<CatalogType, TypeConfig> = {
  knowledge: { Icon: BookOpen, color: (c) => c.warning, labelKey: 'labels.skillTypes.knowledge' },
  hard_skill: { Icon: Wrench, color: (c) => c.info, labelKey: 'labels.skillTypes.hard_skill' },
  soft_skill: { Icon: Users, color: (c) => c.success, labelKey: 'labels.skillTypes.soft_skill' },
  tool_platform: { Icon: Boxes, color: (c) => c.primary, labelKey: 'labels.skillTypes.tool_platform' },
  language: { Icon: Languages, color: (c) => c.primaryLight, labelKey: 'labels.skillTypes.language' },
};

export function getSkillTypeConfig(type: string | null | undefined, colors: ThemeColors) {
  const t = normalizeType(type);
  const cfg = TYPE_CONFIG[t] || { Icon: Gem, color: (c: ThemeColors) => c.gray500, labelKey: 'labels.skillTypes.hard_skill' };
  return { type: t, Icon: cfg.Icon, color: cfg.color(colors), labelKey: cfg.labelKey };
}

// --- Levels (beginner | intermediate | advanced | master) ---

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'master';

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced', 'master'];

export const LEVEL_SCORE: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3, master: 4 };

/** Coerce a value to a catalog level (beginner|intermediate|advanced|master). */
export function normalizeLevel(value?: string | null): Level {
  const v = (value || '').toLowerCase();
  if (v === 'beginner' || v === 'intermediate' || v === 'advanced' || v === 'master') return v;
  return 'beginner';
}

const LEVEL_COLOR: Record<Level, (c: ThemeColors) => string> = {
  beginner: (c) => c.gray500,
  intermediate: (c) => c.info,
  advanced: (c) => c.warning,
  master: (c) => c.success,
};

const LEVEL_OPACITY: Record<Level, number> = {
  beginner: 0.08,
  intermediate: 0.15,
  advanced: 0.25,
  master: 0.38,
};

export function getLevelConfig(level: string | null | undefined, colors: ThemeColors) {
  const l = normalizeLevel(level);
  const color = LEVEL_COLOR[l](colors);
  return {
    level: l,
    color,
    bg: withOpacity(color, LEVEL_OPACITY[l]),
    opacity: LEVEL_OPACITY[l],
    labelKey: `labels.proficiencyLevels.${l}`,
  };
}

// --- Origins (declared | inferred | extracted | validated) ---

export type SkillOrigin = 'declared' | 'inferred' | 'extracted' | 'validated';

interface OriginConfig {
  Icon: LucideIcon;
  color: (c: ThemeColors) => string;
  labelKey: string;
}

const ORIGIN_CONFIG: Record<SkillOrigin, OriginConfig> = {
  declared: { Icon: User, color: (c) => c.gray500, labelKey: 'settings.skills.origin.declared' },
  inferred: { Icon: Sparkles, color: (c) => c.info, labelKey: 'settings.skills.origin.inferred' },
  extracted: { Icon: FileText, color: (c) => c.warning, labelKey: 'settings.skills.origin.extracted' },
  validated: { Icon: BadgeCheck, color: (c) => c.success, labelKey: 'settings.skills.origin.validated' },
};

export function getOriginConfig(origin: string | null | undefined, colors: ThemeColors) {
  const o = (origin || 'declared').toLowerCase() as SkillOrigin;
  const cfg = ORIGIN_CONFIG[o] || ORIGIN_CONFIG.declared;
  return { origin: o, Icon: cfg.Icon, color: cfg.color(colors), labelKey: cfg.labelKey };
}

// --- Decay state (active | stale | archived) ---

export type DecayState = 'active' | 'stale' | 'archived';

export function getDecayConfig(decay: string | null | undefined, colors: ThemeColors) {
  const d = (decay || 'active').toLowerCase() as DecayState;
  if (d === 'stale') return { state: d, color: colors.warning, labelKey: 'settings.skills.decay.stale', show: true };
  if (d === 'archived') return { state: d, color: colors.gray500, labelKey: 'settings.skills.decay.archived', show: true };
  return { state: 'active' as DecayState, color: colors.success, labelKey: 'settings.skills.decay.active', show: false };
}

// --- Entity skill-tag requirement / role ---

export function getRequirementConfig(requirement: string | null | undefined, colors: ThemeColors) {
  const r = (requirement || 'required').toLowerCase();
  if (r === 'nice_to_have') {
    return { requirement: 'nice_to_have', color: colors.gray500, labelKey: 'labels.skillRequirement.nice_to_have' };
  }
  return { requirement: 'required', color: colors.primary, labelKey: 'labels.skillRequirement.required' };
}

// --- Display helpers ---

export interface SkillLike {
  name?: string | null;
  name_fr?: string | null;
  title?: string | null;
}

/** Pick the best display name for a skill given the active locale. */
export function skillDisplayName(skill: SkillLike, locale?: string): string {
  const isFr = (locale || '').toLowerCase().startsWith('fr');
  if (isFr && skill.name_fr) return skill.name_fr;
  return skill.name || skill.name_fr || skill.title || '';
}
