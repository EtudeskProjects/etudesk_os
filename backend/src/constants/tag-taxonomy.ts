/**
 * Canonical closed-tag referential.
 *
 * Persisted tags use UPPER_SNAKE_CASE only. Labels belong to i18n, never to
 * database rows. Skills are intentionally excluded: they use the competency
 * catalog and stable slugs instead of this enum referential.
 */
import { SECTORS, type Sector } from '../types/models';

export const CANONICAL_SECTORS = Object.values(SECTORS) as [Sector, ...Sector[]];

export const CANONICAL_PROFILE_TAGS = [
  'STUDENT', 'PUPIL', 'JOB_SEEKER', 'SALARIED', 'ENTREPRENEUR',
  'CIVIL_SERVANT', 'MANAGER', 'CONSULTANT', 'INVESTOR',
  'CONTENT_CREATOR', 'COACH', 'RETIRED',
] as const;

export const CANONICAL_GOALS = [
  'LEARN_NEW_SKILLS', 'PREPARE_EXAMS', 'FIND_JOB', 'ADVANCE_CAREER',
  'RESEARCH_SUPPORT', 'IMPROVE_PRODUCTIVITY', 'COLLABORATIVE_LEARNING',
  'TEACH_OR_MENTOR', 'BUILD_NETWORK_OR_VISIBILITY', 'CONTRIBUTE_OR_GIVE_BACK',
] as const;

export function normalizeTagCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function normalizeClosedTags(values: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(values)) return null;
  const known = new Set(allowed);
  const result = [...new Set(values.filter((value): value is string => typeof value === 'string')
    .map(normalizeTagCode))];
  return result.every((value) => known.has(value)) ? result : null;
}
