/**
 * Manage Skills Tool — add/update a CATALOG skill for the talent.
 *
 * Skills are catalog-constrained: the agent passes a free-text label, which is
 * resolved to a referential competency slug. Unresolved labels are rejected with
 * suggestions so the agent can retry. All writes go through the evaluation
 * service (framework guards apply); the agent can never write `master`.
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { logger } from '../../../utils';
import { i18next } from '../../../i18n';
import * as catalog from '../../skills/catalog.service';
import { evaluateBatch, AxisReading } from '../../skills/evaluation.service';
import { Level } from '../../../constants/skills';

export function createManageSkillsTool(authenticatedTalentId: string, language?: string, sessionId?: string) {
  return defineTool({
    name: 'manage_skills',
    description:
      'Add or update a skill for the authenticated talent. Skills MUST exist in the Etudesk competency catalog — pass the skill label (e.g. "React", "Analyse de donnees") and it is resolved to a catalog entry. If it cannot be resolved, you receive suggestions to retry with. Use only after explicit user confirmation and sufficient evidence: applied practice, a realistic scenario, a project/artifact, document analysis, or multiple consistent learning signals. Quiz answers alone are not sufficient for a level upgrade. When you have assessed the learner, optionally pass the A/C/I/T axes (Autonomy, Complexity, Impact, Transmission, each 1-4) so the level is graded by the evaluation framework. For an intermediate update after explained applied practice, use A=2,C=2,I=2,T=2; do not pass T=1 with level=intermediate because the framework will keep the skill at beginner. You can never set "master" — that is reserved for verified evaluation. Always confirm with the user before calling.',
    parameters: z.object({
      skillQuery: z
        .string()
        .min(1)
        .max(120)
        .describe('The skill label to resolve against the catalog (e.g. "React", "Prompt Engineering", "Gestion de projet").'),
      level: z
        .enum(['beginner', 'intermediate', 'advanced', 'master'])
        .describe('Target level. "master" is not allowed for agent writes and will be capped to "advanced".'),
      origin: z
        .enum(['declared', 'inferred', 'extracted'])
        .default('inferred')
        .describe('"declared" (user claims it), "inferred" (from quiz/conversation), "extracted" (from a document).'),
      axisA: z.number().int().min(1).max(4).optional().describe('Autonomy 1-4 (optional, improves grading).'),
      axisC: z.number().int().min(1).max(4).optional().describe('Complexity 1-4 (optional).'),
      axisI: z.number().int().min(1).max(4).optional().describe('Impact 1-4 (optional).'),
      axisT: z.number().int().min(1).max(4).optional().describe('Transmission 1-4 (optional).'),
    }),
    normalize: (raw: any) => {
      // Accept aliases / nested shapes from the model
      const first = raw.skills && Array.isArray(raw.skills) && raw.skills.length > 0 ? raw.skills[0] : raw;
      return {
        skillQuery: first.skillQuery || first.skillName || first.name || first.skill_name || raw.skillQuery,
        level: (first.level || first.proficiencyLevel || raw.level || 'inferred')?.toString().toLowerCase(),
        origin: (first.origin || 'inferred')?.toString().toLowerCase(),
        axisA: first.axisA ?? first.A,
        axisC: first.axisC ?? first.C,
        axisI: first.axisI ?? first.I,
        axisT: first.axisT ?? first.T,
      };
    },
    execute: async ({ skillQuery, level, origin, axisA, axisC, axisI, axisT }) => {
      const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });
      const talentId = authenticatedTalentId;

      try {
        const resolved = await catalog.resolveLabel(skillQuery);
        if (!resolved) {
          const suggestions = await catalog.suggestCompetencies(skillQuery, 3);
          return {
            success: false,
            error: tr('copilot:toolSkillNotInCatalog', { name: skillQuery }) || `"${skillQuery}" is not in the skills catalog.`,
            suggestions: suggestions.map((s) => ({ slug: s.slug, name: s.name, name_fr: s.name_fr })),
          };
        }

        const requestedLevel = (level as Level) || 'beginner';
        const axes: AxisReading | undefined =
          axisA && axisC && axisI && axisT ? { A: axisA, C: axisC, I: axisI, T: axisT } : undefined;

        const [result] = await evaluateBatch({
          talentId,
          targets: [
            {
              slug: resolved.slug,
              origin: origin as 'declared' | 'inferred' | 'extracted',
              axes,
              assertedLevel: axes ? undefined : requestedLevel,
              // agent-driven evidence: a behavioral signal (quiz/conversation) unless declared
              signals: [
                {
                  kind: origin === 'declared' ? 'declared' : 'behavioral',
                  source_ref: sessionId ? `session:${sessionId}` : 'copilot:study',
                  note: 'study agent assessment',
                },
              ],
              evaluatedBy: 'study_agent',
              // agent can never push past advanced
              levelCap: 'advanced',
            },
          ],
        });

        if (!result || result.status !== 'written') {
          return {
            success: false,
            error: tr('copilot:toolSkillInsufficientEvidence', { name: resolved.name }) || 'Not enough evidence to record this skill yet.',
          };
        }

        logger.info(`[manage_skills] ${origin} "${resolved.slug}" -> ${result.level} (conf ${result.confidence.toFixed(2)}) for talent ${talentId}`);
        return {
          success: true,
          message: tr('copilot:toolSkillAdded', { name: resolved.name_fr || resolved.name, level: result.level }),
          skill: {
            slug: resolved.slug,
            name: resolved.name_fr || resolved.name,
            level: result.level,
            confidence: Number(result.confidence.toFixed(2)),
            origin: result.origin,
          },
        };
      } catch (error: any) {
        logger.error(`[manage_skills] Error (${origin} ${skillQuery}): ${error.message}`);
        return { success: false, error: error.message };
      }
    },
  });
}
