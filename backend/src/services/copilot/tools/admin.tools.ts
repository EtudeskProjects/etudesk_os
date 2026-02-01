/**
 * Admin Tools for Copilot
 * Tools for organization management (admin users only)
 */

import { z } from 'zod';
import { pool } from '../../database';
import { MemberListOutput, OrgStatsOutput, OpportunityListOutput } from '../ontology/outputs';

// ═══════════════════════════════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════════════════════════════

export const checkAdminPermissionsSchema = z.object({
  organizationId: z.string().uuid().optional().describe('ID de l\'organisation (optionnel, utilise la première si non spécifié)'),
  requiredPermission: z
    .enum(['view', 'edit', 'manage_members', 'manage_opportunities', 'admin'])
    .default('view'),
});

export type CheckAdminPermissionsParams = z.infer<typeof checkAdminPermissionsSchema>;

interface PermissionCheck {
  hasPermission: boolean;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  permissions?: string[];
  error?: string;
}

export async function checkAdminPermissions(
  params: CheckAdminPermissionsParams,
  context: { talentId: string }
): Promise<PermissionCheck> {
  const { talentId } = context;
  const { organizationId, requiredPermission } = params;

  let query = `
    SELECT
      om.organization_id, om.role, om.permissions,
      o.name as organization_name
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.talent_id = $1
      AND om.status = 'ACTIVE'
      AND om.role IN ('ADMIN', 'OWNER', 'RECRUITER')
  `;
  const queryParams: string[] = [talentId];

  if (organizationId) {
    query += ' AND om.organization_id = $2';
    queryParams.push(organizationId);
  }

  query += ' ORDER BY om.role = \'OWNER\' DESC, om.role = \'ADMIN\' DESC LIMIT 1';

  const result = await pool.query(query, queryParams);

  if (result.rows.length === 0) {
    return {
      hasPermission: false,
      error: 'Vous n\'avez pas de rôle administrateur dans une organisation',
    };
  }

  const membership = result.rows[0];
  const userPermissions = membership.permissions || [];
  const role = membership.role;

  // Check permission based on role
  let hasPermission = false;

  if (role === 'OWNER') {
    hasPermission = true; // Owner has all permissions
  } else if (role === 'ADMIN') {
    hasPermission = requiredPermission !== 'admin' || userPermissions.includes('admin');
  } else if (role === 'RECRUITER') {
    hasPermission = ['view', 'manage_opportunities'].includes(requiredPermission);
  }

  return {
    hasPermission,
    organizationId: membership.organization_id,
    organizationName: membership.organization_name,
    role,
    permissions: userPermissions,
    error: hasPermission ? undefined : `Permission '${requiredPermission}' non accordée`,
  };
}

// ═══════════════════════════════════════════════════════════════
// LIST ORGANIZATION MEMBERS
// ═══════════════════════════════════════════════════════════════

export const listOrgMembersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  role: z.enum(['MEMBER', 'RECRUITER', 'ADMIN', 'OWNER']).optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).default('ACTIVE'),
  search: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

export type ListOrgMembersParams = z.infer<typeof listOrgMembersSchema>;

