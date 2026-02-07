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
import { MODEL_EMBEDDING } from './ai/models';
import { pool } from './database';
import { buildTalentObject } from './ai/talent-object';

import { logger } from '../utils';
// --- Client Initialization ---

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'etudesk';
const EMBEDDING_MODEL = MODEL_EMBEDDING;
const EMBEDDING_DIMENSION = parseInt(process.env.PINECONE_DIMENSION || '1536', 10);

// Cache for embeddings to reduce API calls
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// --- Embedding Text Builders ---

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
  // New fields
  goals?: string[];
  remote_ready?: boolean;
  willing_to_relocate?: boolean;
  documents_metadata?: Array<{ title?: string | null; original_filename: string }>;
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

  if (talent.goals && talent.goals.length > 0) {
    parts.push(`Objectifs: ${talent.goals.join(', ')}`);
  }

  if (talent.remote_ready) parts.push('Disponible en télétravail');
  if (talent.willing_to_relocate) parts.push('Prêt à déménager');

  if (talent.documents_metadata && talent.documents_metadata.length > 0) {
    const docNames = talent.documents_metadata
      .map((d) => d.title || d.original_filename)
      .join(', ');
    parts.push(`Documents: ${docNames}`);
  }

  return parts.join('. ').slice(0, 1000);
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

/**
 * Build embedding text for a community
 * Optimized for ~500 tokens max
 */
export function buildCommunityEmbeddingText(community: {
  name?: string;
  description?: string | null;
  type?: string | null;
  access_type?: string | null;
  sectors?: string[];
  tags?: string[];
  city?: string | null;
  country?: string | null;
  is_paid?: boolean;
}): string {
  const parts: string[] = [];

  if (community.name) parts.push(community.name);
  if (community.type) parts.push(`Type: ${community.type}`);
  if (community.access_type) parts.push(`Accès: ${community.access_type}`);

  if (community.city || community.country) {
    parts.push(`Lieu: ${[community.city, community.country].filter(Boolean).join(', ')}`);
  }

  if (community.sectors && community.sectors.length > 0) {
    parts.push(`Secteurs: ${community.sectors.slice(0, 5).join(', ')}`);
  }

  if (community.tags && community.tags.length > 0) {
    parts.push(`Tags: ${community.tags.slice(0, 8).join(', ')}`);
  }

  if (community.is_paid) parts.push('Communauté payante');

  if (community.description) {
    parts.push(community.description.slice(0, 300));
  }

  return parts.join('. ').slice(0, 800);
}

/**
 * Build embedding text for a space
 * Optimized for ~500 tokens max
 */
export function buildSpaceEmbeddingText(space: {
  name?: string;
  description?: string | null;
  type?: string;
  capacity?: number;
  equipment?: string[];
  amenities?: string[];
  sectors?: string[];
  city?: string | null;
  country?: string | null;
  is_bookable?: boolean;
  hourly_rate?: number | null;
  address?: string | null;
}): string {
  const parts: string[] = [];

  if (space.name) parts.push(space.name);
  if (space.type) parts.push(`Type: ${space.type}`);
  if (space.capacity) parts.push(`Capacité: ${space.capacity} personnes`);

  if (space.city || space.country) {
    parts.push(`Lieu: ${[space.city, space.country].filter(Boolean).join(', ')}`);
  }

  if (space.address) parts.push(`Adresse: ${space.address.slice(0, 100)}`);

  if (space.sectors && space.sectors.length > 0) {
    parts.push(`Secteurs: ${space.sectors.slice(0, 5).join(', ')}`);
  }

  if (space.equipment && space.equipment.length > 0) {
    parts.push(`Équipements: ${space.equipment.slice(0, 6).join(', ')}`);
  }

  if (space.amenities && space.amenities.length > 0) {
    parts.push(`Services: ${space.amenities.slice(0, 6).join(', ')}`);
  }

  if (space.hourly_rate) parts.push(`Tarif: ${space.hourly_rate} XOF/h`);
  if (space.is_bookable === false) parts.push('Non réservable en ligne');

  if (space.description) {
    parts.push(space.description.slice(0, 300));
  }

  return parts.join('. ').slice(0, 800);
}

// --- Embedding Generation ---

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
    logger.error('Error generating embedding:', error);
    throw error;
  }
}

