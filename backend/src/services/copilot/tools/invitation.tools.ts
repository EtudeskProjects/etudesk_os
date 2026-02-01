/**
 * Invitation Tools for Copilot
 * Tools for managing invitations (opportunity, community, space)
 */

import { z } from 'zod';
import { pool } from '../../database';

// ═══════════════════════════════════════════════════════════════
// LIST MY INVITATIONS (Talent)
// ═══════════════════════════════════════════════════════════════

export const listMyInvitationsSchema = z.object({
  type: z
    .enum(['opportunity', 'community', 'space'])
    .optional()
    .describe("Type d'invitation à filtrer"),
  status: z
    .enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'])
    .default('PENDING')
    .describe('Statut des invitations'),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listMyInvitations(
  params: z.infer<typeof listMyInvitationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { type, status, limit, offset } = params;

  const results: any[] = [];

  // Opportunity invitations
  if (!type || type === 'opportunity') {
    const oppResult = await pool.query(
      `SELECT oi.id, oi.status, oi.message, oi.created_at, oi.expires_at,
              o.id as target_id, o.title as target_name, 'opportunity' as invitation_type,
              org.name as org_name
       FROM opportunity_invitations oi
       JOIN opportunities o ON oi.opportunity_id = o.id
       LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
       LEFT JOIN organizations org ON op.poster_organization_id = org.id
       WHERE oi.talent_id = $1 AND oi.status = $2 AND oi.deleted_at IS NULL
       ORDER BY oi.created_at DESC
       LIMIT $3 OFFSET $4`,
      [talentId, status, limit, offset]
    );
    results.push(...oppResult.rows);
  }

  // Community invitations
  if (!type || type === 'community') {
    const comResult = await pool.query(
      `SELECT ci.id, ci.status, ci.message, ci.created_at, ci.expires_at,
              c.id as target_id, c.name as target_name, 'community' as invitation_type,
              org.name as org_name
       FROM community_invitations ci
       JOIN communities c ON ci.community_id = c.id
       LEFT JOIN organizations org ON c.organization_id = org.id
       WHERE ci.talent_id = $1 AND ci.status = $2 AND ci.deleted_at IS NULL
       ORDER BY ci.created_at DESC
       LIMIT $3 OFFSET $4`,
      [talentId, status, limit, offset]
    );
    results.push(...comResult.rows);
  }

  // Space invitations
  if (!type || type === 'space') {
    const spaceResult = await pool.query(
      `SELECT si.id, si.status, si.message, si.created_at, si.expires_at,
              s.id as target_id, s.name as target_name, 'space' as invitation_type,
              org.name as org_name
       FROM space_invitations si
       JOIN spaces s ON si.space_id = s.id
       LEFT JOIN organizations org ON s.organization_id = org.id
       WHERE si.talent_id = $1 AND si.status = $2 AND si.deleted_at IS NULL
       ORDER BY si.created_at DESC
       LIMIT $3 OFFSET $4`,
      [talentId, status, limit, offset]
    );
    results.push(...spaceResult.rows);
  }

  // Sort combined by created_at desc
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    type: 'invitation_list',
    invitations: results.slice(0, limit).map((r) => ({
      id: r.id,
      invitationType: r.invitation_type,
      status: r.status,
      targetId: r.target_id,
      targetName: r.target_name,
      orgName: r.org_name,
      message: r.message,
      createdAt: r.created_at?.toISOString(),
      expiresAt: r.expires_at?.toISOString(),
    })),
    totalCount: results.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// RESPOND TO INVITATION (Talent)
// ═══════════════════════════════════════════════════════════════

export const respondToInvitationSchema = z.object({
  invitationId: z.string().uuid().describe("ID de l'invitation"),
  invitationType: z.enum(['opportunity', 'community', 'space']).describe("Type d'invitation"),
  action: z.enum(['accept', 'decline']).describe('Action à effectuer'),
});

export async function respondToInvitation(
  params: z.infer<typeof respondToInvitationSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { invitationId, invitationType, action } = params;
  const newStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED';

  const tableMap: Record<string, string> = {
    opportunity: 'opportunity_invitations',
    community: 'community_invitations',
    space: 'space_invitations',
  };

  const table = tableMap[invitationType];

  const result = await pool.query(
    `UPDATE ${table} SET status = $1, responded_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND talent_id = $3 AND status = 'PENDING'
     RETURNING id, status`,
    [newStatus, invitationId, talentId]
  );

  if (result.rows.length === 0) {
    throw new Error('Invitation non trouvée ou déjà traitée');
  }

  // If accepted community invitation, add as member
  if (action === 'accept' && invitationType === 'community') {
    const inv = await pool.query(
      `SELECT community_id FROM community_invitations WHERE id = $1`,
      [invitationId]
    );
    if (inv.rows[0]) {
      await pool.query(
        `INSERT INTO community_members (community_id, talent_id, role, status, joined_at)
         VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW())
         ON CONFLICT (community_id, talent_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW()`,
        [inv.rows[0].community_id, talentId]
      );
    }
  }

  return {
    type: 'confirmation',
    title: action === 'accept' ? 'Invitation acceptée' : 'Invitation déclinée',
    message: `L'invitation a été ${action === 'accept' ? 'acceptée' : 'déclinée'} avec succès.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// SEND INVITATION (Organization)
// ═══════════════════════════════════════════════════════════════

export const sendInvitationSchema = z.object({
  invitationType: z.enum(['opportunity', 'community', 'space']).describe("Type d'invitation"),
  targetId: z.string().uuid().describe("ID de l'opportunité, communauté ou espace"),
  talentEmail: z.string().email().describe("Email du talent à inviter"),
  message: z.string().max(500).optional().describe("Message d'invitation personnalisé"),
});

export async function sendInvitation(
  params: z.infer<typeof sendInvitationSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { invitationType, targetId, talentEmail, message } = params;

  // Find target talent
  const talentResult = await pool.query(
    `SELECT id FROM talents WHERE email = $1 AND deleted_at IS NULL`,
    [talentEmail]
  );

  if (talentResult.rows.length === 0) {
    throw new Error('Talent non trouvé avec cet email');
  }

  const invitedTalentId = talentResult.rows[0].id;

  // Check admin permissions
  let orgId: string;
  if (invitationType === 'opportunity') {
    const opp = await pool.query(
      `SELECT op.poster_organization_id FROM opportunity_posters op WHERE op.opportunity_id = $1`,
      [targetId]
    );
    if (!opp.rows[0]) throw new Error('Opportunité non trouvée');
    orgId = opp.rows[0].poster_organization_id;
  } else if (invitationType === 'community') {
    const com = await pool.query(`SELECT organization_id FROM communities WHERE id = $1`, [targetId]);
    if (!com.rows[0]) throw new Error('Communauté non trouvée');
    orgId = com.rows[0].organization_id;
  } else {
    const sp = await pool.query(`SELECT organization_id FROM spaces WHERE id = $1`, [targetId]);
    if (!sp.rows[0]) throw new Error('Espace non trouvé');
    orgId = sp.rows[0].organization_id;
  }

  // Verify caller is admin/owner
  const perm = await pool.query(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND talent_id = $2 AND status = 'ACTIVE'
     AND role IN ('ADMIN', 'OWNER', 'RECRUITER')`,
    [orgId, talentId]
  );
  if (perm.rows.length === 0) {
    throw new Error("Vous n'avez pas les permissions pour envoyer des invitations");
  }

  const tableMap: Record<string, { table: string; fk: string }> = {
    opportunity: { table: 'opportunity_invitations', fk: 'opportunity_id' },
    community: { table: 'community_invitations', fk: 'community_id' },
    space: { table: 'space_invitations', fk: 'space_id' },
  };

  const { table, fk } = tableMap[invitationType];

  await pool.query(
    `INSERT INTO ${table} (${fk}, talent_id, invited_by, message, status, expires_at)
     VALUES ($1, $2, $3, $4, 'PENDING', NOW() + INTERVAL '30 days')
     ON CONFLICT DO NOTHING`,
    [targetId, invitedTalentId, talentId, message || null]
  );

  return {
    type: 'confirmation',
    title: 'Invitation envoyée',
    message: `Invitation envoyée à ${talentEmail} avec succès.`,
  };
}

// ═══════════════════════════════════════════════════════════════
// LIST ORG INVITATIONS (Organization)
// ═══════════════════════════════════════════════════════════════

export const listOrgInvitationsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  invitationType: z.enum(['opportunity', 'community', 'space']).optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']).default('PENDING'),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export async function listOrgInvitations(
  params: z.infer<typeof listOrgInvitationsSchema>,
  context: { talentId: string }
) {
  const { talentId } = context;
  const { organizationId, invitationType, status, limit, offset } = params;

  // Check admin permissions
  const perm = await pool.query(
    `SELECT om.organization_id, o.name as org_name
     FROM organization_members om
     JOIN organizations o ON om.organization_id = o.id
     WHERE om.talent_id = $1 AND om.status = 'ACTIVE'
     AND om.role IN ('ADMIN', 'OWNER', 'RECRUITER')
     ${organizationId ? 'AND om.organization_id = $2' : ''}
     LIMIT 1`,
    organizationId ? [talentId, organizationId] : [talentId]
  );

  if (perm.rows.length === 0) throw new Error('Permission refusée');
  const orgId = perm.rows[0].organization_id;

  const results: any[] = [];

  if (!invitationType || invitationType === 'opportunity') {
    const r = await pool.query(
      `SELECT oi.id, oi.status, oi.message, oi.created_at, 'opportunity' as invitation_type,
              o.title as target_name, t.display_name as talent_name, t.email as talent_email
       FROM opportunity_invitations oi
       JOIN opportunities o ON oi.opportunity_id = o.id
       JOIN opportunity_posters op ON o.id = op.opportunity_id
       JOIN talents t ON oi.talent_id = t.id
       WHERE op.poster_organization_id = $1 AND oi.status = $2 AND oi.deleted_at IS NULL
       ORDER BY oi.created_at DESC LIMIT $3 OFFSET $4`,
      [orgId, status, limit, offset]
    );
    results.push(...r.rows);
  }

  if (!invitationType || invitationType === 'community') {
    const r = await pool.query(
      `SELECT ci.id, ci.status, ci.message, ci.created_at, 'community' as invitation_type,
              c.name as target_name, t.display_name as talent_name, t.email as talent_email
       FROM community_invitations ci
       JOIN communities c ON ci.community_id = c.id
       JOIN talents t ON ci.talent_id = t.id
       WHERE c.organization_id = $1 AND ci.status = $2 AND ci.deleted_at IS NULL
       ORDER BY ci.created_at DESC LIMIT $3 OFFSET $4`,
      [orgId, status, limit, offset]
    );
    results.push(...r.rows);
  }

  if (!invitationType || invitationType === 'space') {
    const r = await pool.query(
      `SELECT si.id, si.status, si.message, si.created_at, 'space' as invitation_type,
              s.name as target_name, t.display_name as talent_name, t.email as talent_email
       FROM space_invitations si
       JOIN spaces s ON si.space_id = s.id
       JOIN talents t ON si.talent_id = t.id
       WHERE s.organization_id = $1 AND si.status = $2 AND si.deleted_at IS NULL
       ORDER BY si.created_at DESC LIMIT $3 OFFSET $4`,
      [orgId, status, limit, offset]
    );
    results.push(...r.rows);
  }

  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    type: 'invitation_list',
    invitations: results.slice(0, limit).map((r) => ({
      id: r.id,
      invitationType: r.invitation_type,
      status: r.status,
      targetName: r.target_name,
      talentName: r.talent_name,
      talentEmail: r.talent_email,
      message: r.message,
      createdAt: r.created_at?.toISOString(),
    })),
    totalCount: results.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const invitationToolDefinitions = {
  list_my_invitations: {
    name: 'list_my_invitations',
    description:
      "Liste les invitations reçues par le talent (opportunités, communautés, espaces). Utilise cette fonction quand l'utilisateur demande ses invitations.",
    parameters: listMyInvitationsSchema,
    execute: listMyInvitations,
  },
  respond_to_invitation: {
    name: 'respond_to_invitation',
    description:
      "Accepte ou décline une invitation. Demande TOUJOURS confirmation à l'utilisateur avant d'exécuter cette action.",
    parameters: respondToInvitationSchema,
    execute: respondToInvitation,
  },
  send_invitation: {
    name: 'send_invitation',
    description:
      "Envoie une invitation à un talent (email) pour une opportunité, communauté ou espace. Réservé aux admins/recruteurs.",
    parameters: sendInvitationSchema,
    execute: sendInvitation,
  },
  list_org_invitations: {
    name: 'list_org_invitations',
    description:
      "Liste les invitations envoyées par l'organisation. Réservé aux admins/recruteurs.",
    parameters: listOrgInvitationsSchema,
    execute: listOrgInvitations,
  },
};
