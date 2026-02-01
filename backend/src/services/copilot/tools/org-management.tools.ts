/**
 * Organization Management Tools for Copilot
 * CRUD tools for communities, spaces, opportunities (organization side)
 */

import { z } from 'zod';
import { pool } from '../../database';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function checkOrgPermission(talentId: string, organizationId?: string, requiredRole = 'ADMIN') {
  const roles = requiredRole === 'RECRUITER'
    ? "('ADMIN', 'OWNER', 'RECRUITER')"
    : "('ADMIN', 'OWNER')";

  const result = await pool.query(
    `SELECT om.organization_id, o.name as org_name
     FROM organization_members om
     JOIN organizations o ON om.organization_id = o.id
     WHERE om.talent_id = $1 AND om.status = 'ACTIVE' AND om.role IN ${roles}
     ${organizationId ? 'AND om.organization_id = $2' : ''}
     LIMIT 1`,
    organizationId ? [talentId, organizationId] : [talentId]
  );

  if (result.rows.length === 0) throw new Error('Permission refusée');
  return result.rows[0];
}

// ═══════════════════════════════════════════════════════════════
// CREATE COMMUNITY
// ═══════════════════════════════════════════════════════════════

export const createCommunitySchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(3).max(100).describe('Nom de la communauté'),
  description: z.string().max(2000).describe('Description'),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).default('ONLINE'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  isPaid: z.boolean().default(false),
  monthlyPrice: z.number().optional().describe('Prix mensuel (si payante)'),
  tags: z.array(z.string()).max(10).optional(),
  sectors: z.array(z.string()).max(5).optional(),
});

