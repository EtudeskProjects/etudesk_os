/**
 * Smart Search Tool — Unified Pinecone + PostgreSQL hybrid search
 * Replaces both vector_query and sql_query search_* intents.
 *
 * Phase 1: Pinecone semantic ranking (embeddings)
 * Phase 2: PostgreSQL enrichment + keyword fallback
 * Phase 3: Merge, deduplicate, sort by score DESC
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from '../../embedding.service';
import { pool } from '../../database';
import { logger } from '../../../utils';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'etudesk';
const SEMANTIC_THRESHOLD = 0.35;
const KEYWORD_FALLBACK_THRESHOLD = 3; // trigger keyword fallback if < 3 Pinecone results

const ENTITY_TO_TYPE: Record<string, string> = {
  opportunities: 'opportunity',
  communities: 'community',
  spaces: 'space',
  talents: 'talent',
  organizations: 'organization',
};

/** Valid Pinecone metadata filter keys per entity type */
const VALID_FILTER_KEYS: Record<string, ReadonlySet<string>> = {
  opportunities: new Set(['type', 'contract_type', 'contractType', 'location_type', 'locationType', 'location', 'sector', 'status']),
  communities: new Set(['type', 'sector', 'is_paid', 'isPaid', 'city']),
  spaces: new Set(['type', 'city', 'location']),
  talents: new Set(['city', 'country', 'skills', 'sector']),
  organizations: new Set(['sectors', 'city', 'country']),
};

/**
 * Sanitize filters: whitelist valid keys per entity + only keep Pinecone-compatible values.
 */
function sanitizeFilters(raw: Record<string, unknown>, entity?: string): Record<string, unknown> {
  const allowedKeys = entity ? VALID_FILTER_KEYS[entity] : null;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined) continue;
    if (allowedKeys && !allowedKeys.has(key)) {
      logger.warn(`[smart_search] Dropping unknown filter key "${key}" for entity "${entity}"`);
      continue;
    }
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    } else if (Array.isArray(val) && val.every((v) => typeof v === 'string' || typeof v === 'number')) {
      clean[key] = { $in: val };
    }
  }
  return clean;
}

/**
 * Retry wrapper for transient DB errors
 */
