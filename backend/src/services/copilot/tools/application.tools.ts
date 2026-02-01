/**
 * Application Tools for Copilot
 * Tools for managing applications, membership requests, and reservations
 */

import { z } from 'zod';
import { pool } from '../../database';

// ═══════════════════════════════════════════════════════════════
// LIST MY APPLICATIONS (Talent)
// ═══════════════════════════════════════════════════════════════

export const listMyApplicationsSchema = z.object({
  status: z
    .enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
    .optional()
    .describe('Filtrer par statut'),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listMyApplications(
  params: z.infer<typeof listMyApplicationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { status, limit, offset } = params;

  let sql = `
    SELECT a.id, a.status, a.cover_letter, a.created_at, a.updated_at,
           o.id as opp_id, o.title as opp_title, o.type as opp_type,
           org.name as org_name, org.logo_url as org_logo
    FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE a.talent_id = $1 AND a.deleted_at IS NULL
  `;
  const queryParams: any[] = [talentId];
  let paramIndex = 2;

  if (status) {
    sql += ` AND a.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  sql += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM applications WHERE talent_id = $1 AND deleted_at IS NULL ${status ? `AND status = '${status}'` : ''}`,
    [talentId]
  );

  return {
    type: 'application_list',
    applications: result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      opportunityId: r.opp_id,
      opportunityTitle: r.opp_title,
      opportunityType: r.opp_type,
      orgName: r.org_name,
      orgLogo: r.org_logo,
      coverLetter: r.cover_letter?.slice(0, 100),
      createdAt: r.created_at?.toISOString(),
      updatedAt: r.updated_at?.toISOString(),
    })),
    totalCount: parseInt(countResult.rows[0].count) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// APPLY TO OPPORTUNITY (Talent)
// ═══════════════════════════════════════════════════════════════

export const applyToOpportunitySchema = z.object({
  opportunityId: z.string().uuid().describe("ID de l'opportunité"),
  coverLetter: z.string().max(2000).optional().describe('Lettre de motivation'),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
      })
    )
    .optional()
    .describe('Réponses aux questions de candidature'),
});

