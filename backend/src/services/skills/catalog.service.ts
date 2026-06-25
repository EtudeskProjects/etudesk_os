/**
 * Catalog Service — single chokepoint enforcing "catalog only".
 *
 * The digital skills referential (competencies + competency_edges, seeded from
 * datasets/etudesk_digital_skills) is the single source of truth. Every writer
 * (REST API, manage_skills tool, document extraction, validation, evaluation)
 * resolves free-text labels to a catalog slug through this service. Pure SQL,
 * no LLM. An in-process cache memoizes the (small, 1211-row) catalog.
 */

import { pool } from '../database';
import { logger } from '../../utils';
import { CatalogType } from '../../constants/skills';

export interface Competency {
  slug: string;
  family: string;
  type: CatalogType;
  name: string;
  name_fr: string;
  catalog_version: string;
}

export type EdgeRelation = 'prerequisite' | 'co_occurrence' | 'sibling';

export interface Neighbor {
  slug: string;
  relation: EdgeRelation;
  strength: number;
}

export interface ResolveResult extends Competency {
  confidence: number; // 1.0 exact slug/name, <1 fuzzy
}

// Minimum trigram similarity to accept a fuzzy resolution.
const RESOLVE_THRESHOLD = Number(process.env.CATALOG_RESOLVE_THRESHOLD || 0.5);

// --- In-process cache -----------------------------------------------------------

let cacheLoaded = false;
let bySlug = new Map<string, Competency>();
let byName = new Map<string, string>(); // lower(name | name_fr) -> slug
let catalogVersion = '';

