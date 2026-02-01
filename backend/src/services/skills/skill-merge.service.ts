/**
 * Skill Merge Service
 * Merges extracted skills with declared skills for a talent
 */

import { pool } from '../database';

export interface MergeReport {
  merged: number;
  kept_declared: number;
  new_extracted: number;
}

const PROFICIENCY_ORDER = ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'];

/**
 * Merge extracted skills with declared skills for a talent.
 * - Declared always wins on origin
 * - Proficiency is upgraded if extracted is higher
 * - Extracted-only skills are kept as-is
 */
export async function mergeExtractedSkills(talentId: string): Promise<MergeReport> {
  const report: MergeReport = { merged: 0, kept_declared: 0, new_extracted: 0 };

  // Get all talent_skills grouped by skill_id
  const result = await pool.query(
    `SELECT id, skill_id, proficiency_level, origin
     FROM talent_skills
     WHERE talent_id = $1
     ORDER BY skill_id, origin ASC`,
    [talentId]
  );

  // Group by skill_id
  const bySkill = new Map<string, Array<{ id: string; proficiency_level: string; origin: string }>>();
  for (const row of result.rows) {
    const list = bySkill.get(row.skill_id) || [];
    list.push(row);
    bySkill.set(row.skill_id, list);
  }

  for (const [, entries] of bySkill) {
    if (entries.length <= 1) {
      // No duplicates
      if (entries[0].origin === 'extracted') {
        report.new_extracted++;
      } else {
        report.kept_declared++;
      }
      continue;
    }

    // Multiple entries for same skill — find declared and extracted
    const declared = entries.find((e) => e.origin === 'declared');
    const extracted = entries.find((e) => e.origin === 'extracted');

    if (declared && extracted) {
      // Upgrade proficiency if extracted is higher
      const declaredIdx = PROFICIENCY_ORDER.indexOf(declared.proficiency_level);
      const extractedIdx = PROFICIENCY_ORDER.indexOf(extracted.proficiency_level);

      if (extractedIdx > declaredIdx) {
        await pool.query(
          `UPDATE talent_skills SET proficiency_level = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [extracted.proficiency_level, declared.id]
        );
      }

      // Remove the extracted duplicate
      await pool.query(`DELETE FROM talent_skills WHERE id = $1`, [extracted.id]);
      report.merged++;
    } else {
      report.kept_declared++;
    }
  }

  return report;
}

export default { mergeExtractedSkills };
