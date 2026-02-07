/**
 * Skill Loader
 * Loads skill definitions from .skill.md files.
 * In-memory cache with singleton pattern (like ontology.cache.ts).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition, SkillMetadata } from './skill.types';
import { logger } from '../../../utils';

const SKILLS_DIR = path.join(__dirname, 'definitions');

// In-memory cache
let cachedSkills: SkillDefinition[] | null = null;

/**
 * Parse a .skill.md file into a SkillDefinition.
 * Format:
 *   ---
 *   name: Skill Name
 *   description: Short description
 *   modes: explore, study
 *   tools: sql_query, file_reader
 *   triggers: keyword1, keyword2
 *   ---
 *   # Instructions body (markdown)
 */
function parseSkillFile(filePath: string): SkillDefinition | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const id = path.basename(filePath, '.skill.md');

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      logger.warn(`[skill.loader] Invalid format in ${filePath} — no frontmatter found`);
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const instructions = frontmatterMatch[2].trim();

    const getValue = (key: string): string => {
      const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const getList = (key: string): string[] => {
      const value = getValue(key);
      return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
    };

    return {
      id,
      name: getValue('name') || id,
      description: getValue('description') || '',
      modes: getList('modes') as Array<'explore' | 'study' | 'org'>,
      tools: getList('tools'),
      triggers: getList('triggers'),
      instructions,
    };
  } catch (error: any) {
    logger.error(`[skill.loader] Error parsing ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Load all skill definitions from disk. Cached after first call.
 */
function loadAllSkills(): SkillDefinition[] {
  if (cachedSkills) return cachedSkills;

  try {
    if (!fs.existsSync(SKILLS_DIR)) {
      logger.info('[skill.loader] No definitions directory found, returning empty');
      cachedSkills = [];
      return cachedSkills;
    }

    const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill.md'));
    cachedSkills = files
      .map((f) => parseSkillFile(path.join(SKILLS_DIR, f)))
      .filter((s): s is SkillDefinition => s !== null);

    logger.info(`[skill.loader] Loaded ${cachedSkills.length} skill definitions`);
    return cachedSkills;
  } catch (error: any) {
    logger.error(`[skill.loader] Error loading skills: ${error.message}`);
    cachedSkills = [];
    return cachedSkills;
  }
}

/**
 * Get lightweight metadata for all skills (~100 tokens total for prompt injection).
 */
export function loadAllSkillMetadata(): SkillMetadata[] {
  return loadAllSkills().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    modes: s.modes,
  }));
}

/**
 * Get skill metadata filtered by mode.
 */
export function getSkillsForMode(mode: 'explore' | 'study' | 'org'): SkillMetadata[] {
  return loadAllSkillMetadata().filter((s) => s.modes.includes(mode));
}

/**
 * Get the full instructions body for a skill (loaded on demand).
 */
export function getSkillBody(skillId: string): string | null {
  const skill = loadAllSkills().find((s) => s.id === skillId);
  return skill?.instructions || null;
}

/**
 * Force reload skills from disk (useful for development).
 */
export function reloadSkills(): void {
  cachedSkills = null;
  loadAllSkills();
}
