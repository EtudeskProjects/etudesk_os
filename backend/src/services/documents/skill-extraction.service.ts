/**
 * Skill Extraction Service
 * Saves extracted skills from documents into the talent's skill profile
 */

import { pool } from '../database';
import { ExtractedSkill } from './extraction.service';
import { isValidSkillType } from '../../constants/skills';

export interface SkillExtractionResult {
  added: number;
  skipped: number;
  skills: Array<{ name: string; type: string; action: 'added' | 'skipped' }>;
}

/**
 * Generate a URL-safe slug from a skill name, handling French accents
 */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Save extracted skills from a document into the talent's profile.
 * Uses ON CONFLICT to handle concurrent extractions safely.
 */
export async function extractAndSaveSkills(
  talentId: string,
  documentId: string,
  extractedSkills: ExtractedSkill[]
): Promise<SkillExtractionResult> {
  const result: SkillExtractionResult = { added: 0, skipped: 0, skills: [] };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const skill of extractedSkills) {
      if (!skill.name || !skill.type || !isValidSkillType(skill.type)) continue;

      const slug = slugify(skill.name);
      if (!slug) continue;

      // Find or create the skill in the catalog (race-safe)
      // Store canonical_name in Title Case
      const canonicalName = toTitleCase(skill.name.trim());

      const upsertSkill = await client.query(
        `INSERT INTO skills (canonical_name, slug, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [canonicalName, slug, skill.type]
      );

      let skillId: string;
      if (upsertSkill.rows.length > 0) {
        skillId = upsertSkill.rows[0].id;
      } else {
        const existing = await client.query(`SELECT id FROM skills WHERE slug = $1`, [slug]);
        skillId = existing.rows[0].id;
      }

      // Check if talent already has this skill
      const existingLink = await client.query(
        `SELECT id, origin FROM talent_skills WHERE talent_id = $1 AND skill_id = $2`,
        [talentId, skillId]
      );

      if (existingLink.rows.length > 0) {
        if (existingLink.rows[0].origin === 'declared') {
          result.skipped++;
          result.skills.push({ name: skill.name, type: skill.type, action: 'skipped' });
          continue;
        }
        // Update existing extracted skill with new document context
        await client.query(
          `UPDATE talent_skills SET context = $1 WHERE id = $2`,
          [skill.context || null, existingLink.rows[0].id]
        );
        result.skipped++;
        result.skills.push({ name: skill.name, type: skill.type, action: 'skipped' });
        continue;
      }

      // Map proficiency hint to level
      const proficiency = mapProficiencyHint(skill.proficiency_hint);

      // Insert talent_skill (race-safe)
      const inserted = await client.query(
        `INSERT INTO talent_skills (talent_id, skill_id, proficiency_level, origin, context)
         VALUES ($1, $2, $3, 'extracted', $4)
         ON CONFLICT (talent_id, skill_id) DO NOTHING
         RETURNING id`,
        [talentId, skillId, proficiency, skill.context || null]
      );

      if (inserted.rows.length > 0) {
        result.added++;
        result.skills.push({ name: skill.name, type: skill.type, action: 'added' });
      } else {
        result.skipped++;
        result.skills.push({ name: skill.name, type: skill.type, action: 'skipped' });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return result;
}

/**
 * Convert a string to Title Case (e.g. "gestion de projet" → "Gestion De Projet")
 */
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

function mapProficiencyHint(hint?: string): string {
  if (!hint) return 'INTERMEDIATE';
  const upper = hint.toUpperCase();
  if (['MASTER', 'EXPERT', 'INTERMEDIATE', 'BEGINNER'].includes(upper)) return upper;
  return 'INTERMEDIATE';
}

export default { extractAndSaveSkills };
