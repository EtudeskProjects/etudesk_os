/**
 * Manage Skills Tool — Add/Update/Remove skills for the talent
 * Factory pattern with injected authenticatedTalentId for IDOR protection
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { pool } from '../../database';
import { logger } from '../../../utils';
import { i18next } from '../../../i18n';

export function createManageSkillsTool(authenticatedTalentId: string, language?: string) {
  return defineTool({
    name: 'manage_skills',
    description:
      'Add or update skills for the authenticated talent. Use after the user demonstrates mastery (passes quizzes, completes exercises) or when analyzing documents. Always ask for confirmation before modifying skills.',
    parameters: z.object({
      action: z.string().describe('The action to perform: "add" or "update"'),
      skillName: z.string().describe('The canonical name of the skill (e.g., "React", "Python", "Data Analysis")'),
      proficiencyLevel: z
        .string()
        .describe('Proficiency level: BEGINNER (knows basics), INTERMEDIATE (can apply independently), EXPERT (deep mastery), MASTER (can teach and innovate).'),
      origin: z
        .string()
        .describe('How the skill was identified: "declared" (user claims it), "inferred" (detected from conversation/quiz), "extracted" (from CV/certificates/documents).'),
      type: z
        .string()
        .describe('Skill category: HARD_SKILL (technical/domain), SOFT_SKILL (interpersonal), KNOWLEDGE (theoretical).'),
    }),
    normalize: (raw) => {
      // Handle nested format: {skills: [{action, name, ...}]} → flat
      if (raw.skills && Array.isArray(raw.skills) && raw.skills.length > 0) {
        const first = raw.skills[0];
        return {
          action: first.action || raw.action,
          skillName: first.skillName || first.name || first.skill_name,
          proficiencyLevel: first.proficiencyLevel || first.level || first.proficiency_level,
          origin: first.origin || 'inferred',
          type: first.type || 'HARD_SKILL',
        };
      }
      // Handle alias: name → skillName, skill_name → skillName
      return {
        ...raw,
        skillName: raw.skillName || raw.name || raw.skill_name,
        proficiencyLevel: raw.proficiencyLevel || raw.level || raw.proficiency_level,
      };
    },
    execute: async ({ action: rawAction, skillName, proficiencyLevel: rawLevel, origin: rawOrigin, type: rawType }) => {
      const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });
      // Normalize enum values (Claude native SDK may send mixed case)
      const action = rawAction.toLowerCase() as 'add' | 'update';
      const proficiencyLevel = rawLevel.toUpperCase() as 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER';
      const origin = rawOrigin.toLowerCase() as 'declared' | 'inferred' | 'extracted';
      const type = rawType.toUpperCase() as 'HARD_SKILL' | 'SOFT_SKILL' | 'KNOWLEDGE';
      const is_visible = true; // Skills are visible by default; users toggle visibility from profile settings
      const talentId = authenticatedTalentId;

      try {
        switch (action) {
          case 'add': {
            // Check if skill already exists (exact match)
            const existing = await pool.query(
              `SELECT id, proficiency_level FROM talent_skills WHERE talent_id = $1 AND LOWER(canonical_name) = LOWER($2)`,
              [talentId, skillName]
            );

            if (existing.rows.length > 0) {
              // Smart merge: if new level is higher, auto-upgrade instead of rejecting
              const LEVEL_ORDER = ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'];
              const currentIdx = LEVEL_ORDER.indexOf(existing.rows[0].proficiency_level);
              const newIdx = LEVEL_ORDER.indexOf(proficiencyLevel);
              if (newIdx > currentIdx) {
                await pool.query(
                  `UPDATE talent_skills SET proficiency_level = $3, updated_at = NOW()
                   WHERE talent_id = $1 AND LOWER(canonical_name) = LOWER($2)`,
                  [talentId, skillName, proficiencyLevel]
                );
                logger.info(`[manage_skills] Auto-upgraded skill "${skillName}" from ${existing.rows[0].proficiency_level} to ${proficiencyLevel} for talent ${talentId}`);
                return {
                  success: true,
                  message: tr('copilot:toolSkillAutoUpgraded', { name: skillName, from: existing.rows[0].proficiency_level, to: proficiencyLevel }),
                  skill: { name: skillName, level: proficiencyLevel, origin, merged: true },
                };
              }
              return {
                success: false,
                error: tr('copilot:toolSkillAlreadyExists', { name: skillName, level: existing.rows[0].proficiency_level }),
              };
            }

            // Check max 100 skills limit
            const countResult = await pool.query(
              `SELECT COUNT(*)::int AS total FROM talent_skills WHERE talent_id = $1`,
              [talentId]
            );
            if (countResult.rows[0].total >= 100) {
              return {
                success: false,
                error: tr('copilot:toolMaxSkillsReached'),
              };
            }

            await pool.query(
              `INSERT INTO talent_skills (talent_id, canonical_name, proficiency_level, origin, type, is_visible)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [talentId, skillName, proficiencyLevel, origin, type, is_visible]
            );

            logger.info(`[manage_skills] Added skill "${skillName}" (${proficiencyLevel}) for talent ${talentId}`);
            return {
              success: true,
              message: tr('copilot:toolSkillAdded', { name: skillName, level: proficiencyLevel }),
              skill: { name: skillName, level: proficiencyLevel, origin },
            };
          }

          case 'update': {
            const updates = ['proficiency_level = $3', 'is_visible = $4', 'updated_at = NOW()'];
            const params: any[] = [talentId, skillName, proficiencyLevel, is_visible];
            const result = await pool.query(
              `UPDATE talent_skills SET ${updates.join(', ')}
               WHERE talent_id = $1 AND LOWER(canonical_name) = LOWER($2)
               RETURNING id, canonical_name, proficiency_level, is_visible`,
              params
            );

            if (result.rows.length === 0) {
              return {
                success: false,
                error: tr('copilot:toolSkillNotFound', { name: skillName }),
              };
            }

            logger.info(`[manage_skills] Updated skill "${skillName}" to ${proficiencyLevel} for talent ${talentId}`);
            return {
              success: true,
              message: tr('copilot:toolSkillLevelUpdated', { name: skillName, level: proficiencyLevel }),
              skill: result.rows[0],
            };
          }

          default:
            return { success: false, error: tr('copilot:toolActionUnsupported', { action }) };
        }
      } catch (error: any) {
        logger.error(`[manage_skills] Error (${action} ${skillName}): ${error.message}`);
        return { success: false, error: error.message };
      }
    },
  });
}
