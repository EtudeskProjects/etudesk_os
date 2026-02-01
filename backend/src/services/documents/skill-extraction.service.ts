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
 * Save extracted skills from a document into the talent's profile.
 * Skips skills the talent already declared manually.
 */
export async function extractAndSaveSkills(
  talentId: string,
  documentId: string,
  extractedSkills: ExtractedSkill[]
): Promise<SkillExtractionResult> {
  const result: SkillExtractionResult = { added: 0, skipped: 0, skills: [] };

  for (const skill of extractedSkills) {
    if (!skill.name || !skill.type || !isValidSkillType(skill.type)) continue;

    const slug = skill.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    if (!slug) continue;

    // Find or create the skill in the catalog
    let skillId: string;
    const existing = await pool.query(`SELECT id FROM skills WHERE slug = $1`, [slug]);

    if (existing.rows.length > 0) {
      skillId = existing.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO skills (canonical_name, slug, type) VALUES ($1, $2, $3) RETURNING id`,
        [skill.name.trim(), slug, skill.type]
      );
      skillId = created.rows[0].id;
    }

    // Check if talent already has this skill
    const existingLink = await pool.query(
      `SELECT id, origin FROM talent_skills WHERE talent_id = $1 AND skill_id = $2`,
      [talentId, skillId]
    );

    if (existingLink.rows.length > 0) {
      // Declared wins — don't overwrite
      if (existingLink.rows[0].origin === 'declared') {
        result.skipped++;
        result.skills.push({ name: skill.name, type: skill.type, action: 'skipped' });
        continue;
      }
      // Update existing extracted skill with new document context
      await pool.query(
        `UPDATE talent_skills SET document_id = $1, extraction_context = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [documentId, skill.context || null, existingLink.rows[0].id]
      );
      result.skipped++;
      result.skills.push({ name: skill.name, type: skill.type, action: 'skipped' });
      continue;
    }

    // Map proficiency hint to level
    const proficiency = mapProficiencyHint(skill.proficiency_hint);

    await pool.query(
      `INSERT INTO talent_skills (talent_id, skill_id, proficiency_level, origin, document_id, extraction_context)
       VALUES ($1, $2, $3, 'extracted', $4, $5)`,
      [talentId, skillId, proficiency, documentId, skill.context || null]
    );

    result.added++;
    result.skills.push({ name: skill.name, type: skill.type, action: 'added' });
  }

  return result;
}

function mapProficiencyHint(hint?: string): string {
  if (!hint) return 'INTERMEDIATE';
  const lower = hint.toLowerCase();
  if (lower.includes('master') || lower.includes('expert') || lower.includes('senior') || lower.includes('avancé')) {
    return 'EXPERT';
  }
  if (lower.includes('beginner') || lower.includes('débutant') || lower.includes('junior') || lower.includes('notions')) {
    return 'BEGINNER';
  }
  return 'INTERMEDIATE';
}

export default { extractAndSaveSkills };
