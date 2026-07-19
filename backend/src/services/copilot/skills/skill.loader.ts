/**
 * Skill Loader
 * Loads skill definitions from .skill.md files.
 * In-memory cache with singleton pattern (like ontology.cache.ts).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition, SkillMetadata } from './skill.types';
import { logger } from '../../../utils';
import { generateEmbedding, cosineSimilarity } from '../../embedding.service';

const SKILLS_DIR = path.join(__dirname, 'definitions');

/** Tools available per mode — used for validation */
const AVAILABLE_TOOLS: Record<'explore' | 'study' | 'org', readonly string[]> = {
  explore: [
    'smart_search',
    'sql_query',
    'generate_document',
    'file_reader',
    'web_search',
    'find_competency',
    'competency_graph',
    'learning_path',
    'execute_action',
  ],
  study: [
    'sql_query',
    'youtube_search',
    'generate_image',
    'generate_diagram',
    'file_reader',
    'web_search',
    'manage_skills',
    'find_competency',
    'competency_graph',
    'learning_path',
    'execute_action',
  ],
  org: [
    'smart_search',
    'sql_query',
    'generate_document',
    'file_reader',
    'web_search',
    'find_competency',
    'competency_graph',
    'execute_action',
  ],
};

// NOTE: Charts/tables are not tools. Agents render them directly with ```chart blocks.

// In-memory cache
let cachedSkills: SkillDefinition[] | null = null;

/** Cosine similarity threshold — below this, no skill matches */
const SKILL_MATCH_THRESHOLD = 0.45;
const SKILL_DETECTION_TIMEOUT_MS = Number(process.env.COPILOT_SKILL_DETECTION_TIMEOUT_MS || 700);