// --- Pinecone Operations ---

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
          text: text.slice(0, 1000),
          // Metadata for filtering
          city: talent.city || '',
          country: talent.country || '',
          remote_ready: !!talent.remote_ready,
          willing_to_relocate: !!talent.willing_to_relocate,
          sectors: talent.sectors || [],
          skills: talent.skills || [],
        },
      },
    ]);

    // Note: Embedding is stored in Pinecone only, not in PostgreSQL
    // to avoid schema complexity and since Pinecone is the primary vector store
  } catch (error) {
    logger.error('Error upserting talent embedding:', error);
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
    logger.error('Error upserting opportunity embedding:', error);
    // Don't throw - embedding is optional enhancement
  }
}

/**
 * Upsert community embedding to Pinecone
 */
export async function upsertCommunityEmbedding(
  communityId: string,
  community: Parameters<typeof buildCommunityEmbeddingText>[0]
): Promise<void> {
  try {
    const text = buildCommunityEmbeddingText(community);
    const embedding = await generateEmbedding(text);

    const index = getPineconeIndex();
    await index.upsert([
      {
        id: `community:${communityId}`,
        values: embedding,
        metadata: {
          type: 'community',
          id: communityId,
          text: text.slice(0, 500),
          city: community.city || '',
          country: community.country || '',
          community_type: community.type || '',
          access_type: community.access_type || '',
          is_paid: !!community.is_paid,
          sectors: community.sectors || [],
        },
      },
    ]);
  } catch (error) {
    logger.error('Error upserting community embedding:', error);
  }
}

/**
 * Upsert space embedding to Pinecone
 */
export async function upsertSpaceEmbedding(
  spaceId: string,
  space: Parameters<typeof buildSpaceEmbeddingText>[0]
): Promise<void> {
  try {
    const text = buildSpaceEmbeddingText(space);
    const embedding = await generateEmbedding(text);

    const index = getPineconeIndex();
    await index.upsert([
      {
        id: `space:${spaceId}`,
        values: embedding,
        metadata: {
          type: 'space',
          id: spaceId,
          text: text.slice(0, 500),
          city: space.city || '',
          country: space.country || '',
          space_type: space.type || '',
          capacity: space.capacity || 0,
          is_bookable: space.is_bookable !== false,
          sectors: space.sectors || [],
        },
      },
    ]);
  } catch (error) {
    logger.error('Error upserting space embedding:', error);
  }
}

// --- Similarity Calculation ---

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
        logger.warn('PostgreSQL fallback failed (non-critical):', pgError.message);
      }
    }

    // No embeddings available, return neutral
    return 0;
  } catch (error) {
    logger.error('Error getting semantic boost:', error);
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
        goals: t.goals,
        remote_ready: t.remote_ready,
        willing_to_relocate: t.willing_to_relocate,
        documents_metadata: t.documents_metadata,
      });
    }
  } catch (error) {
    logger.error('Error updating talent embedding on profile update:', error);
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
    logger.error('Error updating opportunity embedding:', error);
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
      logger.error(`Error updating embedding for talent ${talent.id}:`, error);
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
      logger.error(`Error updating embedding for opportunity ${opp.id}:`, error);
    }
  }

  return updated;
}

/**
 * Batch update embeddings for all communities (for initial setup)
 */
export async function batchUpdateCommunityEmbeddings(limit: number = 100): Promise<number> {
  const result = await pool.query(`
    SELECT c.id, c.name, c.description, c.type, c.access_type,
           c.city, c.country, c.is_paid,
           c.sectors::text as sectors_json,
           c.tags::text as tags_json
    FROM communities c
    WHERE c.deleted_at IS NULL AND c.status = 'ACTIVE'
    LIMIT $1
  `, [limit]);

  let updated = 0;
  for (const row of result.rows) {
    try {
      const sectors = row.sectors_json ? JSON.parse(row.sectors_json) : [];
      const tags = row.tags_json ? JSON.parse(row.tags_json) : [];
      await upsertCommunityEmbedding(row.id, {
        ...row,
        sectors,
        tags,
      });
      updated++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error(`Error updating embedding for community ${row.id}:`, error);
    }
  }

  return updated;
}

/**
 * Batch update embeddings for all spaces (for initial setup)
 */
export async function batchUpdateSpaceEmbeddings(limit: number = 100): Promise<number> {
  const result = await pool.query(`
    SELECT s.id, s.name, s.description, s.type, s.capacity,
           s.equipment, s.amenities, s.sectors,
           s.city, s.country, s.is_bookable,
           s.hourly_rate, s.address
    FROM spaces s
    WHERE s.deleted_at IS NULL AND s.status = 'ACTIVE'
    LIMIT $1
  `, [limit]);

  let updated = 0;
  for (const space of result.rows) {
    try {
      await upsertSpaceEmbedding(space.id, space);
      updated++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error(`Error updating embedding for space ${space.id}:`, error);
    }
  }

  return updated;
}
