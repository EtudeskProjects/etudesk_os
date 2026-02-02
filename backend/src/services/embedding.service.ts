/**
 * Embedding Service - Semantic similarity using OpenAI embeddings and Pinecone
 *
 * Uses:
 * - OpenAI text-embedding-3-small for generating embeddings
 * - Pinecone for vector storage and similarity search
 * - PostgreSQL as fallback/cache
 */

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { pool } from './database';
import { buildTalentObject } from './ai/talent-object';

// ═══════════════════════════════════════════════════════════════
// CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'etudesk';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSION = parseInt(process.env.PINECONE_DIMENSION || '1536', 10);

// Cache for embeddings to reduce API calls
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ═══════════════════════════════════════════════════════════════
// EMBEDDING TEXT BUILDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Build embedding text for a talent profile
 * Optimized for ~500 tokens max
 */
export function buildTalentEmbeddingText(talent: {
  display_name?: string | null;
  skills?: string[];
  sectors?: string[];
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  profile_tags?: string[];
}): string {
  const parts: string[] = [];

  if (talent.display_name) {
    parts.push(talent.display_name);
  }

  if (talent.skills && talent.skills.length > 0) {
    parts.push(`Compétences: ${talent.skills.slice(0, 10).join(', ')}`);
  }

  if (talent.sectors && talent.sectors.length > 0) {
    parts.push(`Secteurs: ${talent.sectors.slice(0, 5).join(', ')}`);
  }

  if (talent.profile_tags && talent.profile_tags.length > 0) {
    parts.push(`Profil: ${talent.profile_tags.join(', ')}`);
  }

  if (talent.city || talent.country) {
    parts.push(`Localisation: ${[talent.city, talent.country].filter(Boolean).join(', ')}`);
  }

  if (talent.bio) {
    // Limit bio to ~200 chars
    parts.push(talent.bio.slice(0, 200));
  }

  return parts.join('. ').slice(0, 800);
}

/**
 * Build embedding text for an opportunity
 * Optimized for ~500 tokens max
 */
export function buildOpportunityEmbeddingText(opportunity: {
  title?: string;
  summary?: string;
  requirements?: string;
  nice_to_have?: string;
  type?: string;
  contract_type?: string;
  work_rhythm?: string;
  location_type?: string;
  locations?: Array<{ city?: string; country?: string }>;
  sectors?: string[];
}): string {
  const parts: string[] = [];

  if (opportunity.title) {
    parts.push(opportunity.title);
  }

  if (opportunity.type) {
    parts.push(`Type: ${opportunity.type}`);
  }

  if (opportunity.contract_type) {
    parts.push(`Contrat: ${opportunity.contract_type}`);
  }

  if (opportunity.work_rhythm) {
    parts.push(`Rythme: ${opportunity.work_rhythm}`);
  }

  if (opportunity.location_type) {
    parts.push(`Mode: ${opportunity.location_type}`);
  }

  const location = opportunity.locations?.[0];
  if (location?.city || location?.country) {
    parts.push(`Lieu: ${[location.city, location.country].filter(Boolean).join(', ')}`);
  }

  if (opportunity.sectors && opportunity.sectors.length > 0) {
    parts.push(`Secteurs: ${opportunity.sectors.slice(0, 5).join(', ')}`);
  }

  if (opportunity.summary) {
    parts.push(opportunity.summary.slice(0, 300));
  }

  if (opportunity.requirements) {
    parts.push(`Requis: ${opportunity.requirements.slice(0, 200)}`);
  }

  return parts.join('. ').slice(0, 800);
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = `emb:${Buffer.from(text).toString('base64').slice(0, 50)}`;
  const cached = embeddingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding;
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSION,
    });

    const embedding = response.data[0].embedding;

    // Cache the result
    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// PINECONE OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Pinecone index
 */
function getPineconeIndex() {
  return pinecone.index(PINECONE_INDEX);
}

/**
 * Upsert talent embedding to Pinecone
 */
export async function upsertTalentEmbedding(
  talentId: string,
  talent: Parameters<typeof buildTalentEmbeddingText>[0]
): Promise<void> {
  try {
    const text = buildTalentEmbeddingText(talent);
    const embedding = await generateEmbedding(text);

    const index = getPineconeIndex();
    await index.upsert([
      {
        id: `talent:${talentId}`,
        values: embedding,
        metadata: {
          type: 'talent',
          id: talentId,
          text: text.slice(0, 500),
        },
      },
    ]);

    // Note: Embedding is stored in Pinecone only, not in PostgreSQL
    // to avoid schema complexity and since Pinecone is the primary vector store
  } catch (error) {
    console.error('Error upserting talent embedding:', error);
    // Don't throw - embedding is optional enhancement
  }
}

/**
 * Upsert opportunity embedding to Pinecone
 */
export async function upsertOpportunityEmbedding(
  opportunityId: string,
  opportunity: Parameters<typeof buildOpportunityEmbeddingText>[0]
): Promise<void> {
  try {
    const text = buildOpportunityEmbeddingText(opportunity);
    const embedding = await generateEmbedding(text);

    const index = getPineconeIndex();
    await index.upsert([
      {
        id: `opportunity:${opportunityId}`,
        values: embedding,
        metadata: {
          type: 'opportunity',
          id: opportunityId,
          text: text.slice(0, 500),
        },
      },
    ]);

    // Note: Embedding is stored in Pinecone only, not in PostgreSQL
    // to avoid schema complexity and since Pinecone is the primary vector store
  } catch (error) {
    console.error('Error upserting opportunity embedding:', error);
    // Don't throw - embedding is optional enhancement
  }
}

