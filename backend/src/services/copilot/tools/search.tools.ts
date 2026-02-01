/**
 * Search Tools for Copilot
 * Tools for searching opportunities, communities, and spaces
 */

import { z } from 'zod';
import { pool } from '../../database';
import { generateEmbedding } from '../../embedding.service';
import { Pinecone } from '@pinecone-database/pinecone';
// ═══════════════════════════════════════════════════════════════
// LOCAL TYPES (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

interface Card {
  id: string;
  type: 'opportunity' | 'community' | 'space' | 'organization';
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{ label: string; action: string; params?: Record<string, unknown> }>;
}

interface CardListOutput {
  type: string;
  cards: Card[];
  totalCount: number;
  query?: string;
  filters?: Record<string, unknown>;
  hasMore?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// PINECONE CLIENT
// ═══════════════════════════════════════════════════════════════

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'etudesk';

function getPineconeIndex() {
  return pinecone.index(PINECONE_INDEX);
}

// ═══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const searchOpportunitiesSchema = z.object({
  query: z.string().optional().describe('Requête de recherche textuelle'),
  type: z
    .enum(['EMPLOYMENT', 'INTERNSHIP', 'ENTREPRENEURSHIP', 'ALTERNATION', 'FREELANCE', 'VOLUNTEER'])
    .optional()
    .describe("Type d'opportunité"),
  contractType: z
    .enum(['CDI', 'CDD', 'APPRENTICESHIP', 'INTERNSHIP', 'FREELANCE', 'SERVICE', 'INTERIM'])
    .optional()
    .describe('Type de contrat'),
  locationType: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional().describe('Mode de travail'),
  location: z.string().optional().describe('Ville ou région'),
  sectors: z.array(z.string()).optional().describe("Secteurs d'activité"),
  limit: z.number().min(1).max(10).default(5).describe('Nombre maximum de résultats'),
});

export type SearchOpportunitiesParams = z.infer<typeof searchOpportunitiesSchema>;

