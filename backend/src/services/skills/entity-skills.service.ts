/**
 * Entity Skill Tagging — attach CATALOG skills to opportunities, communities and
 * spaces. Labels are resolved to competency slugs; non-catalog labels are dropped
 * (reported) so only referential skills are ever tagged.
 */

import { pool } from '../database';
import { logger } from '../../utils';
import * as catalog from './catalog.service';

export interface OpportunitySkillInput {
  skill: string; // slug or label
  requirement?: 'required' | 'nice_to_have';
  weight?: number;
  min_level?: 'beginner' | 'intermediate' | 'advanced' | 'master';
}

export interface EntitySkillInput {
  skill: string; // slug or label
  role?: string;
}

export interface TagResult {
  applied: Array<{ slug: string; name: string }>;
  dropped: string[];
}

async function resolveAll(
  inputs: Array<{ skill: string }>
): Promise<Map<number, { slug: string; name: string }>> {
  const out = new Map<number, { slug: string; name: string }>();
  for (let i = 0; i < inputs.length; i++) {
    const r = await catalog.resolveLabel(inputs[i].skill);
    if (r) out.set(i, { slug: r.slug, name: r.name });
  }
  return out;
}

export async function setOpportunitySkills(
  opportunityId: string,
  skills: OpportunitySkillInput[] | undefined
): Promise<TagResult | null> {
  if (!skills) return null;
  const resolved = await resolveAll(skills);
  const result: TagResult = { applied: [], dropped: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM opportunity_skills WHERE opportunity_id = $1', [opportunityId]);
    const seen = new Set<string>();
    for (let i = 0; i < skills.length; i++) {
      const r = resolved.get(i);
      if (!r) {
        result.dropped.push(skills[i].skill);
        continue;
      }
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      await client.query(
        `INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight, min_level)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (opportunity_id, competency_slug) DO UPDATE
           SET requirement = EXCLUDED.requirement, weight = EXCLUDED.weight, min_level = EXCLUDED.min_level`,
        [opportunityId, r.slug, skills[i].requirement || 'required', skills[i].weight ?? 1.0, skills[i].min_level ?? null]
      );
      result.applied.push(r);
    }
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error(`[entity-skills] setOpportunitySkills failed: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
  if (result.dropped.length) logger.info(`[entity-skills] opportunity ${opportunityId} dropped non-catalog: ${result.dropped.join(', ')}`);
  return result;
}

async function setEntitySkills(
  table: 'community_skills' | 'space_skills',
  idColumn: 'community_id' | 'space_id',
  entityId: string,
  skills: EntitySkillInput[] | undefined
): Promise<TagResult | null> {
  if (!skills) return null;
  const resolved = await resolveAll(skills);
  const result: TagResult = { applied: [], dropped: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [entityId]);
    const seen = new Set<string>();
    for (let i = 0; i < skills.length; i++) {
      const r = resolved.get(i);
      if (!r) {
        result.dropped.push(skills[i].skill);
        continue;
      }
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      await client.query(
        `INSERT INTO ${table} (${idColumn}, competency_slug, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (${idColumn}, competency_slug) DO UPDATE SET role = EXCLUDED.role`,
        [entityId, r.slug, skills[i].role || 'validates']
      );
      result.applied.push(r);
    }
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error(`[entity-skills] set ${table} failed: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
  if (result.dropped.length) logger.info(`[entity-skills] ${table} ${entityId} dropped non-catalog: ${result.dropped.join(', ')}`);
  return result;
}

export const setCommunitySkills = (communityId: string, skills?: EntitySkillInput[]) =>
  setEntitySkills('community_skills', 'community_id', communityId, skills);

export const setSpaceSkills = (spaceId: string, skills?: EntitySkillInput[]) =>
  setEntitySkills('space_skills', 'space_id', spaceId, skills);

export default { setOpportunitySkills, setCommunitySkills, setSpaceSkills };
