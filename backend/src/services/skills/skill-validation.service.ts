/**
 * Skill Validation via Participation
 *
 * Real-world participation validates catalog skills on a talent:
 *   - joining a community       -> the community's soft skills
 *   - confirmed space booking   -> the space/workshop's hard skills + tools
 *   - accepted to an opportunity -> the opportunity's linked skills
 *
 * Each event feeds a `validated` signal into the evaluation service (framework
 * guards apply). Bounded by VALIDATION_CAPS; never produces `master`. Idempotent
 * via source_ref de-dup in the evaluation upsert. Best-effort and async — callers
 * fire-and-forget so the user response is never blocked.
 */

import { pool } from '../database';
import { logger } from '../../utils';
import { evaluateBatch, EvalTarget } from './evaluation.service';
import { VALIDATION_CAPS } from '../../constants/evaluation';

/** Opportunity ACCEPTED -> validate the opportunity's linked skills. */
export async function validateFromOpportunity(talentId: string, opportunityId: string): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT competency_slug, requirement FROM opportunity_skills WHERE opportunity_id = $1`,
      [opportunityId]
    );
    if (rows.length === 0) return;
    const cap = VALIDATION_CAPS.opportunity;
    const targets: EvalTarget[] = rows.map((r) => ({
      slug: r.competency_slug,
      origin: 'validated',
      // required skills get a level anchor; nice_to_have are softer
      assertedLevel: r.requirement === 'required' ? cap.level : 'intermediate',
      signals: [{ kind: 'artifact', source_ref: `opportunity:${opportunityId}`, note: 'accepted to opportunity' }],
      evaluatedBy: 'participation:opportunity',
      levelCap: cap.level,
      confidenceCap: cap.confidence,
    }));
    await evaluateBatch({ talentId, targets });
    logger.info(`[skill-validation] opportunity ${opportunityId} validated ${targets.length} skills for talent ${talentId}`);
  } catch (err: any) {
    logger.error(`[skill-validation] validateFromOpportunity failed: ${err.message}`);
  }
}

/** Community joined -> validate the community's soft skills. */
export async function validateFromCommunity(talentId: string, communityId: string): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT cs.competency_slug
       FROM community_skills cs JOIN competencies c ON c.slug = cs.competency_slug
       WHERE cs.community_id = $1 AND cs.role = 'validates' AND c.type = 'soft_skill'`,
      [communityId]
    );
    if (rows.length === 0) return;
    const cap = VALIDATION_CAPS.community;
    const targets: EvalTarget[] = rows.map((r) => ({
      slug: r.competency_slug,
      origin: 'validated',
      assertedLevel: cap.level,
      signals: [{ kind: 'behavioral', source_ref: `community:${communityId}`, note: 'community participation' }],
      evaluatedBy: 'participation:community',
      levelCap: cap.level,
      confidenceCap: cap.confidence,
    }));
    await evaluateBatch({ talentId, targets });
    logger.info(`[skill-validation] community ${communityId} validated ${targets.length} soft skills for talent ${talentId}`);
  } catch (err: any) {
    logger.error(`[skill-validation] validateFromCommunity failed: ${err.message}`);
  }
}

/** Space/workshop booking confirmed -> validate the space's hard skills + tools. */
export async function validateFromSpace(talentId: string, spaceId: string): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT ss.competency_slug
       FROM space_skills ss JOIN competencies c ON c.slug = ss.competency_slug
       WHERE ss.space_id = $1 AND ss.role = 'validates' AND c.type IN ('hard_skill','tool_platform')`,
      [spaceId]
    );
    if (rows.length === 0) return;
    const cap = VALIDATION_CAPS.space;
    const targets: EvalTarget[] = rows.map((r) => ({
      slug: r.competency_slug,
      origin: 'validated',
      assertedLevel: cap.level,
      signals: [{ kind: 'behavioral', source_ref: `space:${spaceId}`, note: 'space/workshop attendance' }],
      evaluatedBy: 'participation:space',
      levelCap: cap.level,
      confidenceCap: cap.confidence,
    }));
    await evaluateBatch({ talentId, targets });
    logger.info(`[skill-validation] space ${spaceId} validated ${targets.length} hard skills for talent ${talentId}`);
  } catch (err: any) {
    logger.error(`[skill-validation] validateFromSpace failed: ${err.message}`);
  }
}

export default { validateFromOpportunity, validateFromCommunity, validateFromSpace };