async function queryWithRetry(text: string, params: any[], retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err: any) {
      const isTransient = err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET') ||
        err.code === 'EPIPE' || err.code === 'ETIMEDOUT' || err.code === 'CONNECTION_ENDED';
      if (isTransient && attempt < retries) {
        logger.warn(`[smart_search] DB transient error (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// --- PostgreSQL enrichment queries per entity ---

const PG_QUERIES: Record<string, string> = {
  opportunities: `
    SELECT o.id, o.title, o.summary, o.type, o.contract_type, o.location_type,
           o.locations, o.status, o.deadline, o.slug,
           o.compensation_min, o.compensation_max, o.currency,
           org.name as org_name, org.slug as org_slug
    FROM opportunities o
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE o.id = ANY($1::uuid[]) AND o.status = 'OPEN' AND o.deleted_at IS NULL`,
  communities: `
    SELECT c.id, c.name, c.description, c.type, c.slug, c.is_paid, c.city,
           org.name as org_name,
           (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
    FROM communities c
    LEFT JOIN organizations org ON c.organization_id = org.id
    WHERE c.id = ANY($1::uuid[]) AND c.status = 'ACTIVE' AND c.deleted_at IS NULL`,
  spaces: `
    SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
           s.hourly_rate, s.city,
           org.name as org_name
    FROM spaces s
    LEFT JOIN organizations org ON s.organization_id = org.id
    WHERE s.id = ANY($1::uuid[]) AND s.status = 'ACTIVE' AND s.deleted_at IS NULL`,
  organizations: `
    SELECT o.id, o.name, o.description, o.sectors, o.slug,
           o.headquarters_city as city, o.headquarters_country as country
    FROM organizations o
    WHERE o.id = ANY($1::uuid[]) AND o.deleted_at IS NULL`,
  talents: `
    SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
           t.bio, t.city, t.country,
           (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level))
            FROM (SELECT canonical_name, proficiency_level FROM talent_skills WHERE talent_id = t.id ORDER BY canonical_name LIMIT 5) ts) as top_skills
    FROM talents t
    WHERE t.id = ANY($1::uuid[]) AND t.deleted_at IS NULL`,
};

// --- Keyword fallback queries per entity ---

const KEYWORD_QUERIES: Record<string, (query: string, filters: Record<string, unknown>, limit: number) => { sql: string; params: any[] }> = {
  opportunities: (query, filters, limit) => {
    const p: any[] = [];
    let idx = 1;
    let sql = `
      SELECT o.id, o.title, o.summary, o.type, o.contract_type, o.location_type,
             o.locations, o.status, o.deadline, o.slug,
             o.compensation_min, o.compensation_max, o.currency,
             org.name as org_name, org.slug as org_slug
      FROM opportunities o
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE o.status = 'OPEN' AND o.deleted_at IS NULL`;
    if (query) { sql += ` AND (o.title ILIKE '%' || $${idx}::text || '%' OR o.summary ILIKE '%' || $${idx}::text || '%')`; p.push(query); idx++; }
    if (filters.type) { sql += ` AND o.type = $${idx}::text`; p.push(filters.type); idx++; }
    if (filters.contractType || filters.contract_type) { sql += ` AND o.contract_type = $${idx}::text`; p.push(filters.contractType || filters.contract_type); idx++; }
    if (filters.location) { sql += ` AND o.locations::text ILIKE '%' || $${idx}::text || '%'`; p.push(filters.location); idx++; }
    sql += ` ORDER BY o.posted_at DESC NULLS LAST LIMIT $${idx}`;
    p.push(limit);
    return { sql, params: p };
  },
  communities: (query, filters, limit) => {
    const p: any[] = [];
    let idx = 1;
    let sql = `
      SELECT c.id, c.name, c.description, c.type, c.slug, c.is_paid, c.city,
             org.name as org_name,
             (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
      FROM communities c
      LEFT JOIN organizations org ON c.organization_id = org.id
      WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL`;
    if (query) { sql += ` AND (c.name ILIKE '%' || $${idx} || '%' OR c.description ILIKE '%' || $${idx} || '%')`; p.push(query); idx++; }
    if (filters.type) { sql += ` AND c.type = $${idx}`; p.push(filters.type); idx++; }
    sql += ` ORDER BY member_count DESC LIMIT $${idx}`;
    p.push(limit);
    return { sql, params: p };
  },
  spaces: (query, filters, limit) => {
    const p: any[] = [];
    let idx = 1;
    let sql = `
      SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
             s.hourly_rate, s.city,
             org.name as org_name
      FROM spaces s
      LEFT JOIN organizations org ON s.organization_id = org.id
      WHERE s.status = 'ACTIVE' AND s.deleted_at IS NULL`;
    if (query) { sql += ` AND (s.name ILIKE '%' || $${idx} || '%' OR s.description ILIKE '%' || $${idx} || '%')`; p.push(query); idx++; }
    if (filters.type) { sql += ` AND s.type = $${idx}`; p.push(filters.type); idx++; }
    if (filters.location) { sql += ` AND s.city ILIKE '%' || $${idx} || '%'`; p.push(filters.location); idx++; }
    sql += ` ORDER BY s.created_at DESC NULLS LAST LIMIT $${idx}`;
    p.push(limit);
    return { sql, params: p };
  },
  organizations: (query, filters, limit) => {
    const p: any[] = [];
    let idx = 1;
    let sql = `
      SELECT o.id, o.name, o.description, o.sectors, o.slug,
             o.headquarters_city as city, o.headquarters_country as country
      FROM organizations o
      WHERE o.deleted_at IS NULL AND o.verification_status IN ('VERIFIED', 'OFFICIAL') AND o.is_visible = TRUE`;
    if (query) { sql += ` AND (o.name ILIKE '%' || $${idx} || '%' OR o.description ILIKE '%' || $${idx} || '%')`; p.push(query); idx++; }
    if (filters.sectors) { sql += ` AND o.sectors && $${idx}::text[]`; p.push(filters.sectors); idx++; }
    sql += ` ORDER BY o.name LIMIT $${idx}`;
    p.push(limit);
    return { sql, params: p };
  },
  talents: (query, filters, limit) => {
    const p: any[] = [];
    let idx = 1;
    let sql = `
      SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
             t.bio, t.city, t.country,
             (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level))
              FROM (SELECT canonical_name, proficiency_level FROM talent_skills WHERE talent_id = t.id ORDER BY canonical_name LIMIT 5) ts) as top_skills
      FROM talents t
      WHERE t.deleted_at IS NULL AND t.is_visible = TRUE`;
    if (query) { sql += ` AND (COALESCE(t.first_name || ' ' || t.last_name, t.email) ILIKE '%' || $${idx} || '%' OR t.bio ILIKE '%' || $${idx} || '%')`; p.push(query); idx++; }
    if (filters.skills && Array.isArray(filters.skills) && filters.skills.length > 0) {
      sql += ` AND EXISTS (SELECT 1 FROM talent_skills ts WHERE ts.talent_id = t.id AND LOWER(ts.canonical_name) = ANY($${idx}::text[]))`;
      p.push((filters.skills as string[]).map((s: string) => s.toLowerCase()));
      idx++;
    }
    sql += ` ORDER BY t.first_name, t.last_name LIMIT $${idx}`;
    p.push(limit);
    return { sql, params: p };
  },
};

// --- Result mappers per entity ---

function mapOpportunity(r: any, score: number) {
  return {
    id: r.id, title: r.title, summary: r.summary?.slice(0, 200),
    type: r.type, contractType: r.contract_type, locationType: r.location_type,
    location: r.locations?.[0]?.city || '', organization: r.org_name, slug: r.slug,
    compensationMin: r.compensation_min, compensationMax: r.compensation_max, currency: r.currency,
    matchScore: score,
  };
}

function mapCommunity(r: any, score: number) {
  return {
    id: r.id, name: r.name, description: r.description?.slice(0, 200),
    type: r.type, memberCount: parseInt(r.member_count) || 0,
    organization: r.org_name, slug: r.slug, isPaid: r.is_paid, city: r.city,
    matchScore: score,
  };
}

function mapSpace(r: any, score: number) {
  return {
    id: r.id, name: r.name, description: r.description?.slice(0, 200),
    type: r.type, capacity: r.capacity, hourlyRate: r.hourly_rate,
    city: r.city, organization: r.org_name, slug: r.slug,
    matchScore: score,
  };
}

function mapOrganization(r: any, score: number) {
  return {
    id: r.id, name: r.name, description: r.description?.slice(0, 200),
    sectors: r.sectors, location: [r.city, r.country].filter(Boolean).join(', '),
    slug: r.slug, matchScore: score,
  };
}

function mapTalent(r: any, score: number) {
  return {
    id: r.id, name: r.display_name, bio: r.bio?.slice(0, 200),
    location: [r.city, r.country].filter(Boolean).join(', '),
    topSkills: r.top_skills, matchScore: score,
  };
}

const MAPPERS: Record<string, (r: any, score: number) => any> = {
  opportunities: mapOpportunity,
  communities: mapCommunity,
  spaces: mapSpace,
  organizations: mapOrganization,
  talents: mapTalent,
};

// Anti-loop cache — module level to avoid self-reference issues
const _smartSearchCache = new Map<string, any>();

export const smartSearchTool = defineTool({
  name: 'smart_search',
  description:
    'Unified discovery search combining semantic ranking (Pinecone) with structured data (PostgreSQL). Use for ANY search/discovery request — finding opportunities, communities, spaces, talents, or organizations. Put ALL search criteria (location, domain, skills, etc.) directly in the query text. Returns enriched results with relevance scores. Automatically falls back to keyword search if semantic results are insufficient.',
  parameters: z.object({
    query: z.string().describe('Natural language search query. Include location, domain, skills, and any other criteria directly in the text. Example: "developpement web React Node.js Abidjan" or "communaute tech entrepreneuriat Dakar"'),
    entity: z.enum([
      'opportunities',
      'communities',
      'spaces',
      'talents',
      'organizations',
    ]).describe('The entity type to search.'),
    topK: z.number().min(1).max(30).default(10).describe('Number of results to return. Default 10.'),
    filters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional structured filters. Example: {"contract_type":"CDI"} or {"type":"EMPLOYMENT"}. Put search criteria in query text instead when possible.'),
  }),
  execute: async ({ query, entity, topK, filters: rawFilters }): Promise<any> => {
    const cacheKey = `${entity}:${query}:${topK}:${JSON.stringify(rawFilters || {})}`;

    // Anti-loop: return cached result on repeat calls
    if (_smartSearchCache.has(cacheKey)) {
      logger.warn(`[smart_search] Returning cached result for ${entity}:${query}`);
      const cached = _smartSearchCache.get(cacheKey);
      return { ...cached, _cached: true, _note: `Cached data from your first call. Do NOT call smart_search again with the same query.` };
    }

    try {
      const filters = rawFilters ? sanitizeFilters(rawFilters, entity) : {};
      const mapper = MAPPERS[entity];

      // --- Phase 1: Pinecone semantic search ---
      let pineconeIds: Array<{ id: string; score: number }> = [];
      try {
        const embedding = await generateEmbedding(query);
        const index = pinecone.index(PINECONE_INDEX);

        const pineconeFilter: Record<string, unknown> = {
          type: ENTITY_TO_TYPE[entity] || entity,
          ...filters,
        };

        let searchResult;
        try {
          searchResult = await index.query({
            vector: embedding,
            topK,
            filter: pineconeFilter,
            includeMetadata: true,
          });
        } catch (filterError: any) {
          // Fallback: retry with type-only filter if extra filters cause issues
          logger.warn('[smart_search] Pinecone filter error, retrying with type-only filter:', filterError.message);
          searchResult = await index.query({
            vector: embedding,
            topK,
            filter: { type: ENTITY_TO_TYPE[entity] || entity },
            includeMetadata: true,
          });
        }

        pineconeIds = searchResult.matches
          .filter((m) => m.score && m.score > SEMANTIC_THRESHOLD)
          .map((m) => ({
            id: (m.metadata?.id as string) || m.id.replace(`${ENTITY_TO_TYPE[entity] || entity}:`, ''),
            score: Math.round((m.score || 0) * 100),
          }));
      } catch (embeddingError: any) {
        logger.warn('[smart_search] Pinecone/embedding error, falling back to keyword-only:', embeddingError.message);
      }

      // --- Phase 2: PostgreSQL enrichment + keyword fallback ---
      const semanticResults: any[] = [];
      const semanticIdSet = new Set<string>();

      // Enrich Pinecone results with PostgreSQL
      if (pineconeIds.length > 0) {
        const entityIds = pineconeIds.map((i) => i.id);
        const pgQuery = PG_QUERIES[entity];
        if (pgQuery) {
          const res = await queryWithRetry(pgQuery, [entityIds]);
          for (const row of res.rows) {
            const pineconeMatch = pineconeIds.find((i) => i.id === row.id);
            semanticResults.push(mapper(row, pineconeMatch?.score || 0));
            semanticIdSet.add(row.id);
          }
        }
      }

      // Keyword fallback if < threshold Pinecone results
      let keywordResults: any[] = [];
      let source: 'semantic' | 'keyword' | 'hybrid' = pineconeIds.length > 0 ? 'semantic' : 'keyword';

      if (pineconeIds.length < KEYWORD_FALLBACK_THRESHOLD) {
        const keywordBuilder = KEYWORD_QUERIES[entity];
        if (keywordBuilder) {
          const remainingSlots = topK - semanticResults.length;
          if (remainingSlots > 0) {
            const { sql, params } = keywordBuilder(query, filters, remainingSlots + 5); // fetch extra for dedup
            const kwRes = await queryWithRetry(sql, params);
            for (const row of kwRes.rows) {
              if (!semanticIdSet.has(row.id)) {
                keywordResults.push(mapper(row, 0));
              }
            }
            keywordResults = keywordResults.slice(0, remainingSlots);
            if (semanticResults.length > 0 && keywordResults.length > 0) {
              source = 'hybrid';
            }
          }
        }
      }

      // --- Phase 3: Merge + sort ---
      const allResults = [...semanticResults, ...keywordResults];

      // Sort: semantic score DESC, then keyword results at end
      allResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

      const finalResults = allResults.slice(0, topK);

      const result = {
        results: finalResults,
        totalFound: finalResults.length,
        source,
      };

      // Cache for anti-loop
      _smartSearchCache.set(cacheKey, result);

      if (finalResults.length === 0) {
        return { results: [], totalFound: 0, source, message: 'Aucun resultat trouve pour cette recherche.' };
      }

      return result;
    } catch (error: any) {
      logger.error('[smart_search] Error:', error);
      return { results: [], error: error.message };
    }
  },
});
