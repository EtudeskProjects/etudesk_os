/**
 * Skill Reconciliation Service
 *
 * With the catalog-constrained model, a talent can hold at most one row per
 * competency (UNIQUE(talent_id, competency_slug)), so the old declared/extracted
 * de-duplication is enforced by the schema and the evaluation service. This entry
 * point now just recomputes decay state for the talent's skills and reports the
 * current active/stale split (kept for API compatibility with document.service).
 */

import { pool } from '../database';
import { applyDecay } from './evaluation.service';

export interface MergeReport {
  active: number;
  stale: number;
  archived: number;
}

export async function mergeExtractedSkills(talentId: string): Promise<MergeReport> {
  await applyDecay(talentId);
  const { rows } = await pool.query(
    `SELECT decay_state, COUNT(*)::int AS n
     FROM talent_skills WHERE talent_id = $1 GROUP BY decay_state`,
    [talentId]
  );
  const report: MergeReport = { active: 0, stale: 0, archived: 0 };
  for (const r of rows) {
    if (r.decay_state === 'active') report.active = r.n;
    else if (r.decay_state === 'stale') report.stale = r.n;
    else if (r.decay_state === 'archived') report.archived = r.n;
  }
  return report;
}

export default { mergeExtractedSkills };
