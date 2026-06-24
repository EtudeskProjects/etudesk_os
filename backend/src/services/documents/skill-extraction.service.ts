/**
 * Skill Extraction Service
 * Maps skills extracted from a document (CV / diploma) to the digital skills
 * catalog and records them on the talent through the evaluation service.
 * Skills that cannot be resolved to a catalog competency are dropped (logged).
 */

import { ExtractedSkill } from './extraction.service';
import { logger } from '../../utils';
import * as catalog from '../skills/catalog.service';
import { evaluateBatch, EvalTarget } from '../skills/evaluation.service';
import { Level, isValidLevel } from '../../constants/skills';

export interface SkillExtractionResult {
  added: number;
  skipped: number;
  skills: Array<{ name: string; slug?: string; action: 'added' | 'skipped' }>;
}

/**
 * Resolve extracted skills to catalog slugs and persist them as `extracted`
 * UserCompetency rows (level capped at advanced; a document is an artifact).
 */
export async function extractAndSaveSkills(
  talentId: string,
  documentId: string,
  extractedSkills: ExtractedSkill[]
): Promise<SkillExtractionResult> {
  const result: SkillExtractionResult = { added: 0, skipped: 0, skills: [] };

  const targets: EvalTarget[] = [];
  const labelBySlug = new Map<string, string>();

  for (const skill of extractedSkills) {
    if (!skill.name) continue;
    const resolved = await catalog.resolveLabel(skill.name);
    if (!resolved) {
      logger.info(`[skill-extraction] dropped non-catalog skill "${skill.name}" (talent ${talentId})`);
      result.skipped++;
      result.skills.push({ name: skill.name, action: 'skipped' });
      continue;
    }
    const level = mapProficiencyHint(skill.proficiency_hint);
    targets.push({
      slug: resolved.slug,
      origin: 'extracted',
      assertedLevel: level,
      // a CV / diploma is an artifact-strength signal
      signals: [{ kind: 'artifact', source_ref: `doc:${documentId}`, note: skill.context }],
      evaluatedBy: 'document_extraction',
      levelCap: 'advanced', // extracted/document claims never auto-create master
    });
    labelBySlug.set(resolved.slug, resolved.name_fr || resolved.name);
  }

  if (targets.length === 0) return result;

  const evals = await evaluateBatch({ talentId, targets });
  for (const e of evals) {
    if (e.status === 'written') {
      result.added++;
      result.skills.push({ name: labelBySlug.get(e.slug) || e.slug, slug: e.slug, action: 'added' });
    } else {
      result.skipped++;
      result.skills.push({ name: labelBySlug.get(e.slug) || e.slug, slug: e.slug, action: 'skipped' });
    }
  }

  return result;
}

function mapProficiencyHint(hint?: string): Level {
  if (!hint) return 'intermediate';
  const lower = hint.toLowerCase();
  if (isValidLevel(lower)) return lower as Level;
  // legacy uppercase hints
  const legacy: Record<string, Level> = {
    master: 'master',
    expert: 'advanced',
    advanced: 'advanced',
    intermediate: 'intermediate',
    beginner: 'beginner',
  };
  return legacy[lower] || 'intermediate';
}

export default { extractAndSaveSkills };
