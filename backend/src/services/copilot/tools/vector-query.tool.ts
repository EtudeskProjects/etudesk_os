/**
 * Vector Query Tool — Pinecone semantic search
 * Wraps existing search tools with a unified Pinecone interface
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from '../../embedding.service';
import { pool } from '../../database';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'etudesk';

export const vectorQueryTool = tool({
  name: 'vector_query',
  description:
    'Recherche sémantique dans la base vectorielle Pinecone. Utilise pour trouver des opportunités, communautés, espaces, talents ou organisations similaires à une description en langage naturel.',
  parameters: z.object({
    query: z.string().describe('La requête de recherche en langage naturel'),
    namespace: z.enum([
      'opportunities',
      'communities',
      'spaces',
      'talents',
      'organizations',
      'skills',
    ]),
    topK: z.number().min(1).max(20).default(5),
    filters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Filtres metadata Pinecone (ex: { type: "EMPLOYMENT" })'),
  }),
  execute: async ({ query, namespace, topK, filters }) => {
    try {
      const embedding = await generateEmbedding(query);
      const index = pinecone.index(PINECONE_INDEX);

      const pineconeFilter: Record<string, unknown> = {
        type: namespace.slice(0, -1), // opportunities -> opportunity
        ...filters,
      };

      const searchResult = await index.query({
        vector: embedding,
        topK,
        filter: pineconeFilter,
        includeMetadata: true,
      });

      const ids = searchResult.matches
        .filter((m) => m.score && m.score > 0.4)
        .map((m) => ({
          id: (m.metadata?.id as string) || m.id.replace(`${namespace.slice(0, -1)}:`, ''),
          score: Math.round((m.score || 0) * 100),
          metadata: m.metadata,
        }));

      if (ids.length === 0) {
        return { results: [], message: 'Aucun résultat trouvé pour cette recherche.' };
      }

      // Fetch full records from PostgreSQL
      const entityIds = ids.map((i) => i.id);
      let results: any[] = [];

      switch (namespace) {
        case 'opportunities': {
          const res = await pool.query(
            `SELECT o.id, o.title, o.summary, o.type, o.contract_type, o.location_type,
                    o.locations, o.status, o.deadline, o.slug,
                    org.name as org_name, org.slug as org_slug
             FROM opportunities o
             LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
             LEFT JOIN organizations org ON op.poster_organization_id = org.id
             WHERE o.id = ANY($1::uuid[]) AND o.status = 'OPEN' AND o.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r) => ({
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
          const res = await pool.query(
            `SELECT c.id, c.name, c.description, c.type, c.slug, c.is_paid, c.city,
                    org.name as org_name,
                    (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
             FROM communities c
             LEFT JOIN organizations org ON c.organization_id = org.id
             WHERE c.id = ANY($1::uuid[]) AND c.status = 'ACTIVE' AND c.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r) => ({
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
          const res = await pool.query(
            `SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
                    s.hourly_rate, s.currency, s.city,
                    org.name as org_name
             FROM spaces s
             LEFT JOIN organizations org ON s.organization_id = org.id
             WHERE s.id = ANY($1::uuid[]) AND s.is_active = true AND s.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description?.slice(0, 200),
            type: r.type,
            capacity: r.capacity,
            hourlyRate: r.hourly_rate,
            currency: r.currency,
            city: r.city,
            organization: r.org_name,
            slug: r.slug,
            matchScore: ids.find((i) => i.id === r.id)?.score,
          }));
          break;
        }
        case 'organizations': {
          const res = await pool.query(
            `SELECT o.id, o.name, o.description, o.sectors, o.slug, o.city, o.country
             FROM organizations o
             WHERE o.id = ANY($1::uuid[]) AND o.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r) => ({
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
          const res = await pool.query(
            `SELECT t.id, t.display_name, t.headline, t.city, t.country
             FROM talents t
             WHERE t.id = ANY($1::uuid[]) AND t.deleted_at IS NULL`,
            [entityIds]
          );
          results = res.rows.map((r) => ({
            id: r.id,
            name: r.display_name,
            headline: r.headline,
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
      console.error('Vector query error:', error);
      return { results: [], error: error.message };
    }
  },
});