export async function applyToOpportunity(
  params: z.infer<typeof applyToOpportunitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { opportunityId, coverLetter, answers } = params;

  // Check opportunity exists and is open
  const opp = await pool.query(
    `SELECT id, title, status FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (opp.rows.length === 0) throw new Error('Opportunité non trouvée');
  if (opp.rows[0].status !== 'OPEN') throw new Error("Cette opportunité n'accepte plus de candidatures");

  // Check not already applied
  const existing = await pool.query(
    `SELECT id FROM applications WHERE talent_id = $1 AND opportunity_id = $2 AND deleted_at IS NULL AND status != 'WITHDRAWN'`,
    [talentId, opportunityId]
  );

  if (existing.rows.length > 0) throw new Error('Vous avez déjà postulé à cette opportunité');

  const result = await pool.query(
    `INSERT INTO applications (talent_id, opportunity_id, cover_letter, answers, status, created_at)
     VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW())
     RETURNING id, status`,
    [talentId, opportunityId, coverLetter || null, answers ? JSON.stringify(answers) : null]
  );

  return {
    type: 'confirmation',
    title: 'Candidature envoyée',
    message: `Votre candidature pour "${opp.rows[0].title}" a été envoyée avec succès.`,
    actionType: 'apply',
    actionParams: { applicationId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// WITHDRAW APPLICATION (Talent)
// ═══════════════════════════════════════════════════════════════

export const withdrawApplicationSchema = z.object({
  applicationId: z.string().uuid().describe('ID de la candidature'),
});

export async function withdrawApplication(
  params: z.infer<typeof withdrawApplicationSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;

  const result = await pool.query(
    `UPDATE applications SET status = 'WITHDRAWN', updated_at = NOW()
     WHERE id = $1 AND talent_id = $2 AND status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW')
     RETURNING id`,
    [params.applicationId, talentId]
  );

  if (result.rows.length === 0) throw new Error('Candidature non trouvée ou ne peut pas être retirée');

  return {
    type: 'confirmation',
    title: 'Candidature retirée',
    message: 'Votre candidature a été retirée avec succès.',
  };
}

// ═══════════════════════════════════════════════════════════════
// JOIN COMMUNITY (Talent)
// ═══════════════════════════════════════════════════════════════

export const joinCommunitySchema = z.object({
  communityId: z.string().uuid().describe('ID de la communauté'),
  message: z.string().max(500).optional().describe("Message de demande d'adhésion"),
});

export async function joinCommunity(
  params: z.infer<typeof joinCommunitySchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { communityId, message } = params;

  // Check community exists
  const com = await pool.query(
    `SELECT id, name, visibility, is_paid FROM communities WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`,
    [communityId]
  );

  if (com.rows.length === 0) throw new Error('Communauté non trouvée');

  // Check not already member
  const existing = await pool.query(
    `SELECT id, status FROM community_members WHERE community_id = $1 AND talent_id = $2`,
    [communityId, talentId]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === 'ACTIVE') {
    throw new Error('Vous êtes déjà membre de cette communauté');
  }

  const community = com.rows[0];
  const needsApproval = community.visibility === 'PRIVATE';
  const status = needsApproval ? 'PENDING' : 'ACTIVE';

  await pool.query(
    `INSERT INTO community_members (community_id, talent_id, role, status, request_message, joined_at)
     VALUES ($1, $2, 'MEMBER', $3, $4, ${needsApproval ? 'NULL' : 'NOW()'})
     ON CONFLICT (community_id, talent_id) DO UPDATE SET status = $3, request_message = $4, updated_at = NOW()`,
    [communityId, talentId, status, message || null]
  );

  return {
    type: 'confirmation',
    title: needsApproval ? "Demande d'adhésion envoyée" : 'Communauté rejointe',
    message: needsApproval
      ? `Votre demande d'adhésion à "${community.name}" a été envoyée. Un administrateur doit l'approuver.`
      : `Vous avez rejoint la communauté "${community.name}" avec succès.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// LIST MY RESERVATIONS (Talent)
// ═══════════════════════════════════════════════════════════════

export const listMyReservationsSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
    .optional(),
  upcoming: z.boolean().default(true).describe('Afficher uniquement les réservations à venir'),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listMyReservations(
  params: z.infer<typeof listMyReservationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { status, upcoming, limit, offset } = params;

  let sql = `
    SELECT b.id, b.status, b.start_time, b.end_time, b.total_price, b.currency,
           b.notes, b.created_at,
           s.id as space_id, s.name as space_name, s.type as space_type,
           s.city, s.address,
           org.name as org_name
    FROM bookings b
    JOIN spaces s ON b.space_id = s.id
    LEFT JOIN organizations org ON s.organization_id = org.id
    WHERE b.talent_id = $1 AND b.deleted_at IS NULL
  `;
  const queryParams: any[] = [talentId];
  let paramIndex = 2;

  if (status) {
    sql += ` AND b.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  if (upcoming) {
    sql += ` AND b.start_time >= NOW()`;
  }

  sql += ` ORDER BY b.start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  return {
    type: 'reservation_list',
    reservations: result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      spaceId: r.space_id,
      spaceName: r.space_name,
      spaceType: r.space_type,
      location: [r.address, r.city].filter(Boolean).join(', '),
      orgName: r.org_name,
      startTime: r.start_time?.toISOString(),
      endTime: r.end_time?.toISOString(),
      totalPrice: r.total_price ? `${r.total_price} ${r.currency || 'XOF'}` : 'Gratuit',
      notes: r.notes,
      createdAt: r.created_at?.toISOString(),
    })),
    totalCount: result.rows.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// BOOK SPACE (Talent)
// ═══════════════════════════════════════════════════════════════

export const bookSpaceSchema = z.object({
  spaceId: z.string().uuid().describe("ID de l'espace"),
  startTime: z.string().describe('Date/heure de début (ISO 8601)'),
  endTime: z.string().describe('Date/heure de fin (ISO 8601)'),
  notes: z.string().max(500).optional().describe('Notes pour la réservation'),
});

export async function bookSpace(
  params: z.infer<typeof bookSpaceSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { spaceId, startTime, endTime, notes } = params;

  // Check space exists
  const space = await pool.query(
    `SELECT id, name, hourly_rate, currency, is_active FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
    [spaceId]
  );

  if (space.rows.length === 0) throw new Error('Espace non trouvé');
  if (!space.rows[0].is_active) throw new Error("Cet espace n'est plus disponible");

  // Check availability (no overlapping bookings)
  const overlap = await pool.query(
    `SELECT id FROM bookings
     WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
     AND start_time < $3 AND end_time > $2`,
    [spaceId, startTime, endTime]
  );

  if (overlap.rows.length > 0) throw new Error("L'espace n'est pas disponible sur ce créneau");

  // Calculate price
  const hours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
  const totalPrice = space.rows[0].hourly_rate ? Math.ceil(hours * space.rows[0].hourly_rate) : 0;

  const result = await pool.query(
    `INSERT INTO bookings (space_id, talent_id, start_time, end_time, total_price, currency, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
     RETURNING id`,
    [spaceId, talentId, startTime, endTime, totalPrice, space.rows[0].currency || 'XOF', notes || null]
  );

  return {
    type: 'confirmation',
    title: 'Réservation créée',
    message: `Réservation pour "${space.rows[0].name}" créée. ${totalPrice > 0 ? `Montant: ${totalPrice} ${space.rows[0].currency || 'XOF'}` : 'Gratuit'}`,
    actionType: 'reserve',
    actionParams: { bookingId: result.rows[0].id },
  };
}

// ═══════════════════════════════════════════════════════════════
// MANAGE ORG APPLICATIONS (Organization)
// ═══════════════════════════════════════════════════════════════

export const listOrgApplicationsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional().describe("Filtrer par opportunité"),
  status: z
    .enum(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'ACCEPTED', 'REJECTED'])
    .optional(),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listOrgApplications(
  params: z.infer<typeof listOrgApplicationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { organizationId, opportunityId, status, limit, offset } = params;

  // Check admin permissions
  const perm = await pool.query(
    `SELECT om.organization_id FROM organization_members om
     WHERE om.talent_id = $1 AND om.status = 'ACTIVE' AND om.role IN ('ADMIN', 'OWNER', 'RECRUITER')
     ${organizationId ? 'AND om.organization_id = $2' : ''}
     LIMIT 1`,
    organizationId ? [talentId, organizationId] : [talentId]
  );

  if (perm.rows.length === 0) throw new Error('Permission refusée');
  const orgId = perm.rows[0].organization_id;

  let sql = `
    SELECT a.id, a.status, a.cover_letter, a.created_at,
           t.display_name as talent_name, t.email as talent_email, t.avatar_url,
           o.id as opp_id, o.title as opp_title
    FROM applications a
    JOIN talents t ON a.talent_id = t.id
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN opportunity_posters op ON o.id = op.opportunity_id
    WHERE op.poster_organization_id = $1 AND a.deleted_at IS NULL
  `;
  const queryParams: any[] = [orgId];
  let paramIndex = 2;

  if (opportunityId) {
    sql += ` AND a.opportunity_id = $${paramIndex}`;
    queryParams.push(opportunityId);
    paramIndex++;
  }

  if (status) {
    sql += ` AND a.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  sql += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  return {
    type: 'application_list',
    applications: result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      talentName: r.talent_name,
      talentEmail: r.talent_email,
      avatarUrl: r.avatar_url,
      opportunityId: r.opp_id,
      opportunityTitle: r.opp_title,
      coverLetter: r.cover_letter?.slice(0, 200),
      createdAt: r.created_at?.toISOString(),
    })),
    totalCount: result.rows.length,
  };
}