// ═══════════════════════════════════════════════════════════════
// SIMILARITY CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get semantic similarity between talent and opportunity
 * Returns a boost value between -20 and +20
 */
export async function getSemanticBoost(
  talentId: string,
  opportunityId: string
): Promise<number> {
  try {
    // Try to get from Pinecone first
    const index = getPineconeIndex();

    // Fetch talent embedding
    const talentResult = await index.fetch([`talent:${talentId}`]);
    const talentVector = talentResult.records[`talent:${talentId}`]?.values;

    // Fetch opportunity embedding
    const oppResult = await index.fetch([`opportunity:${opportunityId}`]);
    const oppVector = oppResult.records[`opportunity:${opportunityId}`]?.values;

    if (talentVector && oppVector) {
      const similarity = cosineSimilarity(talentVector, oppVector);
      // Convert similarity (0-1) to boost (-20 to +20)
      // similarity of 0.5 = neutral (0 boost)
      // similarity of 1.0 = max boost (+20)
      // similarity of 0.0 = min boost (-20)
      return (similarity - 0.5) * 40;
    }

    // Fallback: try PostgreSQL (only if columns exist)
    try {
      const pgResult = await pool.query(`
        SELECT
          t.embedding as talent_embedding,
          o.embedding as opp_embedding
        FROM talents t, opportunities o
        WHERE t.id = $1 AND o.id = $2
      `, [talentId, opportunityId]);

      if (pgResult.rows.length > 0) {
        const { talent_embedding, opp_embedding } = pgResult.rows[0];

        if (talent_embedding && opp_embedding) {
          const talentEmb = typeof talent_embedding === 'string'
            ? JSON.parse(talent_embedding)
            : talent_embedding;
          const oppEmb = typeof opp_embedding === 'string'
            ? JSON.parse(opp_embedding)
            : opp_embedding;

          const similarity = cosineSimilarity(talentEmb, oppEmb);
          return (similarity - 0.5) * 40;
        }
      }
    } catch (pgError: any) {
      // Ignore errors if embedding columns don't exist
      // This is expected if migrations haven't been run
      if (pgError.code !== '42703') { // 42703 = undefined column
        console.warn('PostgreSQL fallback failed (non-critical):', pgError.message);
      }
    }

    // No embeddings available, return neutral
    return 0;
  } catch (error) {
    console.error('Error getting semantic boost:', error);
    return 0; // Neutral boost on error
  }
}

/**
 * Generate embedding for a talent on profile update
 * Call this when talent profile is created/updated
 */
export async function onTalentProfileUpdate(talentId: string): Promise<void> {
  try {
    const t = await buildTalentObject(talentId);
    if (t) {
      await upsertTalentEmbedding(talentId, {
        display_name: t.display_name,
        skills: t.skills,
        sectors: t.sectors,
        bio: t.bio,
        city: t.city,
        country: t.country,
        profile_tags: t.profile_tags,
      });
    }
  } catch (error) {
    console.error('Error updating talent embedding on profile update:', error);
  }
}

/**
 * Generate embedding for an opportunity on creation/update
 * Call this when opportunity is created/updated
 */
export async function onOpportunityUpdate(opportunityId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        o.title, o.summary, o.requirements, o.nice_to_have,
        o.type, o.contract_type, o.work_rhythm, o.location_type, o.locations,
        org.sectors
      FROM opportunities o
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE o.id = $1
    `, [opportunityId]);

    if (result.rows.length > 0) {
      await upsertOpportunityEmbedding(opportunityId, result.rows[0]);
    }
  } catch (error) {
    console.error('Error updating opportunity embedding:', error);
  }
}

/**
 * Batch update embeddings for all talents (for initial setup)
 */
export async function batchUpdateTalentEmbeddings(limit: number = 100): Promise<number> {
  // Note: We don't check PostgreSQL embedding column since it may not exist
  // Pinecone is the source of truth for embeddings
  const result = await pool.query(`
    SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.sectors, t.bio, t.city, t.country, t.profile_tags,
           ARRAY(
             SELECT canonical_name FROM talent_skills
             WHERE talent_id = t.id
           ) as skills
    FROM talents t
    LIMIT $1
  `, [limit]);

  let updated = 0;
  for (const talent of result.rows) {
    try {
      await upsertTalentEmbedding(talent.id, talent);
      updated++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error updating embedding for talent ${talent.id}:`, error);
    }
  }

  return updated;
}

/**
 * Batch update embeddings for all opportunities (for initial setup)
 */
export async function batchUpdateOpportunityEmbeddings(limit: number = 100): Promise<number> {
  // Note: We don't check PostgreSQL embedding column since it may not exist
  // Pinecone is the source of truth for embeddings
  const result = await pool.query(`
    SELECT o.id, o.title, o.summary, o.requirements, o.nice_to_have,
           o.type, o.contract_type, o.work_rhythm, o.location_type, o.locations,
           org.sectors
    FROM opportunities o
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE o.deleted_at IS NULL
    LIMIT $1
  `, [limit]);

  let updated = 0;
  for (const opp of result.rows) {
    try {
      await upsertOpportunityEmbedding(opp.id, opp);
      updated++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error updating embedding for opportunity ${opp.id}:`, error);
    }
  }

  return updated;
}
