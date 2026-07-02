/**
 * Evaluation Service — implements datasets/etudesk_digital_skills/EVALUATION_FRAMEWORK.md.
 *
 * This is the ONLY component allowed to write `master` to talent_skills, and the
 * single place that applies confidence guards, the graph-inference prior, decay,
 * and capacity caps. Callers (manage_skills tool, skill-validation service) feed
 * SIGNALS here; they never write raw rows.
 *
 * Split: the small per-target A/C/I/T judgment uses the Fast LLM (§3); everything
 * else — propagation, decay, caps, confidence guards — is deterministic code.
 */

import crypto from 'crypto';
import { pool } from '../database';
import { logger } from '../../utils';
import { getAIClient } from '../ai/provider';
import { MODEL_SEARCH } from '../ai/models';
import { recordUsage } from '../ai/usage.service';
import * as catalog from './catalog.service';
import {
  CatalogType,
  Level,
  FRAMEWORK_VERSION,
  LEVEL_ORDER,
  LEVEL_SCORE,
  scoreToLevel,
} from '../../constants/skills';
import {
  TYPE_LENSES,
  getFamilyProfile,
  effectiveCycle,
  FRESHNESS_PENALTY,
  DECAY_THRESHOLDS,
  BASE_CONFIDENCE,
  CONFIDENCE_GUARDS,
  INFERENCE,
  GLOBAL_ACTIVE_CAPS,
  FAMILY_ACTIVE_CAPS,
  TECH_FAMILIES_HIGH_CAP,
} from '../../constants/evaluation';

export type SignalKind = 'declared' | 'artifact' | 'behavioral' | 'assessment';
export type Origin = 'declared' | 'inferred' | 'extracted' | 'validated';

export interface Signal {
  kind: SignalKind;
  source_ref?: string;
  age_months?: number;
  note?: string;
}

export interface AxisReading {
  A: number;
  C: number;
  I: number;
  T: number;
}

export interface EvalTarget {
  slug: string;
  signals?: Signal[];
  /** Pre-supplied A/C/I/T (e.g. from the study agent). If absent and signals
   *  exist, the Fast LLM reads direct evidence. */
  axes?: AxisReading;
  origin: Origin;
  evaluatedBy?: string;
  /** A level asserted by the source (declared by user, extracted hint, validated
   *  by participation). Used as the anchor when there is no A/C/I/T reading and
   *  no graph prior is desired. Guards still apply (declared caps at intermediate). */
  assertedLevel?: Level;
  /** Hard ceiling on the resulting level for this write (participation rules). */
  levelCap?: Level;
  /** Hard ceiling on confidence for this write. */
  confidenceCap?: number;
}

// --- Level math (§4) ------------------------------------------------------------

const clampAxis = (n: number) => Math.max(1, Math.min(4, Math.round(n)));

export function rawLevelFromAxes({ A, C, I, T }: AxisReading): number {
  const a = clampAxis(A);
  const c = clampAxis(C);
  const i = clampAxis(I);
  const t = clampAxis(T);
  let raw = Math.floor((a + c + i + t) / 4);
  raw = Math.min(raw, a);
  if (t < 4) raw = Math.min(raw, 3); // master requires T = 4
  return Math.max(1, raw);
}

// --- Confidence (§8) ------------------------------------------------------------

function baseConfidence(origin: Origin, strongest: SignalKind | null): number {
  if (strongest === 'artifact' || strongest === 'assessment') return BASE_CONFIDENCE.artifact;
  if (origin === 'declared') return BASE_CONFIDENCE.declared;
  return BASE_CONFIDENCE.inference; // inferred / validated / correlated
}

function freshnessPenalty(family: string, type: CatalogType, ageMonths?: number): number {
  if (ageMonths == null) return 0;
  const cycle = effectiveCycle(family, type);
  const rule = FRESHNESS_PENALTY[cycle];
  if (rule && ageMonths > rule.months) return rule.penalty;
  return 0;
}

// --- Decay (§9) -----------------------------------------------------------------