export async function searchOpportunities(
  params: SearchOpportunitiesParams,
  context: { talentId: string }
): Promise<CardListOutput> {
  const { query, type, contractType, locationType, location, sectors, limit } = params;

  // Build base query
  let sql = `
    SELECT
      o.id, o.title, o.slug, o.summary, o.type, o.contract_type, o.work_rhythm,
      o.location_type, o.locations, o.compensation_min, o.compensation_max, o.currency,
      o.compensation_frequency, o.deadline, o.status, o.cover_image_url,
      o.views_count, o.applications_count,
      org.id as org_id, org.name as org_name, org.logo_url as org_logo, org.slug as org_slug,
      org.sectors as org_sectors
    FROM opportunities o
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE o.status = 'OPEN'
      AND o.deleted_at IS NULL
      AND (o.visibility = 'PUBLIC' OR o.visibility IS NULL)
  `;

  const queryParams: (string | string[])[] = [];
  let paramIndex = 1;

  // Apply filters
  if (type) {
    sql += ` AND o.type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (contractType) {
    sql += ` AND o.contract_type = $${paramIndex}`;
    queryParams.push(contractType);
    paramIndex++;
  }

  if (locationType) {
    sql += ` AND o.location_type = $${paramIndex}`;
    queryParams.push(locationType);
    paramIndex++;
  }

  if (location) {
    sql += ` AND (
      o.locations::text ILIKE '%' || $${paramIndex} || '%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.locations) loc
        WHERE loc->>'city' ILIKE '%' || $${paramIndex} || '%'
        OR loc->>'region' ILIKE '%' || $${paramIndex} || '%'
        OR loc->>'country' ILIKE '%' || $${paramIndex} || '%'
      )
    )`;
    queryParams.push(location);
    paramIndex++;
  }

  if (sectors && sectors.length > 0) {
    sql += ` AND org.sectors && $${paramIndex}::text[]`;
    queryParams.push(sectors);
    paramIndex++;
  }

  // If semantic search query provided, use Pinecone
  let semanticIds: string[] = [];
  if (query) {
    try {
      const embedding = await generateEmbedding(query);
      const index = getPineconeIndex();

      const searchResult = await index.query({
        vector: embedding,
        topK: limit * 2,
        filter: { type: 'opportunity' },
        includeMetadata: true,
      });

      semanticIds = searchResult.matches
        .filter((m) => m.score && m.score > 0.5)
        .map((m) => (m.metadata?.id as string) || m.id.replace('opportunity:', ''));

      if (semanticIds.length > 0) {
        sql += ` AND o.id = ANY($${paramIndex}::uuid[])`;
        queryParams.push(semanticIds);
        paramIndex++;
      }
    } catch (error) {
      console.error('Semantic search error, falling back to text search:', error);
      // Fallback to text search
      sql += ` AND (o.title ILIKE '%' || $${paramIndex} || '%' OR o.summary ILIKE '%' || $${paramIndex} || '%')`;
      queryParams.push(query);
      paramIndex++;
    }
  }

  sql += ` ORDER BY o.posted_at DESC NULLS LAST LIMIT $${paramIndex}`;
  queryParams.push(limit.toString());

  const result = await pool.query(sql, queryParams);

  // Transform to cards
  const cards: Card[] = result.rows.map((row) => {
    const primaryLocation = row.locations?.[0];
    const locationText = primaryLocation
      ? [primaryLocation.city, primaryLocation.country].filter(Boolean).join(', ')
      : row.location_type === 'REMOTE'
        ? 'Télétravail'
        : '';

    return {
      id: row.id,
      type: 'opportunity',
      title: row.title,
      subtitle: row.org_name || 'Entreprise',
      description: row.summary?.slice(0, 150) || '',
      imageUrl: row.cover_image_url || row.org_logo,
      metadata: {
        type: row.type,
        contractType: row.contract_type,
        locationType: row.location_type,
        location: locationText,
        compensation:
          row.compensation_min || row.compensation_max
            ? `${row.compensation_min || '?'} - ${row.compensation_max || '?'} ${row.currency || 'XOF'}/${row.compensation_frequency || 'MONTHLY'}`
            : undefined,
        deadline: row.deadline,
        viewsCount: row.views_count,
        applicationsCount: row.applications_count,
        orgSlug: row.org_slug,
        slug: row.slug,
      },
      actions: [
        { label: 'Voir détails', action: 'navigate', params: { screen: 'opportunity', id: row.id, slug: row.slug } },
        { label: 'Postuler', action: 'apply', params: { opportunityId: row.id } },
      ],
    };
  });

  return {
    type: 'opportunity_list',
    cards,
    totalCount: cards.length,
    hasMore: cards.length === limit,
    query: query,
  };
}

// ═══════════════════════════════════════════════════════════════
// SEARCH COMMUNITIES
// ═══════════════════════════════════════════════════════════════

export const searchCommunitiesSchema = z.object({
  query: z.string().optional().describe('Requête de recherche textuelle'),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional().describe('Type de communauté'),
  sectors: z.array(z.string()).optional().describe("Secteurs d'activité"),
  tags: z.array(z.string()).optional().describe('Tags/catégories'),
  location: z.string().optional().describe('Ville ou région (pour communautés offline)'),
  isPaid: z.boolean().optional().describe('Communauté payante ou gratuite'),
  limit: z.number().min(1).max(10).default(5).describe('Nombre maximum de résultats'),
});

export type SearchCommunitiesParams = z.infer<typeof searchCommunitiesSchema>;

export async function searchCommunities(
  params: SearchCommunitiesParams,
  context: { talentId: string }
): Promise<CardListOutput> {
  const { query, type, sectors, tags, location, isPaid, limit } = params;

  let sql = `
    SELECT
      c.id, c.name, c.slug, c.description, c.type, c.tags, c.sectors,
      c.is_paid, c.monthly_price, c.currency, c.city, c.region, c.country,
      c.cover_image_url, c.status, c.visibility,
      org.name as org_name, org.logo_url as org_logo,
      (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
    FROM communities c
    LEFT JOIN organizations org ON c.organization_id = org.id
    WHERE c.status = 'ACTIVE'
      AND c.deleted_at IS NULL
      AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
  `;

  const queryParams: (string | string[] | boolean)[] = [];
  let paramIndex = 1;

  if (type) {
    sql += ` AND c.type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (sectors && sectors.length > 0) {
    sql += ` AND c.sectors && $${paramIndex}::text[]`;
    queryParams.push(sectors);
    paramIndex++;
  }

  if (tags && tags.length > 0) {
    sql += ` AND c.tags && $${paramIndex}::text[]`;
    queryParams.push(tags);
    paramIndex++;
  }

  if (location) {
    sql += ` AND (c.city ILIKE '%' || $${paramIndex} || '%' OR c.region ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(location);
    paramIndex++;
  }

  if (isPaid !== undefined) {
    sql += ` AND c.is_paid = $${paramIndex}`;
    queryParams.push(isPaid);
    paramIndex++;
  }

  if (query) {
    sql += ` AND (c.name ILIKE '%' || $${paramIndex} || '%' OR c.description ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(query);
    paramIndex++;
  }

  sql += ` ORDER BY member_count DESC NULLS LAST LIMIT $${paramIndex}`;
  queryParams.push(limit.toString());

  const result = await pool.query(sql, queryParams);

  const cards: Card[] = result.rows.map((row) => {
    const locationText = [row.city, row.country].filter(Boolean).join(', ');

    return {
      id: row.id,
      type: 'community',
      title: row.name,
      subtitle: row.org_name || row.type,
      description: row.description?.slice(0, 150) || '',
      imageUrl: row.cover_image_url || row.org_logo,
      metadata: {
        type: row.type,
        memberCount: parseInt(row.member_count) || 0,
        isPaid: row.is_paid,
        price: row.is_paid ? `${row.monthly_price} ${row.currency || 'XOF'}/mois` : 'Gratuit',
        location: locationText,
        tags: row.tags,
        sectors: row.sectors,
        slug: row.slug,
      },
      actions: [
        { label: 'Voir détails', action: 'navigate', params: { screen: 'community', id: row.id, slug: row.slug } },
        { label: 'Rejoindre', action: 'join', params: { communityId: row.id } },
      ],
    };
  });

  return {
    type: 'community_list',
    cards,
    totalCount: cards.length,
    hasMore: cards.length === limit,
    query: query,
  };
}

// ═══════════════════════════════════════════════════════════════
// SEARCH SPACES
// ═══════════════════════════════════════════════════════════════

export const searchSpacesSchema = z.object({
  query: z.string().optional().describe('Requête de recherche textuelle'),
  type: z
    .enum([
      'SALLE_COURS',
      'SALLE_INFORMATIQUE',
      'AMPHITHEATRE',
      'SALLE_FORMATION',
      'OPEN_SPACE',
      'BUREAU_PRIVE',
      'POSTE_NOMADE',
      'SALLE_REUNION',
      'SALLE_CONFERENCE',
      'CABINE_APPEL',
      'ATELIER',
      'LABORATOIRE',
      'STUDIO',
      'SALLE_EVENEMENT',
      'ROOFTOP',
      'TERRASSE',
    ])
    .optional()
    .describe("Type d'espace"),
  location: z.string().optional().describe('Ville ou région'),
  minCapacity: z.number().optional().describe('Capacité minimale'),
  maxPrice: z.number().optional().describe('Prix maximum par heure'),
  date: z.string().optional().describe('Date de disponibilité (YYYY-MM-DD)'),
  limit: z.number().min(1).max(10).default(5).describe('Nombre maximum de résultats'),
});

export type SearchSpacesParams = z.infer<typeof searchSpacesSchema>;

export async function searchSpaces(
  params: SearchSpacesParams,
  context: { talentId: string }
): Promise<CardListOutput> {
  const { query, type, location, minCapacity, maxPrice, limit } = params;

  let sql = `
    SELECT
      s.id, s.name, s.slug, s.description, s.type, s.capacity,
      s.hourly_rate, s.daily_rate, s.currency, s.address, s.city, s.region, s.country,
      s.images, s.amenities, s.accessibility_features,
      s.views_count,
      org.name as org_name, org.logo_url as org_logo
    FROM spaces s
    LEFT JOIN organizations org ON s.organization_id = org.id
    WHERE s.is_active = true
      AND s.deleted_at IS NULL
      AND (s.visibility = 'PUBLIC' OR s.visibility IS NULL)
  `;

  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (type) {
    sql += ` AND s.type = $${paramIndex}`;
    queryParams.push(type);
    paramIndex++;
  }

  if (location) {
    sql += ` AND (s.city ILIKE '%' || $${paramIndex} || '%' OR s.region ILIKE '%' || $${paramIndex} || '%' OR s.address ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(location);
    paramIndex++;
  }

  if (minCapacity) {
    sql += ` AND s.capacity >= $${paramIndex}`;
    queryParams.push(minCapacity);
    paramIndex++;
  }

  if (maxPrice) {
    sql += ` AND s.hourly_rate <= $${paramIndex}`;
    queryParams.push(maxPrice);
    paramIndex++;
  }

  if (query) {
    sql += ` AND (s.name ILIKE '%' || $${paramIndex} || '%' OR s.description ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(query);
    paramIndex++;
  }

  sql += ` ORDER BY s.views_count DESC NULLS LAST LIMIT $${paramIndex}`;
  queryParams.push(limit);

  const result = await pool.query(sql, queryParams);

  const cards: Card[] = result.rows.map((row) => {
    const locationText = [row.city, row.country].filter(Boolean).join(', ');
    const primaryImage = row.images?.[0];

    return {
      id: row.id,
      type: 'space',
      title: row.name,
      subtitle: row.org_name || row.type,
      description: row.description?.slice(0, 150) || '',
      imageUrl: primaryImage || row.org_logo,
      metadata: {
        type: row.type,
        capacity: row.capacity,
        hourlyRate: row.hourly_rate ? `${row.hourly_rate} ${row.currency || 'XOF'}/h` : undefined,
        dailyRate: row.daily_rate ? `${row.daily_rate} ${row.currency || 'XOF'}/jour` : undefined,
        location: locationText,
        address: row.address,
        amenities: row.amenities,
        slug: row.slug,
      },
      actions: [
        { label: 'Voir détails', action: 'navigate', params: { screen: 'space', id: row.id, slug: row.slug } },
        { label: 'Réserver', action: 'book', params: { spaceId: row.id } },
      ],
    };
  });

  return {
    type: 'space_list',
    cards,
    totalCount: cards.length,
    hasMore: cards.length === limit,
    query: query,
  };
}

// ═══════════════════════════════════════════════════════════════
// SEARCH ORGANIZATIONS
// ═══════════════════════════════════════════════════════════════

export const searchOrganizationsSchema = z.object({
  query: z.string().optional().describe('Requête de recherche textuelle'),
  sectors: z.array(z.string()).optional().describe("Secteurs d'activité"),
  location: z.string().optional().describe('Ville ou région'),
  hasOpportunities: z.boolean().optional().describe('Uniquement celles avec des opportunités ouvertes'),
  limit: z.number().min(1).max(10).default(5).describe('Nombre maximum de résultats'),
});

export type SearchOrganizationsParams = z.infer<typeof searchOrganizationsSchema>;

export async function searchOrganizations(
  params: SearchOrganizationsParams,
  context: { talentId: string }
): Promise<CardListOutput> {
  const { query, sectors, location, hasOpportunities, limit } = params;

  let sql = `
    SELECT
      o.id, o.name, o.slug, o.description, o.sectors, o.logo_url,
      o.city, o.country, o.website,
      (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'ACTIVE') as member_count,
      (SELECT COUNT(*) FROM opportunities opp
       JOIN opportunity_posters op ON opp.id = op.opportunity_id
       WHERE op.poster_organization_id = o.id AND opp.status = 'OPEN' AND opp.deleted_at IS NULL) as open_opportunities
    FROM organizations o
    WHERE o.deleted_at IS NULL AND o.status = 'ACTIVE'
  `;

  const queryParams: (string | string[] | number)[] = [];
  let paramIndex = 1;

  if (query) {
    sql += ` AND (o.name ILIKE '%' || $${paramIndex} || '%' OR o.description ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(query);
    paramIndex++;
  }

  if (sectors && sectors.length > 0) {
    sql += ` AND o.sectors && $${paramIndex}::text[]`;
    queryParams.push(sectors);
    paramIndex++;
  }

  if (location) {
    sql += ` AND (o.city ILIKE '%' || $${paramIndex} || '%' OR o.country ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(location);
    paramIndex++;
  }

  if (hasOpportunities) {
    sql += ` AND EXISTS (
      SELECT 1 FROM opportunities opp
      JOIN opportunity_posters op ON opp.id = op.opportunity_id
      WHERE op.poster_organization_id = o.id AND opp.status = 'OPEN' AND opp.deleted_at IS NULL
    )`;
  }

  sql += ` ORDER BY open_opportunities DESC, member_count DESC LIMIT $${paramIndex}`;
  queryParams.push(limit);

  const result = await pool.query(sql, queryParams);

  const cards: Card[] = result.rows.map((row) => ({
    id: row.id,
    type: 'organization',
    title: row.name,
    subtitle: row.sectors?.slice(0, 2).join(', ') || '',
    description: row.description?.slice(0, 150) || '',
    imageUrl: row.logo_url,
    metadata: {
      sectors: row.sectors,
      location: [row.city, row.country].filter(Boolean).join(', '),
      memberCount: parseInt(row.member_count) || 0,
      openOpportunities: parseInt(row.open_opportunities) || 0,
      website: row.website,
      slug: row.slug,
    },
    actions: [
      { label: 'Voir détails', action: 'navigate', params: { screen: 'organization', id: row.id, slug: row.slug } },
    ],
  }));

  return {
    type: 'organization_list',
    cards,
    totalCount: cards.length,
    hasMore: cards.length === limit,
    query,
  };
}

// ═══════════════════════════════════════════════════════════════
// SEARCH TALENTS
// ═══════════════════════════════════════════════════════════════

export const searchTalentsSchema = z.object({
  query: z.string().optional().describe('Recherche par nom, titre ou compétences'),
  skills: z.array(z.string()).optional().describe('Compétences recherchées'),
  location: z.string().optional().describe('Ville ou région'),
  experienceLevel: z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']).optional(),
  limit: z.number().min(1).max(10).default(5),
});

export type SearchTalentsParams = z.infer<typeof searchTalentsSchema>;

export async function searchTalents(
  params: SearchTalentsParams,
  context: { talentId: string }
) {
  const { query, skills, location, experienceLevel, limit } = params;

  let sql = `
    SELECT DISTINCT
      t.id, t.display_name, t.headline, t.avatar_url, t.city, t.country,
      t.experience_level,
      (SELECT array_agg(s.canonical_name) FROM talent_skills ts
       JOIN skills s ON ts.skill_id = s.id
       WHERE ts.talent_id = t.id LIMIT 5) as top_skills
    FROM talents t
    WHERE t.deleted_at IS NULL AND t.is_public = true
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (query) {
    sql += ` AND (t.display_name ILIKE '%' || $${paramIndex} || '%' OR t.headline ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(query);
    paramIndex++;
  }

  if (skills && skills.length > 0) {
    sql += ` AND EXISTS (
      SELECT 1 FROM talent_skills ts
      JOIN skills s ON ts.skill_id = s.id
      WHERE ts.talent_id = t.id AND s.canonical_name ILIKE ANY($${paramIndex}::text[])
    )`;
    queryParams.push(skills.map((s) => `%${s}%`));
    paramIndex++;
  }

  if (location) {
    sql += ` AND (t.city ILIKE '%' || $${paramIndex} || '%' OR t.country ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(location);
    paramIndex++;
  }

  if (experienceLevel) {
    sql += ` AND t.experience_level = $${paramIndex}`;
    queryParams.push(experienceLevel);
    paramIndex++;
  }

  sql += ` ORDER BY t.display_name ASC LIMIT $${paramIndex}`;
  queryParams.push(limit);

  const result = await pool.query(sql, queryParams);

  return {
    type: 'talent_list',
    talents: result.rows.map((row) => ({
      id: row.id,
      name: row.display_name,
      headline: row.headline,
      avatarUrl: row.avatar_url,
      location: [row.city, row.country].filter(Boolean).join(', '),
      experienceLevel: row.experience_level,
      topSkills: row.top_skills || [],
    })),
    totalCount: result.rows.length,
    hasMore: result.rows.length === limit,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS FOR OPENAI AGENTS
// ═══════════════════════════════════════════════════════════════

export const searchToolDefinitions = {
  search_opportunities: {
    name: 'search_opportunities',
    description:
      "Recherche des opportunités professionnelles (emplois, stages, freelance, etc.) selon les critères spécifiés. Utilise cette fonction quand l'utilisateur cherche du travail, un stage, ou une mission.",
    parameters: searchOpportunitiesSchema,
    execute: searchOpportunities,
  },
  search_communities: {
    name: 'search_communities',
    description:
      "Recherche des communautés professionnelles ou d'apprentissage. Utilise cette fonction quand l'utilisateur veut rejoindre un groupe, un réseau, ou une communauté.",
    parameters: searchCommunitiesSchema,
    execute: searchCommunities,
  },
  search_spaces: {
    name: 'search_spaces',
    description:
      "Recherche des espaces de travail, salles de réunion, ou lieux de formation à réserver. Utilise cette fonction quand l'utilisateur cherche un endroit pour travailler ou organiser un événement.",
    parameters: searchSpacesSchema,
    execute: searchSpaces,
  },
  search_organizations: {
    name: 'search_organizations',
    description:
      "Recherche des organisations, entreprises et hubs. Utilise cette fonction quand l'utilisateur cherche une entreprise, un hub ou une organisation.",
    parameters: searchOrganizationsSchema,
    execute: searchOrganizations,
  },
  search_talents: {
    name: 'search_talents',
    description:
      "Recherche des talents (professionnels) par nom, compétences, localisation ou niveau d'expérience. Réservé aux recruteurs et admins.",
    parameters: searchTalentsSchema,
    execute: searchTalents,
  },
};
