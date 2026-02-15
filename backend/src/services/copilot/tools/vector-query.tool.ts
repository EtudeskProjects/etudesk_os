/**
 * Vector Query Tool — Pinecone semantic search
 * Wraps existing search tools with a unified Pinecone interface
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

const NAMESPACE_TO_TYPE: Record<string, string> = {
  opportunities: 'opportunity',
  communities: 'community',
  spaces: 'space',
  talents: 'talent',
  organizations: 'organization',
};

/**
 * Sanitize filters to only keep Pinecone-compatible values (strings, numbers, booleans).
 * Strips out arrays-of-objects, nested objects, etc.
 */
function sanitizeFilters(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    } else if (Array.isArray(val) && val.every((v) => typeof v === 'string' || typeof v === 'number')) {
      clean[key] = { $in: val };
    }
    // skip arrays of objects, nested objects, etc.
  }
  return clean;
}

export const vectorQueryTool = defineTool({
  name: 'vector_query',
  description:
    'Semantic search in Pinecone vector database. Use as the FIRST tool for discovery requests — finding opportunities, communities, spaces, talents, or organizations matching a natural language description. Put ALL search criteria (location, domain, skills, etc.) directly in the query text. Filters are optional and only support simple scalar values.',
  parameters: z.object({
    query: z.string().describe('Natural language search query. Include location, domain, skills, and any other criteria directly in the text. Example: "développement web React Node.js Abidjan" or "communauté tech entrepreneuriat Dakar"'),
    namespace: z.enum([
      'opportunities',
      'communities',
      'spaces',
      'talents',
      'organizations',
    ]).describe('The entity type to search. Choose based on what the user is looking for.'),
    topK: z.number().min(1).max(30).default(10).describe('Number of results to return. Default 10. Use higher values (15-20) when the user needs comprehensive results.'),
    filtersJson: z
      .string()
      .default('')
      .describe('Pinecone metadata filters as JSON string. ONLY simple scalar values: \'{"contract_type":"CDI"}\' or \'{"type":"EMPLOYMENT"}\'. Do NOT use nested objects or arrays of objects. Use empty string for no filter (recommended — put criteria in the query text instead).'),
  }),
  execute: async ({ query, namespace, topK, filtersJson }) => {
    try {
      const rawFilters = filtersJson && filtersJson.trim() ? JSON.parse(filtersJson) : {};
      const filters = sanitizeFilters(rawFilters);
      const embedding = await generateEmbedding(query);
      const index = pinecone.index(PINECONE_INDEX);

      const pineconeFilter: Record<string, unknown> = {
        type: NAMESPACE_TO_TYPE[namespace] || namespace,
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
        logger.warn('Vector query filter error, retrying with type-only filter:', filterError.message);
        searchResult = await index.query({
          vector: embedding,
          topK,
          filter: { type: NAMESPACE_TO_TYPE[namespace] || namespace },
          includeMetadata: true,
        });
      }

      const ids = searchResult.matches
        .filter((m) => m.score && m.score > 0.4)
        .map((m) => ({
          id: (m.metadata?.id as string) || m.id.replace(`${NAMESPACE_TO_TYPE[namespace] || namespace}:`, ''),
          score: Math.round((m.score || 0) * 100),
          metadata: m.metadata,
        }));

      if (ids.length === 0) {
        return { results: [], message: 'Aucun résultat trouvé pour cette recherche.' };
      }

      // Fetch full records from PostgreSQL (with retry for transient connection errors)
      const entityIds = ids.map((i) => i.id);
      let results: any[] = [];

      const queryWithRetry = async (text: string, params: any[], retries = 2): Promise<any> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await pool.query(text, params);
          } catch (err: any) {
            const isTransient = err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET') ||
              err.code === 'EPIPE' || err.code === 'ETIMEDOUT' || err.code === 'CONNECTION_ENDED';
            if (isTransient && attempt < retries) {
              logger.warn(`[vector_query] DB transient error (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
              await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
      };

      switch (namespace) {
        case 'opportunities': {
          const res = await queryWithRetry(
            `SELECT o.id, o.title, o.summary, o.type, o.contract_type, o.location_type,
                    o.locations, o.status, o.deadline, o.slug,
                    org.name as org_name, org.slug as org_slug
             FROM opportunities o
             LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
             LEFT JOIN organizations org ON op.poster_organization_id = org.id
             WHERE o.id = ANY($1::uuid[]) AND o.status = 'OPEN' AND o.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            summary: r.summary?.slice(0, 200),
            type: r.type,
            contractType: r.contract_type,
            locationType: r.location_type,
            location: r.locations?.[0]?.city || '',
            organization: r.org_name,
            slug: r.slug,
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        case 'communities': {
          const res = await queryWithRetry(
            `SELECT c.id, c.name, c.description, c.type, c.slug, c.is_paid, c.city,
                    org.name as org_name,
                    (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
             FROM communities c
             LEFT JOIN organizations org ON c.organization_id = org.id
             WHERE c.id = ANY($1::uuid[]) AND c.status = 'ACTIVE' AND c.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description?.slice(0, 200),
            type: r.type,
            memberCount: parseInt(r.member_count) || 0,
            organization: r.org_name,
            slug: r.slug,
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        case 'spaces': {
          const res = await queryWithRetry(
            `SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
                    s.hourly_rate, s.city,
                    org.name as org_name
             FROM spaces s
             LEFT JOIN organizations org ON s.organization_id = org.id
             WHERE s.id = ANY($1::uuid[]) AND s.status = 'ACTIVE' AND s.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description?.slice(0, 200),
            type: r.type,
            capacity: r.capacity,
            hourlyRate: r.hourly_rate,
            city: r.city,
            organization: r.org_name,
            slug: r.slug,
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        case 'organizations': {
          const res = await queryWithRetry(
            `SELECT o.id, o.name, o.description, o.sectors, o.slug, o.headquarters_city as city, o.headquarters_country as country
             FROM organizations o
             WHERE o.id = ANY($1::uuid[]) AND o.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description?.slice(0, 200),
            sectors: r.sectors,
            location: [r.city, r.country].filter(Boolean).join(', '),
            slug: r.slug,
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        case 'talents': {
          const res = await queryWithRetry(
            `SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio, t.city, t.country
             FROM talents t
             WHERE t.id = ANY($1::uuid[]) AND t.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r: any) => ({
            id: r.id,
            name: r.display_name,
            bio: r.bio?.slice(0, 200),
            location: [r.city, r.country].filter(Boolean).join(', '),
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        default:
          results = ids;
      }

      return { results, totalFound: results.length };
    } catch (error: any) {
      logger.error('Vector query error:', error);
      return { results: [], error: error.message };
    }
  },
});
