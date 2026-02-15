/**
 * Manage Skills Tool — Add/Update/Remove skills for the talent
 * Factory pattern with injected authenticatedTalentId for IDOR protection
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { pool } from '../../database';
import { logger } from '../../../utils';

export function createManageSkillsTool(authenticatedTalentId: string) {
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
    execute: async ({ action: rawAction, skillName, proficiencyLevel: rawLevel, origin: rawOrigin, type: rawType }) => {
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
            // Check if skill already exists
            const existing = await pool.query(
              `SELECT id, proficiency_level FROM talent_skills WHERE talent_id = $1 AND LOWER(canonical_name) = LOWER($2)`,
              [talentId, skillName]
            );

            if (existing.rows.length > 0) {
              return {
                success: false,
                error: `La compétence "${skillName}" existe déjà (niveau: ${existing.rows[0].proficiency_level}). Utilise l'action "update" pour changer le niveau.`,
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
              message: `Compétence "${skillName}" ajoutée avec le niveau ${proficiencyLevel}.`,
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
                error: `La compétence "${skillName}" n'existe pas. Utilise l'action "add" pour l'ajouter.`,
              };
            }

            logger.info(`[manage_skills] Updated skill "${skillName}" to ${proficiencyLevel} for talent ${talentId}`);
            return {
              success: true,
              message: `Compétence "${skillName}" mise à jour au niveau ${proficiencyLevel}.`,
              skill: result.rows[0],
            };
          }

          default:
            return { success: false, error: `Action "${action}" non supportée` };
        }
      } catch (error: any) {
        logger.error(`[manage_skills] Error (${action} ${skillName}): ${error.message}`);
        return { success: false, error: error.message };
      }
    },
  });
}