export async function listOrgMembers(
  params: ListOrgMembersParams,
  context: { talentId: string }
): Promise<MemberListOutput> {
  const { talentId } = context;
  const { organizationId, role, status, search, limit, offset } = params;

  // First check permissions
  const permCheck = await checkAdminPermissions(
    { organizationId, requiredPermission: 'view' },
    { talentId }
  );

  if (!permCheck.hasPermission) {
    throw new Error(permCheck.error || 'Permission refusée');
  }

  const orgId = organizationId || permCheck.organizationId;

  let sql = `
    SELECT
      om.id, t.display_name as name, t.email, om.role, om.status, om.joined_at,
      t.avatar_url
    FROM organization_members om
    JOIN talents t ON om.talent_id = t.id
    WHERE om.organization_id = $1 AND om.status = $2
  `;
  const queryParams: (string | number)[] = [orgId!, status];
  let paramIndex = 3;

  if (role) {
    sql += ` AND om.role = $${paramIndex}`;
    queryParams.push(role);
    paramIndex++;
  }

  if (search) {
    sql += ` AND (t.display_name ILIKE '%' || $${paramIndex} || '%' OR t.email ILIKE '%' || $${paramIndex} || '%')`;
    queryParams.push(search);
    paramIndex++;
  }

  sql += ` ORDER BY om.role = 'OWNER' DESC, om.role = 'ADMIN' DESC, om.joined_at DESC`;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND status = $2`,
    [orgId, status]
  );

  return {
    type: 'member_list',
    organizationId: orgId!,
    organizationName: permCheck.organizationName!,
    members: result.rows.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      joinedAt: m.joined_at?.toISOString(),
      avatarUrl: m.avatar_url,
    })),
    totalCount: parseInt(countResult.rows[0].count) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// GET ORGANIZATION STATS
// ═══════════════════════════════════════════════════════════════

export const getOrgStatsSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export type GetOrgStatsParams = z.infer<typeof getOrgStatsSchema>;

export async function getOrgStats(
  params: GetOrgStatsParams,
  context: { talentId: string }
): Promise<OrgStatsOutput> {
  const { talentId } = context;
  const { organizationId } = params;

  // Check permissions
  const permCheck = await checkAdminPermissions(
    { organizationId, requiredPermission: 'view' },
    { talentId }
  );

  if (!permCheck.hasPermission) {
    throw new Error(permCheck.error || 'Permission refusée');
  }

  const orgId = organizationId || permCheck.organizationId;

  // Get member count
  const memberCountResult = await pool.query(
    `SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND status = 'ACTIVE'`,
    [orgId]
  );

  // Get opportunity stats
  const oppStatsResult = await pool.query(
    `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE o.status = 'OPEN') as active,
      COALESCE(SUM(o.views_count), 0) as total_views
    FROM opportunities o
    JOIN opportunity_posters op ON o.id = op.opportunity_id
    WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
  `,
    [orgId]
  );

  // Get application count
  const appCountResult = await pool.query(
    `
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days') as this_month
    FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN opportunity_posters op ON o.id = op.opportunity_id
    WHERE op.poster_organization_id = $1 AND a.deleted_at IS NULL
  `,
    [orgId]
  );

  const oppStats = oppStatsResult.rows[0];
  const appStats = appCountResult.rows[0];

  return {
    type: 'org_stats',
    organizationId: orgId!,
    organizationName: permCheck.organizationName!,
    stats: {
      memberCount: parseInt(memberCountResult.rows[0].count) || 0,
      opportunityCount: parseInt(oppStats.total) || 0,
      applicationCount: parseInt(appStats.total) || 0,
      activeOpportunities: parseInt(oppStats.active) || 0,
      viewsThisMonth: parseInt(oppStats.total_views) || 0,
      applicationsThisMonth: parseInt(appStats.this_month) || 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// LIST ORGANIZATION OPPORTUNITIES
// ═══════════════════════════════════════════════════════════════

export const listOrgOpportunitiesSchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'PAUSED', 'ARCHIVED']).optional(),
  limit: z.number().min(1).max(20).default(10),
  offset: z.number().min(0).default(0),
});

export type ListOrgOpportunitiesParams = z.infer<typeof listOrgOpportunitiesSchema>;

export async function listOrgOpportunities(
  params: ListOrgOpportunitiesParams,
  context: { talentId: string }
): Promise<OpportunityListOutput> {
  const { talentId } = context;
  const { organizationId, status, limit, offset } = params;

  // Check permissions
  const permCheck = await checkAdminPermissions(
    { organizationId, requiredPermission: 'manage_opportunities' },
    { talentId }
  );

  if (!permCheck.hasPermission) {
    throw new Error(permCheck.error || 'Permission refusée');
  }

  const orgId = organizationId || permCheck.organizationId;

  let sql = `
    SELECT
      o.id, o.title, o.slug, o.summary, o.type, o.contract_type,
      o.location_type, o.locations, o.status, o.deadline,
      o.views_count, o.applications_count, o.posted_at,
      org.name as org_name, org.logo_url as org_logo
    FROM opportunities o
    JOIN opportunity_posters op ON o.id = op.opportunity_id
    JOIN organizations org ON op.poster_organization_id = org.id
    WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
  `;
  const queryParams: (string | number)[] = [orgId!];
  let paramIndex = 2;

  if (status) {
    sql += ` AND o.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  sql += ` ORDER BY o.posted_at DESC NULLS LAST`;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await pool.query(sql, queryParams);

  // Get total count
  let countSql = `
    SELECT COUNT(*)
    FROM opportunities o
    JOIN opportunity_posters op ON o.id = op.opportunity_id
    WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
  `;
  const countParams: string[] = [orgId!];

  if (status) {
    countSql += ' AND o.status = $2';
    countParams.push(status);
  }

  const countResult = await pool.query(countSql, countParams);

  return {
    type: 'opportunity_list',
    opportunities: result.rows.map((row) => {
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
        subtitle: row.org_name,
        description: row.summary?.slice(0, 150) || '',
        imageUrl: row.org_logo,
        opportunityType: row.type,
        organization: row.org_name,
        location: locationText,
        isRemote: row.location_type === 'REMOTE',
        deadline: row.deadline?.toISOString(),
        // Admin-specific metadata
        matchScore: undefined,
        matchReasons: undefined,
      };
    }),
    totalCount: parseInt(countResult.rows[0].count) || 0,
    hasMore: offset + limit < parseInt(countResult.rows[0].count),
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const adminToolDefinitions = {
  check_admin_permissions: {
    name: 'check_admin_permissions',
    description:
      "Vérifie si l'utilisateur a les permissions admin dans une organisation. Doit être appelé avant toute action admin.",
    parameters: checkAdminPermissionsSchema,
    execute: checkAdminPermissions,
  },
  list_org_members: {
    name: 'list_org_members',
    description:
      "Liste les membres d'une organisation. Requiert des permissions admin.",
    parameters: listOrgMembersSchema,
    execute: listOrgMembers,
  },
  get_org_stats: {
    name: 'get_org_stats',
    description:
      "Récupère les statistiques d'une organisation (membres, opportunités, candidatures, vues).",
    parameters: getOrgStatsSchema,
    execute: getOrgStats,
  },
  list_org_opportunities: {
    name: 'list_org_opportunities',
    description:
      "Liste les opportunités publiées par l'organisation. Permet de gérer le recrutement.",
    parameters: listOrgOpportunitiesSchema,
    execute: listOrgOpportunities,
  },
};
