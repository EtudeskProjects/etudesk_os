/**
 * Catalog Service — single chokepoint enforcing "catalog only".
 *
 * The digital skills referential (competencies + competency_edges, seeded from
 * datasets/etudesk_digital_skills) is the single source of truth. Every writer
 * (REST API, manage_skills tool, document extraction, validation, evaluation)
 * resolves free-text labels to a catalog slug through this service. Resolution
 * ladder: exact slug -> exact name -> trigram -> semantic (pgvector cosine over
 * competencies.embedding, embedded once by seed:competency-embeddings). An
 * in-process cache memoizes the (small, 1261-row) catalog.
 */

import { pool } from '../database';
import { logger } from '../../utils';
import { CatalogType } from '../../constants/skills';
import { generateEmbedding } from '../embedding.service';

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
// Minimum cosine similarity to accept a SEMANTIC (embedding) resolution — higher
// bar than suggestions since this writes a skill. Tuned for text-embedding-3-small.
const SEMANTIC_RESOLVE_THRESHOLD = Number(process.env.CATALOG_SEMANTIC_THRESHOLD || 0.62);

/**
 * Semantic nearest competencies via pgvector cosine over competencies.embedding
 * (the referential is embedded once by seed:competency-embeddings). Returns rows
 * with `sim` (cosine 0..1). Empty if embeddings are absent or the query fails.
 */
async function searchByEmbedding(query: string, limit: number): Promise<Array<Competency & { sim: number }>> {
  try {
    const vec = await generateEmbedding(query);
    const { rows } = await pool.query(
      `SELECT slug, family, type, name, name_fr, catalog_version,
              1 - (embedding <=> $1::vector) AS sim
       FROM competencies
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${vec.join(',')}]`, limit]
    );
    return rows.map((r) => ({
      slug: r.slug, family: r.family, type: r.type, name: r.name,
      name_fr: r.name_fr, catalog_version: r.catalog_version, sim: Number(r.sim),
    }));
  } catch (err: any) {
    logger.warn(`[catalog] semantic search failed for "${query}": ${err.message}`);
    return [];
  }
}

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

/** Case + accent insensitive fold for fuzzy substring search. */
function fold(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
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

  // 4. semantic fallback (embedding cosine) — catches paraphrases/synonyms the
  // trigram misses (e.g. "ML" -> "Machine Learning"). High threshold for precision.
  const sem = await searchByEmbedding(label, 1);
  if (sem.length > 0 && sem[0].sim >= SEMANTIC_RESOLVE_THRESHOLD) {
    const { sim, ...c } = sem[0];
    return { ...c, confidence: sim };
  }

  return null;
}

/** Top candidates for a label — semantic (embedding) first, trigram fallback.
 *  Used to suggest in-catalog alternatives (find_competency redirect). */
export async function suggestCompetencies(label: string, limit = 3): Promise<Competency[]> {
  await ensureCache();
  const norm = normalize(label);
  // Semantic suggestions surface the closest catalog skills by MEANING.
  const sem = await searchByEmbedding(label, limit);
  if (sem.length > 0) {
    return sem.map(({ sim, ...c }) => c);
  }
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

/**
 * Fluid catalog search for pickers/autocomplete. Case + accent insensitive,
 * substring-aware, ranked (exact > prefix > word-start > substring), top N.
 * Runs in-memory over the full cached catalog — no SQL, no trigram threshold,
 * so it returns results from the 2nd typed character and refines as you type.
 */
export async function searchCompetencies(query: string, limit = 5): Promise<Competency[]> {
  await ensureCache();
  const q = fold(query);
  if (q.length < 1) return [];
  const scored: Array<{ c: Competency; score: number }> = [];
  for (const c of bySlug.values()) {
    const en = fold(c.name);
    const fr = fold(c.name_fr);
    let score = 0;
    if (en === q || fr === q) score = 100;
    else if (en.startsWith(q) || fr.startsWith(q)) score = 80;
    else if (en.includes(' ' + q) || fr.includes(' ' + q)) score = 70; // word-start
    else if (en.includes(q) || fr.includes(q)) score = 60; // substring
    else continue;
    // Shorter names rank slightly higher (more specific match).
    score += Math.max(0, 20 - c.name.length / 4);
    scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.length - b.c.name.length || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
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