function isExplicitSkillMatchRequest(message: string): boolean {
  return /\b(suis-je fait|qu['’]est-ce qui me manque|compétences? manquantes?|competences? manquantes?|gap|écart|ecart|prêt pour|pret pour|match avec|mon profil correspond|actuel vs cible|pour (?:ce|un) (?:poste|métier|metier|job|offre))\b/i.test(message);
}

/**
 * Parse a .skill.md file into a SkillDefinition.
 * Format:
 *   ---
 *   name: Skill Name
 *   description: Short description
 *   modes: explore, study
 *   tools: sql_query, file_reader
 *   triggers: keyword1, keyword2
 *   priority: 5  (optional, higher = preferred when multiple skills match)
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

    const getNumber = (key: string): number | undefined => {
      const val = getValue(key);
      if (!val) return undefined;
      const n = parseInt(val, 10);
      return isNaN(n) ? undefined : n;
    };

    const modes = getList('modes') as Array<'explore' | 'study' | 'org'>;
    const tools = getList('tools');

    // Validate tools are available for each mode
    for (const mode of modes) {
      const allowed = AVAILABLE_TOOLS[mode];
      for (const t of tools) {
        if (!allowed.includes(t)) {
          logger.warn(
            `[skill.loader] Skill ${id}: tool "${t}" is not available in mode "${mode}". Allowed: ${allowed.join(', ')}`
          );
        }
      }
    }

    return {
      id,
      name: getValue('name') || id,
      description: getValue('description') || '',
      modes,
      tools,
      triggers: getList('triggers'),
      priority: getNumber('priority'),
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
 * Static (substring) skill detection — original logic, used as fallback.
 * Checks if any trigger keyword appears in the normalized message.
 * If multiple skills match: (1) pick the one with the most trigger hits, (2) on tie, pick the one with highest priority.
 */
export function detectSkillFromMessageStatic(
  message: string,
  mode: 'explore' | 'study' | 'org',
  country?: string
): { skillId: string; skillName: string; instructions: string } | null {
  const skills = loadAllSkills().filter((s) => s.modes.includes(mode));
  const normalizedMsg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let bestMatch: SkillDefinition | null = null;
  let bestHits = 0;
  let bestPriority = -1;

  for (const skill of skills) {
    let hits = 0;
    for (const trigger of skill.triggers) {
      const normalizedTrigger = trigger.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Skip very short triggers (< 3 chars) to avoid false positives on common words
      if (normalizedTrigger.length < 3) continue;
      if (normalizedMsg.includes(normalizedTrigger)) {
        hits++;
      }
    }
    if (hits === 0) continue;

    const priority = skill.priority ?? 0;
    const isBetter = hits > bestHits || (hits === bestHits && priority > bestPriority);
    if (isBetter) {
      bestHits = hits;
      bestPriority = priority;
      bestMatch = skill;
    }
  }

  if (!bestMatch || bestHits === 0) return null;

  return {
    skillId: bestMatch.id,
    skillName: bestMatch.name,
    instructions: bestMatch.instructions,
  };
}

/**
 * Pre-compute embeddings for all skills at startup.
 * Uses generateEmbedding() which has a 24h cache — only calls API on first run.
 * Non-blocking: server starts immediately, embeddings compute in background.
 */
export async function precomputeSkillEmbeddings(): Promise<void> {
  const skills = loadAllSkills();
  let computed = 0;

  const results = await Promise.allSettled(
    skills.map(async (skill) => {
      const text = `${skill.description}. ${skill.triggers.join(', ')}`;
      const embedding = await generateEmbedding(text);
      skill.embedding = embedding;
      computed++;
    })
  );

  const failures = results.filter((r) => r.status === 'rejected').length;
  if (failures > 0) {
    logger.warn(`[skill.loader] Pre-computed embeddings for ${computed}/${skills.length} skills (${failures} failed)`);
  } else {
    logger.info(`[skill.loader] Pre-computed embeddings for ${computed}/${skills.length} skills`);
  }
}

/**
 * Detect which skill (if any) matches the user's message for a given mode.
 * Semantic routing is mandatory. A missing embedding is a configuration error
 * during development, not a reason to silently select a different workflow.
 * Returns the full instructions body of the best-matching skill, or null.
 */
export async function detectSkillFromMessage(
  message: string,
  mode: 'explore' | 'study' | 'org',
  country?: string
): Promise<{ skillId: string; skillName: string; instructions: string } | null> {
  const skills = loadAllSkills().filter((s) => s.modes.includes(mode));
  const hasEmbeddings = skills.some((s) => s.embedding);
  if (!hasEmbeddings) {
    throw new Error('Skill embeddings are not ready');
  }

  try {
    const messageEmbedding = await Promise.race([
      generateEmbedding(message),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`skill detection timed out after ${SKILL_DETECTION_TIMEOUT_MS}ms`)), SKILL_DETECTION_TIMEOUT_MS);
      }),
    ]);

    let bestMatch: SkillDefinition | null = null;
    let bestScore = -1;

    for (const skill of skills) {
      if (!skill.embedding) continue;

      const similarity = cosineSimilarity(messageEmbedding, skill.embedding);
      // Small priority boost for tie-breaking (priority 8 → +0.04)
      let score = similarity + (skill.priority ?? 0) * 0.005;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = skill;
      }
    }

    if (!bestMatch || bestScore < SKILL_MATCH_THRESHOLD) return null;
    if (bestMatch.id === 'skill-match' && !isExplicitSkillMatchRequest(message)) return null;

    return {
      skillId: bestMatch.id,
      skillName: bestMatch.name,
      instructions: bestMatch.instructions,
    };
  } catch (error: any) {
    // Semantic routing enriches a turn; it must never make the Copilot
    // unavailable. The base agent prompt remains complete without a skill.
    logger.warn(`[skill.loader] Semantic detection unavailable: ${error.message}`);
    return null;
  }
}

/**
 * Force reload skills from disk (useful for development).
 */
export function reloadSkills(): void {
  cachedSkills = null;
  loadAllSkills();
}