function normalize(label: string): string {
  return label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureCache(): Promise<void> {
  if (cacheLoaded) return;
  const { rows } = await pool.query(
    `SELECT slug, family, type, name, name_fr, catalog_version FROM competencies`
  );
  bySlug = new Map();
  byName = new Map();
  for (const r of rows) {
    const c: Competency = {
      slug: r.slug,
      family: r.family,
      type: r.type,
      name: r.name,
      name_fr: r.name_fr,
      catalog_version: r.catalog_version,
    };
    bySlug.set(c.slug, c);
    byName.set(normalize(c.name), c.slug);
    byName.set(normalize(c.name_fr), c.slug);
    if (!catalogVersion) catalogVersion = c.catalog_version;
  }
  cacheLoaded = true;
  logger.info(`[catalog] loaded ${bySlug.size} competencies (version ${catalogVersion})`);
}

/** Clear the cache (call after re-seeding the catalog). */
export function invalidateCatalogCache(): void {
  cacheLoaded = false;
  bySlug = new Map();
  byName = new Map();
  catalogVersion = '';
}

export async function getCatalogVersion(): Promise<string> {
  await ensureCache();
  return catalogVersion;
}

export async function getCompetency(slug: string): Promise<Competency | null> {
  await ensureCache();
  return bySlug.get(slug) || null;
}

export async function getFamily(slug: string): Promise<string | null> {
  return (await getCompetency(slug))?.family ?? null;
}

export async function getType(slug: string): Promise<CatalogType | null> {
  return (await getCompetency(slug))?.type ?? null;
}

/**
 * Resolve a free-text label / name / slug to a catalog competency.
 * Ladder: exact slug -> exact name/name_fr -> trigram fuzzy. Returns null when
 * nothing clears the confidence threshold (caller decides to drop or stage).
 */
export async function resolveLabel(label: string): Promise<ResolveResult | null> {
  await ensureCache();
  if (!label || !label.trim()) return null;

  // 1. exact slug
  const direct = bySlug.get(label.trim());
  if (direct) return { ...direct, confidence: 1 };

  // 2. exact name / name_fr (case-insensitive)
  const norm = normalize(label);
  const exactSlug = byName.get(norm);
  if (exactSlug) {
    const c = bySlug.get(exactSlug)!;
    return { ...c, confidence: 1 };
  }

  // 3. trigram fuzzy on name + name_fr
  try {
    const { rows } = await pool.query(
      `SELECT slug, family, type, name, name_fr, catalog_version,
              GREATEST(similarity(lower(name), $1), similarity(lower(name_fr), $1)) AS sim
       FROM competencies
       WHERE lower(name) % $1 OR lower(name_fr) % $1
       ORDER BY sim DESC
       LIMIT 1`,
      [norm]
    );
    if (rows.length > 0 && rows[0].sim >= RESOLVE_THRESHOLD) {
      const r = rows[0];
      return {
        slug: r.slug,
        family: r.family,
        type: r.type,
        name: r.name,
        name_fr: r.name_fr,
        catalog_version: r.catalog_version,
        confidence: Number(r.sim),
      };
    }
  } catch (err: any) {
    logger.error(`[catalog] resolveLabel fuzzy failed for "${label}": ${err.message}`);
  }
  return null;
}

/** Top fuzzy candidates for a label (used to suggest options to the agent). */
export async function suggestCompetencies(label: string, limit = 3): Promise<Competency[]> {
  await ensureCache();
  const norm = normalize(label);
  try {
    const { rows } = await pool.query(
      `SELECT slug, family, type, name, name_fr, catalog_version,
              GREATEST(similarity(lower(name), $1), similarity(lower(name_fr), $1)) AS sim
       FROM competencies
       WHERE lower(name) % $1 OR lower(name_fr) % $1
       ORDER BY sim DESC
       LIMIT $2`,
      [norm, limit]
    );
    return rows.map((r) => ({
      slug: r.slug,
      family: r.family,
      type: r.type,
      name: r.name,
      name_fr: r.name_fr,
      catalog_version: r.catalog_version,
    }));
  } catch {
    return [];
  }
}

export interface ResolvedSkillSuggestion {
  slug: string;
  name: string;
  name_fr: string;
  type: CatalogType;
  family: string;
  requirement?: 'required' | 'nice_to_have';
  role?: string;
}

/**
 * Resolve a list of free-text skill suggestions (from an LLM generator) to
 * catalog competencies. Robust: drops anything not in the referential and
 * de-duplicates by slug. Preserves the per-item requirement/role tag.
 */
export async function resolveSkillSuggestions(
  items: Array<{ name?: string; label?: string; skill?: string; requirement?: string; role?: string }> | undefined | null
): Promise<ResolvedSkillSuggestion[]> {
  if (!Array.isArray(items)) return [];
  const out: ResolvedSkillSuggestion[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const label = it?.name || it?.label || it?.skill;
    if (!label) continue;
    const r = await resolveLabel(label);
    if (!r || seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({
      slug: r.slug,
      name: r.name,
      name_fr: r.name_fr,
      type: r.type,
      family: r.family,
      requirement: it.requirement === 'nice_to_have' ? 'nice_to_have' : it.requirement === 'required' ? 'required' : undefined,
      role: it.role,
    });
  }
  return out;
}

/**
 * Graph neighbors of a competency from competency_edges.
 * The edge is directed: an evidenced neighbor (to_slug) helps estimate the
 * target (from_slug). For inference about `slug`, we read its outgoing edges
 * (slug -> neighbor). Capped per the framework's neighbor_summary (8).
 */
export async function getNeighbors(
  slug: string,
  opts?: { relations?: EdgeRelation[]; limit?: number }
): Promise<Neighbor[]> {
  const limit = opts?.limit ?? 8;
  const relations = opts?.relations;
  const params: any[] = [slug];
  let relFilter = '';
  if (relations && relations.length > 0) {
    params.push(relations);
    relFilter = `AND relation = ANY($2::text[])`;
  }
  const { rows } = await pool.query(
    `SELECT to_slug AS slug, relation, strength
     FROM competency_edges
     WHERE from_slug = $1 ${relFilter}
     ORDER BY strength DESC
     LIMIT ${limit}`,
    params
  );
  return rows.map((r) => ({ slug: r.slug, relation: r.relation, strength: Number(r.strength) }));
}

/** Reverse neighbors: competencies that point TO `slug` (dependents / co-occurring). */
export async function getDependents(
  slug: string,
  opts?: { relations?: EdgeRelation[]; limit?: number }
): Promise<Neighbor[]> {
  const limit = opts?.limit ?? 8;
  const relations = opts?.relations;
  const params: any[] = [slug];
  let relFilter = '';
  if (relations && relations.length > 0) {
    params.push(relations);
    relFilter = `AND relation = ANY($2::text[])`;
  }
  const { rows } = await pool.query(
    `SELECT from_slug AS slug, relation, strength
     FROM competency_edges
     WHERE to_slug = $1 ${relFilter}
     ORDER BY strength DESC
     LIMIT ${limit}`,
    params
  );
  return rows.map((r) => ({ slug: r.slug, relation: r.relation, strength: Number(r.strength) }));
}

export default {
  getCompetency,
  getFamily,
  getType,
  getCatalogVersion,
  resolveLabel,
  suggestCompetencies,
  getNeighbors,
  getDependents,
  invalidateCatalogCache,
};
