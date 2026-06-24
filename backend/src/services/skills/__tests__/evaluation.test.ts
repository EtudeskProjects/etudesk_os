/**
 * Unit tests for the pure evaluation-framework math (no DB / LLM).
 * Run: npx tsx src/services/skills/__tests__/evaluation.test.ts
 */

import { rawLevelFromAxes, computePrior, decayStateFor } from '../evaluation.service';
import { scoreToLevel, levelToScore } from '../../../constants/skills';
import { GLOBAL_ACTIVE_CAPS, FAMILY_ACTIVE_CAPS, TECH_FAMILIES_HIGH_CAP } from '../../../constants/evaluation';

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  assert(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b));
}

console.log('rawLevelFromAxes');
eq('all 1 -> 1', rawLevelFromAxes({ A: 1, C: 1, I: 1, T: 1 }), 1);
eq('all 4 -> 4 (master needs T=4)', rawLevelFromAxes({ A: 4, C: 4, I: 4, T: 4 }), 4);
eq('high but T=3 caps at 3', rawLevelFromAxes({ A: 4, C: 4, I: 4, T: 3 }), 3);
eq('low autonomy caps (min with A)', rawLevelFromAxes({ A: 1, C: 4, I: 4, T: 4 }), 1);
eq('mixed 3,3,2,2 -> 2', rawLevelFromAxes({ A: 3, C: 3, I: 2, T: 2 }), 2);

console.log('level <-> score');
eq('scoreToLevel(3)', scoreToLevel(3), 'advanced');
eq('levelToScore(master)', levelToScore('master'), 4);

console.log('computePrior');
eq('no neighbors -> null', computePrior([]), null);
{
  // strong prerequisite neighbor at score 4 -> base ~ 4*0.9*0.9=3.24 -> round 3 -> prior 2, cap strong=3
  const r = computePrior([
    { slug: 'x', relation: 'prerequisite', strength: 0.9, score: 4, confidence: 0.9, sameFamily: true },
  ]);
  assert('strong prereq gives prior >= 1 and <= 3', !!r && r.prior >= 1 && r.prior <= 3);
  assert('inferred_from recorded', !!r && r.from.includes('x'));
}
{
  // weak co_occurrence default cap 2
  const r = computePrior([
    { slug: 'y', relation: 'co_occurrence', strength: 0.3, score: 4, confidence: 0.5, sameFamily: false },
  ]);
  assert('weak neighbor capped at 2', !!r && r.prior <= 2);
}

console.log('decayStateFor');
{
  const now = new Date();
  eq('no evidence -> active', decayStateFor('ai_ml', 'hard_skill', null), 'active');
  const old = new Date(now.getTime() - 40 * 30.4375 * 24 * 3600 * 1000); // ~40 months
  eq('fast cycle 40mo -> archived', decayStateFor('ai_ml', 'hard_skill', old), 'archived');
  const recent = new Date(now.getTime() - 6 * 30.4375 * 24 * 3600 * 1000); // ~6 months
  eq('fast cycle 6mo -> active', decayStateFor('ai_ml', 'hard_skill', recent), 'active');
}

console.log('capacity cap constants');
{
  // Sanity check the cap tables are consistent with the framework
  eq('master global cap', GLOBAL_ACTIVE_CAPS.master, 7);
  eq('advanced global cap', GLOBAL_ACTIVE_CAPS.advanced, 35);
  eq('master per-family cap', FAMILY_ACTIVE_CAPS.master, 3);
  assert('ai_ml is a high-cap tech family', TECH_FAMILIES_HIGH_CAP.has('ai_ml'));
  assert('human_skills is not a high-cap tech family', !TECH_FAMILIES_HIGH_CAP.has('human_skills'));
}

console.log('');
console.log(`Evaluation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