export async function createCommunity(
  params: z.infer<typeof createCommunitySchema>,
  context: { talentId: string }
) {
  const perm = await checkOrgPermission(context.talentId, params.organizationId);
  const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const result = await pool.query(
    `INSERT INTO communities (organization_id, name, slug, description, type, visibility, is_paid, monthly_price, currency, tags, sectors, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'XOF', $9, $10, 'ACTIVE')
     RETURNING id, name`,
    [
      perm.organization_id, params.name, slug, params.description,
      params.type, params.visibility, params.isPaid,
      params.isPaid ? params.monthlyPrice || 0 : 0,
      params.tags || [], params.sectors || [],
    ]
  );

  return {
    type: 'confirmation',
    title: 'Communauté créée',
    message: `La communauté "${result.rows[0].name}" a été créée avec succès.`,
    actionParams: { communityId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// EDIT COMMUNITY
// ═══════════════════════════════════════════════════════════════

export const editCommunitySchema = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export async function editCommunity(
  params: z.infer<typeof editCommunitySchema>,
  context: { talentId: string }
) {
  // Verify community belongs to user's org
  const com = await pool.query(
    `SELECT c.organization_id FROM communities c WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [params.communityId]
  );
  if (com.rows.length === 0) throw new Error('Communauté non trouvée');

  await checkOrgPermission(context.talentId, com.rows[0].organization_id);

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.name) { updates.push(`name = $${idx}`); values.push(params.name); idx++; }
  if (params.description) { updates.push(`description = $${idx}`); values.push(params.description); idx++; }
  if (params.type) { updates.push(`type = $${idx}`); values.push(params.type); idx++; }
  if (params.visibility) { updates.push(`visibility = $${idx}`); values.push(params.visibility); idx++; }
  if (params.tags) { updates.push(`tags = $${idx}`); values.push(params.tags); idx++; }

  if (updates.length === 0) throw new Error('Aucune modification spécifiée');

  updates.push(`updated_at = NOW()`);
  values.push(params.communityId);

  await pool.query(
    `UPDATE communities SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );

  return {
    type: 'confirmation',
    title: 'Communauté modifiée',
    message: 'La communauté a été mise à jour avec succès.',
  };
}

// ═══════════════════════════════════════════════════════════════
// CREATE SPACE
// ═══════════════════════════════════════════════════════════════

export const createSpaceSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(3).max(100).describe("Nom de l'espace"),
  description: z.string().max(2000).optional(),
  type: z.enum([
    'SALLE_COURS', 'SALLE_INFORMATIQUE', 'AMPHITHEATRE', 'SALLE_FORMATION',
    'OPEN_SPACE', 'BUREAU_PRIVE', 'POSTE_NOMADE', 'SALLE_REUNION',
    'SALLE_CONFERENCE', 'CABINE_APPEL', 'ATELIER', 'LABORATOIRE',
    'STUDIO', 'SALLE_EVENEMENT', 'ROOFTOP', 'TERRASSE',
  ]).describe("Type d'espace"),
  capacity: z.number().min(1).describe('Capacité'),
  hourlyRate: z.number().min(0).optional().describe('Tarif horaire'),
  dailyRate: z.number().min(0).optional().describe('Tarif journalier'),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  amenities: z.array(z.string()).max(20).optional(),
});

export async function createSpace(
  params: z.infer<typeof createSpaceSchema>,
  context: { talentId: string }
) {
  const perm = await checkOrgPermission(context.talentId, params.organizationId);
  const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const result = await pool.query(
    `INSERT INTO spaces (organization_id, name, slug, description, type, capacity, hourly_rate, daily_rate, currency, address, city, amenities, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'XOF', $9, $10, $11, true)
     RETURNING id, name`,
    [
      perm.organization_id, params.name, slug, params.description || null,
      params.type, params.capacity,
      params.hourlyRate || 0, params.dailyRate || 0,
      params.address || null, params.city || null,
      params.amenities || [],
    ]
  );

  return {
    type: 'confirmation',
    title: 'Espace créé',
    message: `L'espace "${result.rows[0].name}" a été créé avec succès.`,
    actionParams: { spaceId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// EDIT SPACE
// ═══════════════════════════════════════════════════════════════

export const editSpaceSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  capacity: z.number().min(1).optional(),
  hourlyRate: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function editSpace(
  params: z.infer<typeof editSpaceSchema>,
  context: { talentId: string }
) {
  const sp = await pool.query(
    `SELECT organization_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
    [params.spaceId]
  );
  if (sp.rows.length === 0) throw new Error('Espace non trouvé');

  await checkOrgPermission(context.talentId, sp.rows[0].organization_id);

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.name) { updates.push(`name = $${idx}`); values.push(params.name); idx++; }
  if (params.description !== undefined) { updates.push(`description = $${idx}`); values.push(params.description); idx++; }
  if (params.capacity) { updates.push(`capacity = $${idx}`); values.push(params.capacity); idx++; }
  if (params.hourlyRate !== undefined) { updates.push(`hourly_rate = $${idx}`); values.push(params.hourlyRate); idx++; }
  if (params.dailyRate !== undefined) { updates.push(`daily_rate = $${idx}`); values.push(params.dailyRate); idx++; }
  if (params.isActive !== undefined) { updates.push(`is_active = $${idx}`); values.push(params.isActive); idx++; }

  if (updates.length === 0) throw new Error('Aucune modification spécifiée');

  updates.push(`updated_at = NOW()`);
  values.push(params.spaceId);

  await pool.query(`UPDATE spaces SET ${updates.join(', ')} WHERE id = $${idx}`, values);

  return {
    type: 'confirmation',
    title: 'Espace modifié',
    message: "L'espace a été mis à jour avec succès.",
  };
}

// ═══════════════════════════════════════════════════════════════
// CREATE OPPORTUNITY
// ═══════════════════════════════════════════════════════════════

export const createOpportunitySchema = z.object({
  organizationId: z.string().uuid().optional(),
  title: z.string().min(5).max(200).describe("Titre de l'opportunité"),
  summary: z.string().max(500).optional().describe('Résumé court'),
  description: z.string().max(10000).describe('Description détaillée'),
  type: z.enum(['EMPLOYMENT', 'INTERNSHIP', 'ENTREPRENEURSHIP', 'ALTERNATION', 'FREELANCE', 'VOLUNTEER']),
  contractType: z.enum(['CDI', 'CDD', 'APPRENTICESHIP', 'INTERNSHIP', 'FREELANCE', 'SERVICE', 'INTERIM']).optional(),
  locationType: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).default('REMOTE'),
  locations: z.array(z.object({
    city: z.string(),
    country: z.string().default('Côte d\'Ivoire'),
  })).optional(),
  compensationMin: z.number().optional(),
  compensationMax: z.number().optional(),
  currency: z.string().default('XOF'),
  deadline: z.string().optional().describe('Date limite (ISO 8601)'),
  requiredSkills: z.array(z.string()).max(15).optional(),
  status: z.enum(['DRAFT', 'OPEN']).default('OPEN'),
});

export async function createOpportunity(
  params: z.infer<typeof createOpportunitySchema>,
  context: { talentId: string }
) {
  const perm = await checkOrgPermission(context.talentId, params.organizationId, 'RECRUITER');
  const slug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);

  const result = await pool.query(
    `INSERT INTO opportunities
     (title, slug, summary, description, type, contract_type, location_type, locations, compensation_min, compensation_max, currency, deadline, required_skills, status, posted_at, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, ${params.status === 'OPEN' ? 'NOW()' : 'NULL'}, 'PUBLIC')
     RETURNING id`,
    [
      params.title, slug, params.summary || null, params.description,
      params.type, params.contractType || null, params.locationType,
      JSON.stringify(params.locations || []),
      params.compensationMin || null, params.compensationMax || null,
      params.currency, params.deadline || null,
      params.requiredSkills || [], params.status,
    ]
  );

  // Link to organization
  await pool.query(
    `INSERT INTO opportunity_posters (opportunity_id, poster_organization_id, poster_talent_id)
     VALUES ($1, $2, $3)`,
    [result.rows[0].id, perm.organization_id, context.talentId]
  );

  return {
    type: 'confirmation',
    title: 'Opportunité créée',
    message: `L'opportunité "${params.title}" a été créée${params.status === 'OPEN' ? ' et publiée' : ' en brouillon'}.`,
    actionParams: { opportunityId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// EDIT OPPORTUNITY
// ═══════════════════════════════════════════════════════════════

export const editOpportunitySchema = z.object({
  opportunityId: z.string().uuid(),
  title: z.string().min(5).max(200).optional(),
  summary: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'PAUSED']).optional(),
  deadline: z.string().optional(),
  compensationMin: z.number().optional(),
  compensationMax: z.number().optional(),
});

export async function editOpportunity(
  params: z.infer<typeof editOpportunitySchema>,
  context: { talentId: string }
) {
  // Check ownership
  const opp = await pool.query(
    `SELECT op.poster_organization_id FROM opportunity_posters op WHERE op.opportunity_id = $1`,
    [params.opportunityId]
  );
  if (opp.rows.length === 0) throw new Error('Opportunité non trouvée');

  await checkOrgPermission(context.talentId, opp.rows[0].poster_organization_id, 'RECRUITER');

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.title) { updates.push(`title = $${idx}`); values.push(params.title); idx++; }
  if (params.summary !== undefined) { updates.push(`summary = $${idx}`); values.push(params.summary); idx++; }
  if (params.description) { updates.push(`description = $${idx}`); values.push(params.description); idx++; }
  if (params.status) {
    updates.push(`status = $${idx}`); values.push(params.status); idx++;
    if (params.status === 'OPEN') { updates.push(`posted_at = COALESCE(posted_at, NOW())`); }
  }
  if (params.deadline !== undefined) { updates.push(`deadline = $${idx}`); values.push(params.deadline); idx++; }
  if (params.compensationMin !== undefined) { updates.push(`compensation_min = $${idx}`); values.push(params.compensationMin); idx++; }
  if (params.compensationMax !== undefined) { updates.push(`compensation_max = $${idx}`); values.push(params.compensationMax); idx++; }

  if (updates.length === 0) throw new Error('Aucune modification spécifiée');

  updates.push(`updated_at = NOW()`);
  values.push(params.opportunityId);

  await pool.query(`UPDATE opportunities SET ${updates.join(', ')} WHERE id = $${idx}`, values);

  return {
    type: 'confirmation',
    title: 'Opportunité modifiée',
    message: "L'opportunité a été mise à jour avec succès.",
  };
}

// ═══════════════════════════════════════════════════════════════
// REVENUE TRACKING
// ═══════════════════════════════════════════════════════════════

export const getOrgRevenueSchema = z.object({
  organizationId: z.string().uuid().optional(),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
});

export async function getOrgRevenue(
  params: z.infer<typeof getOrgRevenueSchema>,
  context: { talentId: string }
) {
  const perm = await checkOrgPermission(context.talentId, params.organizationId);
  const orgId = perm.organization_id;

  const intervalMap: Record<string, string> = {
    week: '7 days',
    month: '30 days',
    quarter: '90 days',
    year: '365 days',
  };
  const interval = intervalMap[params.period];

  // Booking revenue
  const bookingRevenue = await pool.query(
    `SELECT COALESCE(SUM(b.total_price), 0) as total,
            COUNT(*) as count
     FROM bookings b
     JOIN spaces s ON b.space_id = s.id
     WHERE s.organization_id = $1
     AND b.status IN ('CONFIRMED', 'COMPLETED')
     AND b.created_at >= NOW() - INTERVAL '${interval}'`,
    [orgId]
  );

  // Community subscription revenue
  const subRevenue = await pool.query(
    `SELECT COALESCE(SUM(c.monthly_price), 0) as monthly_total,
            COUNT(DISTINCT cm.talent_id) as paying_members
     FROM communities c
     JOIN community_members cm ON c.id = cm.community_id
     WHERE c.organization_id = $1 AND c.is_paid = true
     AND cm.status = 'ACTIVE'`,
    [orgId]
  );

  const bookings = bookingRevenue.rows[0];
  const subs = subRevenue.rows[0];

  return {
    type: 'org_revenue',
    organizationName: perm.org_name,
    period: params.period,
    revenue: {
      bookings: {
        total: parseInt(bookings.total) || 0,
        count: parseInt(bookings.count) || 0,
      },
      subscriptions: {
        monthlyTotal: parseInt(subs.monthly_total) || 0,
        payingMembers: parseInt(subs.paying_members) || 0,
      },
      grandTotal: (parseInt(bookings.total) || 0) + (parseInt(subs.monthly_total) || 0),
      currency: 'XOF',
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const orgManagementToolDefinitions = {
  create_community: {
    name: 'create_community',
    description:
      "Crée une nouvelle communauté pour l'organisation. Réservé aux admins/propriétaires.",
    parameters: createCommunitySchema,
    execute: createCommunity,
  },
  edit_community: {
    name: 'edit_community',
    description:
      "Modifie les informations d'une communauté. Réservé aux admins.",
    parameters: editCommunitySchema,
    execute: editCommunity,
  },
  create_space: {
    name: 'create_space',
    description:
      "Crée un nouvel espace de travail pour l'organisation. Réservé aux admins.",
    parameters: createSpaceSchema,
    execute: createSpace,
  },
  edit_space: {
    name: 'edit_space',
    description:
      "Modifie les informations d'un espace. Réservé aux admins.",
    parameters: editSpaceSchema,
    execute: editSpace,
  },
  create_opportunity: {
    name: 'create_opportunity',
    description:
      "Crée une nouvelle opportunité professionnelle pour l'organisation. Réservé aux admins/recruteurs.",
    parameters: createOpportunitySchema,
    execute: createOpportunity,
  },
  edit_opportunity: {
    name: 'edit_opportunity',
    description:
      "Modifie une opportunité existante. Réservé aux admins/recruteurs.",
    parameters: editOpportunitySchema,
    execute: editOpportunity,
  },
  get_org_revenue: {
    name: 'get_org_revenue',
    description:
      "Récupère les statistiques de revenus de l'organisation (réservations et abonnements). Réservé aux admins.",
    parameters: getOrgRevenueSchema,
    execute: getOrgRevenue,
  },
};