export const updateApplicationStatusSchema = z.object({
  applicationId: z.string().uuid(),
  newStatus: z.enum(['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'ACCEPTED', 'REJECTED']),
  message: z.string().max(500).optional().describe('Message au candidat'),
});

export async function updateApplicationStatus(
  params: z.infer<typeof updateApplicationStatusSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { applicationId, newStatus, message } = params;

  // Verify permission: application belongs to an org where user is admin
  const check = await pool.query(
    `SELECT a.id, o.title as opp_title, t.display_name as talent_name
     FROM applications a
     JOIN opportunities o ON a.opportunity_id = o.id
     JOIN opportunity_posters op ON o.id = op.opportunity_id
     JOIN organization_members om ON op.poster_organization_id = om.organization_id
     JOIN talents t ON a.talent_id = t.id
     WHERE a.id = $1 AND om.talent_id = $2 AND om.status = 'ACTIVE'
     AND om.role IN ('ADMIN', 'OWNER', 'RECRUITER')`,
    [applicationId, talentId]
  );

  if (check.rows.length === 0) throw new Error('Candidature non trouvée ou permission refusée');

  await pool.query(
    `UPDATE applications SET status = $1, reviewer_notes = $2, updated_at = NOW()
     WHERE id = $3`,
    [newStatus, message || null, applicationId]
  );

  const statusLabels: Record<string, string> = {
    UNDER_REVIEW: 'en cours de revue',
    SHORTLISTED: 'présélectionnée',
    INTERVIEW: 'en entretien',
    ACCEPTED: 'acceptée',
    REJECTED: 'rejetée',
  };

  return {
    type: 'confirmation',
    title: 'Statut mis à jour',
    message: `La candidature de ${check.rows[0].talent_name} pour "${check.rows[0].opp_title}" est maintenant ${statusLabels[newStatus] || newStatus}.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// MANAGE MEMBERSHIP REQUESTS (Organization)
// ═══════════════════════════════════════════════════════════════

export const listMembershipRequestsSchema = z.object({
  communityId: z.string().uuid().describe('ID de la communauté'),
  limit: z.number().min(1).max(20).default(10),
});

export async function listMembershipRequests(
  params: z.infer<typeof listMembershipRequestsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { communityId, limit } = params;

  // Check admin of this community's org
  const perm = await pool.query(
    `SELECT c.name as community_name FROM communities c
     JOIN organizations org ON c.organization_id = org.id
     JOIN organization_members om ON org.id = om.organization_id
     WHERE c.id = $1 AND om.talent_id = $2 AND om.status = 'ACTIVE'
     AND om.role IN ('ADMIN', 'OWNER')`,
    [communityId, talentId]
  );

  if (perm.rows.length === 0) throw new Error('Permission refusée');

  const result = await pool.query(
    `SELECT cm.id, cm.request_message, cm.created_at,
            t.display_name as talent_name, t.email, t.avatar_url
     FROM community_members cm
     JOIN talents t ON cm.talent_id = t.id
     WHERE cm.community_id = $1 AND cm.status = 'PENDING'
     ORDER BY cm.created_at DESC LIMIT $2`,
    [communityId, limit]
  );

  return {
    type: 'membership_request_list',
    communityName: perm.rows[0].community_name,
    requests: result.rows.map((r) => ({
      id: r.id,
      talentName: r.talent_name,
      email: r.email,
      avatarUrl: r.avatar_url,
      message: r.request_message,
      createdAt: r.created_at?.toISOString(),
    })),
    totalCount: result.rows.length,
  };
}

export const respondToMembershipSchema = z.object({
  membershipId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export async function respondToMembership(
  params: z.infer<typeof respondToMembershipSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { membershipId, action } = params;

  // Verify permission
  const check = await pool.query(
    `SELECT cm.id, t.display_name as talent_name, c.name as community_name
     FROM community_members cm
     JOIN communities c ON cm.community_id = c.id
     JOIN organizations org ON c.organization_id = org.id
     JOIN organization_members om ON org.id = om.organization_id
     JOIN talents t ON cm.talent_id = t.id
     WHERE cm.id = $1 AND om.talent_id = $2 AND om.status = 'ACTIVE'
     AND om.role IN ('ADMIN', 'OWNER') AND cm.status = 'PENDING'`,
    [membershipId, talentId]
  );

  if (check.rows.length === 0) throw new Error('Demande non trouvée ou permission refusée');

  const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';

  await pool.query(
    `UPDATE community_members SET status = $1, ${action === 'approve' ? 'joined_at = NOW(),' : ''} updated_at = NOW()
     WHERE id = $2`,
    [newStatus, membershipId]
  );

  return {
    type: 'confirmation',
    title: action === 'approve' ? 'Membre accepté' : 'Demande rejetée',
    message: `${check.rows[0].talent_name} a été ${action === 'approve' ? 'accepté dans' : 'rejeté de'} "${check.rows[0].community_name}".`,
  };
}

// ═══════════════════════════════════════════════════════════════
// MANAGE ORG RESERVATIONS (Organization)
// ═══════════════════════════════════════════════════════════════

export const listOrgReservationsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
  limit: z.number().min(1).max(20).default(10),
});

export async function listOrgReservations(
  params: z.infer<typeof listOrgReservationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { organizationId, spaceId, status, limit } = params;

  const perm = await pool.query(
    `SELECT om.organization_id FROM organization_members om
     WHERE om.talent_id = $1 AND om.status = 'ACTIVE' AND om.role IN ('ADMIN', 'OWNER')
     ${organizationId ? 'AND om.organization_id = $2' : ''}
     LIMIT 1`,
    organizationId ? [talentId, organizationId] : [talentId]
  );

  if (perm.rows.length === 0) throw new Error('Permission refusée');
  const orgId = perm.rows[0].organization_id;

  let sql = `
    SELECT b.id, b.status, b.start_time, b.end_time, b.total_price, b.currency,
           s.name as space_name, t.display_name as talent_name, t.email
    FROM bookings b
    JOIN spaces s ON b.space_id = s.id
    JOIN talents t ON b.talent_id = t.id
    WHERE s.organization_id = $1 AND b.deleted_at IS NULL
  `;
  const queryParams: any[] = [orgId];
  let paramIndex = 2;

  if (spaceId) {
    sql += ` AND b.space_id = $${paramIndex}`;
    queryParams.push(spaceId);
    paramIndex++;
  }

  if (status) {
    sql += ` AND b.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  sql += ` ORDER BY b.start_time DESC LIMIT $${paramIndex}`;
  queryParams.push(limit);

  const result = await pool.query(sql, queryParams);

  return {
    type: 'reservation_list',
    reservations: result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      spaceName: r.space_name,
      talentName: r.talent_name,
      talentEmail: r.email,
      startTime: r.start_time?.toISOString(),
      endTime: r.end_time?.toISOString(),
      totalPrice: r.total_price ? `${r.total_price} ${r.currency || 'XOF'}` : 'Gratuit',
    })),
    totalCount: result.rows.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const applicationToolDefinitions = {
  list_my_applications: {
    name: 'list_my_applications',
    description:
      "Liste les candidatures du talent. Utilise quand l'utilisateur demande l'état de ses candidatures.",
    parameters: listMyApplicationsSchema,
    execute: listMyApplications,
  },
  apply_to_opportunity: {
    name: 'apply_to_opportunity',
    description:
      "Postule à une opportunité pour le talent. Demande TOUJOURS confirmation et une lettre de motivation si pertinent.",
    parameters: applyToOpportunitySchema,
    execute: applyToOpportunity,
  },
  withdraw_application: {
    name: 'withdraw_application',
    description:
      "Retire une candidature. Demande TOUJOURS confirmation avant d'exécuter.",
    parameters: withdrawApplicationSchema,
    execute: withdrawApplication,
  },
  join_community: {
    name: 'join_community',
    description:
      "Rejoint une communauté ou envoie une demande d'adhésion si privée.",
    parameters: joinCommunitySchema,
    execute: joinCommunity,
  },
  list_my_reservations: {
    name: 'list_my_reservations',
    description:
      "Liste les réservations d'espaces du talent.",
    parameters: listMyReservationsSchema,
    execute: listMyReservations,
  },
  book_space: {
    name: 'book_space',
    description:
      "Réserve un espace de travail. Vérifie la disponibilité et calcule le prix automatiquement.",
    parameters: bookSpaceSchema,
    execute: bookSpace,
  },
  list_org_applications: {
    name: 'list_org_applications',
    description:
      "Liste les candidatures reçues par l'organisation. Réservé aux admins/recruteurs.",
    parameters: listOrgApplicationsSchema,
    execute: listOrgApplications,
  },
  update_application_status: {
    name: 'update_application_status',
    description:
      "Met à jour le statut d'une candidature (accepter, rejeter, présélectionner, etc.). Réservé aux admins/recruteurs.",
    parameters: updateApplicationStatusSchema,
    execute: updateApplicationStatus,
  },
  list_membership_requests: {
    name: 'list_membership_requests',
    description:
      "Liste les demandes d'adhésion en attente pour une communauté. Réservé aux admins.",
    parameters: listMembershipRequestsSchema,
    execute: listMembershipRequests,
  },
  respond_to_membership: {
    name: 'respond_to_membership',
    description:
      "Accepte ou rejette une demande d'adhésion. Réservé aux admins.",
    parameters: respondToMembershipSchema,
    execute: respondToMembership,
  },
  list_org_reservations: {
    name: 'list_org_reservations',
    description:
      "Liste les réservations d'espaces de l'organisation. Réservé aux admins.",
    parameters: listOrgReservationsSchema,
    execute: listOrgReservations,
  },
};