export function decayStateFor(
  family: string,
  type: CatalogType,
  lastEvidenceAt: Date | null
): 'active' | 'stale' | 'archived' {
  if (!lastEvidenceAt) return 'active';
  const cycle = effectiveCycle(family, type);
  const t = DECAY_THRESHOLDS[cycle];
  const months = (Date.now() - lastEvidenceAt.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  if (months <= t.active) return 'active';
  if (months <= t.stale) return 'stale';
  if (months <= t.archived) return 'stale';
  return 'archived';
}

// --- Fast LLM direct-evidence contract (§3) -------------------------------------

interface LLMDirectItem {
  competency_id: string;
  A: number;
  C: number;
  I: number;
  T: number;
  lens_level: number;
  rationale: string;
}

function evidenceHash(input: {
  competencyId: string;
  signals: Signal[];
  neighbors: catalog.Neighbor[];
}): string {
  const payload = JSON.stringify({
    fw: FRAMEWORK_VERSION,
    id: input.competencyId,
    s: input.signals.map((s) => ({ k: s.kind, a: s.age_months, n: s.note })),
    nb: input.neighbors.map((n) => ({ s: n.slug, r: n.relation, st: n.strength })),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Read direct evidence (A/C/I/T) for a batch of targets via the Fast LLM.
 * Only called for targets that have signals but no pre-supplied axes.
 */
export async function readDirectEvidenceBatch(
  targets: Array<{ slug: string; type: CatalogType; name: string; signals: Signal[]; neighbors: catalog.Neighbor[] }>,
  usageContext?: { billedActionCode?: string | null; scopeTalentId?: string | null; scopeOrganizationId?: string | null }
): Promise<Map<string, AxisReading & { lensLevel: number; rationale: string }>> {
  const out = new Map<string, AxisReading & { lensLevel: number; rationale: string }>();
  if (targets.length === 0) return out;

  const compact = targets.map((t) => ({
    competency_id: t.slug,
    name: t.name,
    type: t.type,
    type_lens: TYPE_LENSES[t.type],
    signals: t.signals.slice(0, 5).map((s) => ({ kind: s.kind, age_months: s.age_months, note: s.note })),
    neighbor_summary: t.neighbors.slice(0, 8).map((n) => ({ slug: n.slug, relation: n.relation, strength: n.strength })),
  }));

  const system = `You score a person's demonstrated competency on four 1-4 axes using only the supplied evidence.
A=Autonomy, C=Complexity, I=Impact, T=Transmission. Use the type_lens (4 evidence lines, level 1..4) to ground the score.
Output STRICT JSON: {"items":[{"competency_id","A","C","I","T","lens_level","rationale"}]}. Integers 1..4. rationale = one short audit sentence. Do not invent evidence.`;

  const user = JSON.stringify({ framework_version: FRAMEWORK_VERSION, competencies: compact });

  const aiClient = getAIClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await aiClient.chat.completions.create({
        model: MODEL_SEARCH,
        // GPT-5 models only accept default temperature; JSON mode + confidence guards keep output stable.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      void recordUsage({
        feature: 'skill_evaluation',
        model: MODEL_SEARCH,
        usage: resp.usage,
        scopeTalentId: usageContext?.scopeTalentId ?? null,
        scopeOrganizationId: usageContext?.scopeOrganizationId ?? null,
        billedActionCode: usageContext?.billedActionCode ?? null,
      });
      const raw = resp.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as { items?: LLMDirectItem[] };
      const validSlugs = new Set(targets.map((t) => t.slug));
      for (const it of parsed.items || []) {
        if (!validSlugs.has(it.competency_id)) continue;
        out.set(it.competency_id, {
          A: clampAxis(it.A),
          C: clampAxis(it.C),
          I: clampAxis(it.I),
          T: clampAxis(it.T),
          lensLevel: clampAxis(it.lens_level),
          rationale: String(it.rationale || '').slice(0, 280),
        });
      }
      return out;
    } catch (err: any) {
      logger.warn(`[evaluation] direct-evidence LLM attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  return out; // empty -> caller treats as insufficient_evidence
}

// --- Graph inference prior (§7) -------------------------------------------------

interface ActiveNeighborState {
  slug: string;
  relation: catalog.EdgeRelation;
  strength: number;
  score: number;
  confidence: number;
  sameFamily: boolean;
}

export function computePrior(neighbors: ActiveNeighborState[]): { prior: number; from: string[] } | null {
  if (neighbors.length === 0) return null;
  const from: string[] = [];
  let cap: number = INFERENCE.CAP_DEFAULT;
  // base = strongest weighted neighbor score (strength * confidence weighted)
  let base = 0;
  for (const n of neighbors) {
    const weighted = n.score * n.strength * n.confidence;
    if (weighted > base) base = weighted;
    from.push(n.slug);
    const strong = n.strength >= INFERENCE.STRONG_STRENGTH;
    if ((n.relation === 'prerequisite' && strong) || (n.relation === 'sibling' && strong && n.sameFamily)) {
      cap = INFERENCE.CAP_STRONG;
    }
  }
  let prior = Math.round(base) - 1;
  prior = Math.max(1, Math.min(Math.min(cap, 3), prior));
  return { prior, from };
}

// --- Confidence guards (§8) -----------------------------------------------------

function applyGuards(
  level: Level,
  confidence: number,
  origin: Origin,
  hasRecentDirect: boolean
): Level {
  let idx = LEVEL_ORDER.indexOf(level);
  // pure inference / validation cannot reach master; declared cannot create advanced+ alone
  if ((origin === 'inferred' || origin === 'validated') && idx > LEVEL_ORDER.indexOf('advanced')) {
    idx = LEVEL_ORDER.indexOf('advanced');
  }
  if (idx >= LEVEL_ORDER.indexOf('master') && (confidence < CONFIDENCE_GUARDS.MASTER_MIN || !hasRecentDirect)) {
    idx = LEVEL_ORDER.indexOf('advanced');
  }
  if (idx >= LEVEL_ORDER.indexOf('advanced') && confidence < CONFIDENCE_GUARDS.ADVANCED_MIN) {
    idx = LEVEL_ORDER.indexOf('intermediate');
  }
  if (origin === 'declared' && idx > LEVEL_ORDER.indexOf('intermediate')) {
    idx = LEVEL_ORDER.indexOf('intermediate');
  }
  return LEVEL_ORDER[Math.max(0, idx)];
}

const capLevel = (level: Level, cap?: Level): Level => {
  if (!cap) return level;
  return LEVEL_ORDER[Math.min(LEVEL_ORDER.indexOf(level), LEVEL_ORDER.indexOf(cap))];
};

// --- Low-level writer (single chokepoint) ---------------------------------------

interface WriteRow {
  talentId: string;
  slug: string;
  level: Level;
  score: number;
  confidence: number;
  axes?: AxisReading;
  origin: Origin;
  sourceRef?: string[];
  inferredFrom?: string[];
  rationale?: string;
  evidenceHash?: string;
  lastEvidenceAt?: Date;
  evaluatedBy?: string;
  catalogVersion: string;
}

async function upsertEvaluatedSkill(row: WriteRow): Promise<void> {
  // Direct evidence beats inference: only upgrade if the new state is stronger,
  // unless it carries fresh direct evidence (artifact/assessment/axes present).
  await pool.query(
    `INSERT INTO talent_skills
       (talent_id, competency_slug, level, score, confidence,
        axis_a, axis_c, axis_i, axis_t,
        origin, source_ref, inferred_from, evidence_hash, rationale,
        last_evidence_at, decay_state, catalog_version, framework_version, evaluated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active',$16,$17,$18)
     ON CONFLICT (talent_id, competency_slug) DO UPDATE SET
       level = CASE WHEN EXCLUDED.score >= talent_skills.score THEN EXCLUDED.level ELSE talent_skills.level END,
       score = GREATEST(talent_skills.score, EXCLUDED.score),
       confidence = GREATEST(talent_skills.confidence, EXCLUDED.confidence),
       axis_a = COALESCE(EXCLUDED.axis_a, talent_skills.axis_a),
       axis_c = COALESCE(EXCLUDED.axis_c, talent_skills.axis_c),
       axis_i = COALESCE(EXCLUDED.axis_i, talent_skills.axis_i),
       axis_t = COALESCE(EXCLUDED.axis_t, talent_skills.axis_t),
       origin = CASE WHEN EXCLUDED.score >= talent_skills.score THEN EXCLUDED.origin ELSE talent_skills.origin END,
       source_ref = (
         SELECT ARRAY(SELECT DISTINCT unnest(talent_skills.source_ref || EXCLUDED.source_ref))
       ),
       inferred_from = EXCLUDED.inferred_from,
       evidence_hash = EXCLUDED.evidence_hash,
       rationale = COALESCE(EXCLUDED.rationale, talent_skills.rationale),
       last_evidence_at = GREATEST(COALESCE(talent_skills.last_evidence_at, EXCLUDED.last_evidence_at), EXCLUDED.last_evidence_at),
       decay_state = 'active',
       catalog_version = EXCLUDED.catalog_version,
       framework_version = EXCLUDED.framework_version,
       evaluated_by = EXCLUDED.evaluated_by,
       updated_at = NOW()`,
    [
      row.talentId,
      row.slug,
      row.level,
      row.score,
      row.confidence,
      row.axes?.A ?? null,
      row.axes?.C ?? null,
      row.axes?.I ?? null,
      row.axes?.T ?? null,
      row.origin,
      row.sourceRef ?? [],
      row.inferredFrom ?? [],
      row.evidenceHash ?? null,
      row.rationale ?? null,
      row.lastEvidenceAt ?? new Date(),
      row.catalogVersion,
      FRAMEWORK_VERSION,
      row.evaluatedBy ?? 'evaluation_service',
    ]
  );
}

// --- Public API -----------------------------------------------------------------

export interface EvaluateResult {
  slug: string;
  level: Level;
  score: number;
  confidence: number;
  origin: Origin;
  rationale?: string;
  status: 'written' | 'insufficient_evidence' | 'unknown_slug';
}

/**
 * Evaluate a batch of targets for one talent and persist the reconciled rows.
 * Direct evidence (axes or LLM reading) anchors the level; graph prior fills in
 * when there is no direct reading; confidence guards and level caps are enforced.
 */
export async function evaluateBatch(input: {
  talentId: string;
  targets: EvalTarget[];
  billedActionCode?: string | null;
  scopeOrganizationId?: string | null;
}): Promise<EvaluateResult[]> {
  const { talentId, targets } = input;
  const results: EvaluateResult[] = [];
  const catalogVersion = await catalog.getCatalogVersion();

  // Resolve catalog metadata for each target
  const metas = await Promise.all(
    targets.map(async (t) => ({ target: t, comp: await catalog.getCompetency(t.slug) }))
  );

  // Targets needing an LLM direct read: real evidence signals but neither
  // pre-supplied axes nor a source-asserted level (declared/extracted/validated
  // already carry their own level and must not be re-scored by the LLM).
  const needLLM = metas.filter(
    (m) => m.comp && !m.target.axes && !m.target.assertedLevel && (m.target.signals?.length ?? 0) > 0
  );
  let llmReadings = new Map<string, AxisReading & { lensLevel: number; rationale: string }>();
  if (needLLM.length > 0) {
    const withNeighbors = await Promise.all(
      needLLM.map(async (m) => ({
        slug: m.comp!.slug,
        type: m.comp!.type,
        name: m.comp!.name,
        signals: m.target.signals!,
        neighbors: await catalog.getNeighbors(m.comp!.slug),
      }))
    );
    llmReadings = await readDirectEvidenceBatch(withNeighbors, {
      billedActionCode: input.billedActionCode ?? null,
      scopeTalentId: talentId,
      scopeOrganizationId: input.scopeOrganizationId ?? null,
    });
  }

  // Load current active neighbor state for graph inference
  const activeRows = await pool.query(
    `SELECT competency_slug, score, confidence FROM talent_skills
     WHERE talent_id = $1 AND decay_state = 'active'`,
    [talentId]
  );
  const activeBySlug = new Map<string, { score: number; confidence: number }>();
  for (const r of activeRows.rows) activeBySlug.set(r.competency_slug, { score: r.score, confidence: Number(r.confidence) });

  for (const { target, comp } of metas) {
    if (!comp) {
      results.push({ slug: target.slug, level: 'beginner', score: 1, confidence: 0, origin: target.origin, status: 'unknown_slug' });
      continue;
    }

    const profile = getFamilyProfile(comp.family);
    const strongestSignal = pickStrongestSignal(target.signals);
    const ageMonths = minSignalAge(target.signals);

    // 1. Direct reading: pre-supplied axes, else LLM, else graph prior
    let axes: AxisReading | undefined = target.axes;
    let rationale: string | undefined;
    let lensLevel: number | undefined;
    if (!axes && llmReadings.has(comp.slug)) {
      const r = llmReadings.get(comp.slug)!;
      axes = { A: r.A, C: r.C, I: r.I, T: r.T };
      lensLevel = r.lensLevel;
      rationale = r.rationale;
    }

    let levelScore: number;
    let origin = target.origin;
    let inferredFrom: string[] = [];
    let evHash: string | undefined;
    let hasRecentDirect = false;

    if (axes) {
      const raw = rawLevelFromAxes(axes);
      levelScore = lensLevel ? Math.min(raw, lensLevel) : raw;
      hasRecentDirect = strongestSignal === 'artifact' || strongestSignal === 'assessment' || !!target.axes;
      if (target.signals) {
        evHash = evidenceHash({ competencyId: comp.slug, signals: target.signals, neighbors: [] });
      }
    } else if (target.assertedLevel) {
      // Source-asserted level (declared / extracted / validated) — no A/C/I/T, no inference.
      levelScore = LEVEL_SCORE[target.assertedLevel];
      hasRecentDirect = strongestSignal === 'artifact' || strongestSignal === 'assessment';
    } else {
      // 2. Pure graph inference prior (§7)
      const neighbors = await catalog.getNeighbors(comp.slug);
      const activeNeighbors: ActiveNeighborState[] = [];
      for (const n of neighbors) {
        const st = activeBySlug.get(n.slug);
        if (!st) continue;
        const nFamily = await catalog.getFamily(n.slug);
        activeNeighbors.push({
          slug: n.slug,
          relation: n.relation,
          strength: n.strength,
          score: st.score,
          confidence: st.confidence,
          sameFamily: nFamily === comp.family,
        });
      }
      const prior = computePrior(activeNeighbors);
      if (!prior) {
        results.push({ slug: comp.slug, level: 'beginner', score: 1, confidence: 0, origin, status: 'insufficient_evidence' });
        continue;
      }
      levelScore = prior.prior;
      inferredFrom = prior.from;
      origin = 'inferred';
    }

    // 3. Confidence
    let confidence = baseConfidence(origin, strongestSignal);
    const independentSignals = (target.signals?.length ?? 0);
    if (independentSignals > 1) confidence += CONFIDENCE_GUARDS.CONFIRMING_SIGNAL_BONUS * (independentSignals - 1);
    if (origin === 'inferred') confidence += 0; // prior already reflected
    confidence -= freshnessPenalty(comp.family, comp.type, ageMonths);
    if (target.confidenceCap != null) confidence = Math.min(confidence, target.confidenceCap);
    confidence = Math.max(0, Math.min(1, confidence));

    // 4. Level from score + guards + caps
    let level = scoreToLevel(levelScore);
    level = applyGuards(level, confidence, origin, hasRecentDirect);
    level = capLevel(level, target.levelCap);
    const finalScore = LEVEL_SCORE[level];

    await upsertEvaluatedSkill({
      talentId,
      slug: comp.slug,
      level,
      score: finalScore,
      confidence,
      axes,
      origin,
      sourceRef: collectSourceRefs(target.signals),
      inferredFrom,
      rationale,
      evidenceHash: evHash,
      lastEvidenceAt: new Date(),
      evaluatedBy: target.evaluatedBy,
      catalogVersion,
    });

    // keep neighbor map fresh for subsequent targets in this batch
    activeBySlug.set(comp.slug, { score: finalScore, confidence });

    results.push({ slug: comp.slug, level, score: finalScore, confidence, origin, rationale, status: 'written' });
  }

  // Enforce profile capacity caps (§9) after persisting the batch.
  await applyCapacityCaps(talentId);

  return results;
}

/** Recompute decay_state for a talent's skills (call periodically / on read). */
export async function applyDecay(talentId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT ts.id, ts.last_evidence_at, ts.level, ts.confidence, c.family, c.type
     FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
     WHERE ts.talent_id = $1`,
    [talentId]
  );
  for (const r of rows) {
    const state = decayStateFor(r.family, r.type, r.last_evidence_at ? new Date(r.last_evidence_at) : null);
    let level: Level = r.level;
    if (state === 'stale') {
      // stale master -> advanced; stale advanced stays only if confidence >= 0.75
      if (level === 'master') level = 'advanced';
      else if (level === 'advanced' && Number(r.confidence) < 0.75) level = 'intermediate';
    }
    await pool.query(
      `UPDATE talent_skills SET decay_state = $1, level = $2, score = $3 WHERE id = $4`,
      [state, level, LEVEL_SCORE[level], r.id]
    );
  }
}

// --- Capacity caps (§9) ---------------------------------------------------------
// The active profile represents current capacity, not an infinite CV. When a tier
// exceeds its global or per-family cap, the weakest rows (by priority) are demoted
// one tier down (never deleted — history is kept; demoted rows can re-rise later).

interface CapRow {
  id: string;
  family: string;
  level: Level;
  score: number;
  confidence: number;
  origin: Origin;
  hasProof: boolean;
  axisI: number | null;
  lastEvidenceAt: Date | null;
}

function capRowPriority(r: CapRow): number {
  let p = r.confidence;
  // proof bonus: documented / validated / assessment evidence
  if (r.hasProof || r.origin === 'extracted' || r.origin === 'validated') p += 0.15;
  // recency bonus
  if (r.lastEvidenceAt) {
    const months = (Date.now() - r.lastEvidenceAt.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
    if (months <= 6) p += 0.1;
    else if (months <= 24) p += 0.05;
  }
  // impact bonus from the I axis
  if (r.axisI != null) p += (r.axisI - 1) * 0.05;
  return p;
}

const TIER_ORDER: Level[] = ['master', 'advanced', 'intermediate'];
const demoteLevel = (l: Level): Level => LEVEL_ORDER[Math.max(0, LEVEL_ORDER.indexOf(l) - 1)];

function familyAdvancedCap(family: string): number {
  return TECH_FAMILIES_HIGH_CAP.has(family) ? FAMILY_ACTIVE_CAPS.advancedTechFamilies : FAMILY_ACTIVE_CAPS.advanced;
}

export async function applyCapacityCaps(talentId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT ts.id, ts.level, ts.score, ts.confidence, ts.origin, ts.axis_i, ts.last_evidence_at,
            (array_length(ts.source_ref, 1) > 0) AS has_proof, c.family
     FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
     WHERE ts.talent_id = $1 AND ts.decay_state = 'active'`,
    [talentId]
  );
  if (rows.length === 0) return;

  const items: CapRow[] = rows.map((r: any) => ({
    id: r.id,
    family: r.family,
    level: r.level,
    score: r.score,
    confidence: Number(r.confidence),
    origin: r.origin,
    hasProof: !!r.has_proof,
    axisI: r.axis_i,
    lastEvidenceAt: r.last_evidence_at ? new Date(r.last_evidence_at) : null,
  }));
  const byId = new Map(items.map((i) => [i.id, i]));
  const demoted = new Set<string>();

  const demote = (r: CapRow) => {
    r.level = demoteLevel(r.level);
    r.score = LEVEL_SCORE[r.level];
    demoted.add(r.id);
  };

  // Process tiers top-down so master overflow lands in advanced before advanced is capped.
  for (const tier of TIER_ORDER) {
    const globalCap = GLOBAL_ACTIVE_CAPS[tier as keyof typeof GLOBAL_ACTIVE_CAPS];

    // Global cap for this tier
    let atTier = items.filter((i) => i.level === tier).sort((a, b) => capRowPriority(b) - capRowPriority(a));
    if (globalCap && atTier.length > globalCap) {
      for (const r of atTier.slice(globalCap)) demote(r);
    }

    // Per-family caps for this tier (recompute membership after global demotion).
    // Only master and advanced tiers have per-family caps.
    if (tier === 'master' || tier === 'advanced') {
      atTier = items.filter((i) => i.level === tier);
      const byFamily = new Map<string, CapRow[]>();
      for (const r of atTier) {
        const list = byFamily.get(r.family) || [];
        list.push(r);
        byFamily.set(r.family, list);
      }
      for (const [family, list] of byFamily) {
        const cap = tier === 'master' ? FAMILY_ACTIVE_CAPS.master : familyAdvancedCap(family);
        if (list.length > cap) {
          const sorted = list.sort((a, b) => capRowPriority(b) - capRowPriority(a));
          for (const r of sorted.slice(cap)) demote(r);
        }
      }
    }
  }

  // Persist only the rows whose level changed.
  for (const id of demoted) {
    const r = byId.get(id)!;
    await pool.query(`UPDATE talent_skills SET level = $1, score = $2, updated_at = NOW() WHERE id = $3`, [
      r.level,
      r.score,
      id,
    ]);
  }
}

// --- helpers --------------------------------------------------------------------

const SIGNAL_RANK: Record<SignalKind, number> = { assessment: 4, artifact: 3, behavioral: 2, declared: 1 };

function pickStrongestSignal(signals?: Signal[]): SignalKind | null {
  if (!signals || signals.length === 0) return null;
  return signals.reduce((best, s) => (SIGNAL_RANK[s.kind] > SIGNAL_RANK[best] ? s.kind : best), signals[0].kind);
}

function minSignalAge(signals?: Signal[]): number | undefined {
  if (!signals) return undefined;
  const ages = signals.map((s) => s.age_months).filter((a): a is number => typeof a === 'number');
  return ages.length ? Math.min(...ages) : undefined;
}

function collectSourceRefs(signals?: Signal[]): string[] {
  if (!signals) return [];
  return signals.map((s) => s.source_ref).filter((s): s is string => !!s);
}

export default { evaluateBatch, applyDecay, rawLevelFromAxes, computePrior, decayStateFor };
