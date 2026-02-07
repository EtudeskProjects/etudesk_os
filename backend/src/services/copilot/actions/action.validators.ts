/**
 * Action Validators
 * Validates preconditions before executing copilot actions.
 */

import { pool } from '../../database';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: Record<string, any>;
}

export async function validateApplyOpportunity(
  talentId: string,
  opportunityId: string
): Promise<ValidationResult> {
  // Check opportunity exists and is open
  const opp = await pool.query(
    `SELECT id, title, status, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );
  if (opp.rows.length === 0) {
    return { valid: false, error: "Cette opportunité n'existe pas ou a été supprimée." };
  }
  if (opp.rows[0].status !== 'OPEN') {
    return { valid: false, error: "Cette opportunité n'est plus ouverte aux candidatures." };
  }
  if (opp.rows[0].deadline && new Date(opp.rows[0].deadline) < new Date()) {
    return { valid: false, error: 'La date limite de candidature est dépassée.' };
  }

  // Check not already applied
  const existing = await pool.query(
    `SELECT id FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2`,
    [talentId, opportunityId]
  );
  if (existing.rows.length > 0) {
    return { valid: false, error: 'Vous avez déjà postulé à cette opportunité.' };
  }

  return { valid: true, data: { title: opp.rows[0].title } };
}

export async function validateJoinCommunity(
  talentId: string,
  communityId: string
): Promise<ValidationResult> {
  const comm = await pool.query(
    `SELECT id, name, status FROM communities WHERE id = $1 AND deleted_at IS NULL`,
    [communityId]
  );
  if (comm.rows.length === 0) {
    return { valid: false, error: "Cette communauté n'existe pas." };
  }
  if (comm.rows[0].status !== 'ACTIVE') {
    return { valid: false, error: "Cette communauté n'est pas active." };
  }

  const existing = await pool.query(
    `SELECT id FROM community_members WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
    [talentId, communityId]
  );
  if (existing.rows.length > 0) {
    return { valid: false, error: 'Vous êtes déjà membre de cette communauté.' };
  }

  return { valid: true, data: { name: comm.rows[0].name } };
}

export async function validateBookSpace(
  talentId: string,
  spaceId: string,
  data?: { startDatetime?: string; endDatetime?: string }
): Promise<ValidationResult> {
  const space = await pool.query(
    `SELECT id, name, status, hourly_rate FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
    [spaceId]
  );
  if (space.rows.length === 0) {
    return { valid: false, error: "Cet espace n'existe pas." };
  }
  if (space.rows[0].status !== 'ACTIVE') {
    return { valid: false, error: "Cet espace n'est pas disponible." };
  }

  if (!data?.startDatetime || !data?.endDatetime) {
    return { valid: false, error: 'Les dates de réservation sont requises.' };
  }

  // Check no conflict
  const conflict = await pool.query(
    `SELECT id FROM space_bookings
     WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
     AND start_datetime < $3 AND end_datetime > $2`,
    [spaceId, data.startDatetime, data.endDatetime]
  );
  if (conflict.rows.length > 0) {
    return { valid: false, error: 'Ce créneau est déjà réservé.' };
  }

  return { valid: true, data: { name: space.rows[0].name, rate: space.rows[0].hourly_rate } };
}

export async function validatePublishOpportunity(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>
): Promise<ValidationResult> {
  // Verify talent is OWNER or ADMIN of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: "Vous n'avez pas les droits pour publier dans cette organisation." };
  }

  // Validate required fields
  if (!data?.title || !data?.summary || !data?.contract_type) {
    return { valid: false, error: 'Les champs titre, résumé et type de contrat sont requis.' };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateCreateCommunity(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>
): Promise<ValidationResult> {
  // Verify talent is member of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: "Vous n'êtes pas membre de cette organisation." };
  }

  if (!data?.name || !data?.description) {
    return { valid: false, error: 'Les champs nom et description sont requis.' };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateCreateSpace(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>
): Promise<ValidationResult> {
  // Verify talent is OWNER or ADMIN of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: "Vous n'avez pas les droits pour créer un espace dans cette organisation." };
  }

  if (!data?.name || !data?.type || !data?.surface_m2) {
    return { valid: false, error: 'Les champs nom, type et surface sont requis.' };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateRespondInvitation(
  talentId: string,
  invitationId: string,
  accept: boolean
): Promise<ValidationResult> {
  // Check community invitations
  let result = await pool.query(
    `SELECT id, status FROM community_invitations
     WHERE id = $1 AND invitee_talent_id = $2 AND status = 'PENDING'`,
    [invitationId, talentId]
  );
  if (result.rows.length > 0) {
    return { valid: true, data: { type: 'community', accept } };
  }

  // Check organization invitations
  result = await pool.query(
    `SELECT id, status FROM organization_invitations
     WHERE id = $1 AND email = (SELECT email FROM talents WHERE id = $2) AND status = 'PENDING'`,
    [invitationId, talentId]
  );
  if (result.rows.length > 0) {
    return { valid: true, data: { type: 'organization', accept } };
  }

  return { valid: false, error: 'Invitation non trouvée ou déjà traitée.' };
}
