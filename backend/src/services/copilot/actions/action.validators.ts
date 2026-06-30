/**
 * Action Validators
 * Validates preconditions before executing copilot actions.
 */

import { pool } from '../../database';
import { i18next } from '../../../i18n';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: Record<string, any>;
}

function tr(lng: string | undefined, key: string, options?: Record<string, any>): string {
  return i18next.t(key, { lng, ...(options || {}) });
}

export async function validateApplyOpportunity(
  talentId: string,
  opportunityId: string,
  language?: string
): Promise<ValidationResult> {
  // KYC gate: require verified identity before applying
  const identityCheck = await pool.query(
    `SELECT id FROM kyc_verifications WHERE talent_id = $1 AND status = 'VERIFIED' LIMIT 1`,
    [talentId]
  );
  if (identityCheck.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorKycRequired') };
  }

  // Check opportunity exists and is open
  const opp = await pool.query(
    `SELECT id, title, status, deadline, application_mode, external_apply_email FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );
  if (opp.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorOpportunityNotFound') };
  }
  if (opp.rows[0].application_mode === 'EMAIL') {
    return { valid: false, error: tr(language, 'copilot:validatorExternalOpportunityEmailOnly', { email: opp.rows[0].external_apply_email }) };
  }
  if (opp.rows[0].status !== 'OPEN') {
    return { valid: false, error: tr(language, 'copilot:validatorOpportunityNotOpen') };
  }
  if (opp.rows[0].deadline && new Date(opp.rows[0].deadline) < new Date()) {
    return { valid: false, error: tr(language, 'copilot:validatorDeadlinePassed') };
  }

  // Check not already applied
  const existing = await pool.query(
    `SELECT id FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2`,
    [talentId, opportunityId]
  );
  if (existing.rows.length > 0) {
    return { valid: false, error: tr(language, 'copilot:validatorAlreadyApplied') };
  }

  return { valid: true, data: { title: opp.rows[0].title } };
}

export async function validateJoinCommunity(
  talentId: string,
  communityId: string,
  language?: string
): Promise<ValidationResult> {
  const comm = await pool.query(
    `SELECT id, name, status FROM communities WHERE id = $1 AND deleted_at IS NULL`,
    [communityId]
  );
  if (comm.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorCommunityNotFound') };
  }
  if (comm.rows[0].status !== 'ACTIVE') {
    return { valid: false, error: tr(language, 'copilot:validatorCommunityNotActive') };
  }

  const existing = await pool.query(
    `SELECT id FROM community_members WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
    [talentId, communityId]
  );
  if (existing.rows.length > 0) {
    return { valid: false, error: tr(language, 'copilot:validatorAlreadyMember') };
  }

  return { valid: true, data: { name: comm.rows[0].name } };
}

export async function validateBookSpace(
  talentId: string,
  spaceId: string,
  data?: { startDatetime?: string; endDatetime?: string },
  language?: string
): Promise<ValidationResult> {
  const space = await pool.query(
    `SELECT id, name, status, hourly_rate FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
    [spaceId]
  );
  if (space.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorSpaceNotFound') };
  }
  if (space.rows[0].status !== 'ACTIVE') {
    return { valid: false, error: tr(language, 'copilot:validatorSpaceNotAvailable') };
  }

  if (!data?.startDatetime || !data?.endDatetime) {
    return { valid: false, error: tr(language, 'copilot:validatorBookingDatesRequired') };
  }

  // Check no conflict
  const conflict = await pool.query(
    `SELECT id FROM space_bookings
     WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
     AND start_datetime < $3 AND end_datetime > $2`,
    [spaceId, data.startDatetime, data.endDatetime]
  );
  if (conflict.rows.length > 0) {
    return { valid: false, error: tr(language, 'copilot:validatorSlotTaken') };
  }

  return { valid: true, data: { name: space.rows[0].name, rate: space.rows[0].hourly_rate } };
}

export async function validatePublishOpportunity(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>,
  language?: string
): Promise<ValidationResult> {
  // Verify talent is OWNER or ADMIN of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorNoPublishRights') };
  }

  // Validate required fields
  if (!data?.title || !data?.summary || !data?.contract_type) {
    return { valid: false, error: tr(language, 'copilot:validatorOpportunityFieldsRequired') };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateCreateCommunity(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>,
  language?: string
): Promise<ValidationResult> {
  // Verify talent is member of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorNotOrgMember') };
  }

  if (!data?.name || !data?.description) {
    return { valid: false, error: tr(language, 'copilot:validatorCommunityFieldsRequired') };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateCreateSpace(
  talentId: string,
  organizationId: string,
  data?: Record<string, any>,
  language?: string
): Promise<ValidationResult> {
  // Verify talent is OWNER or ADMIN of the org
  const membership = await pool.query(
    `SELECT role FROM organization_members
     WHERE talent_id = $1 AND organization_id = $2 AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')`,
    [talentId, organizationId]
  );
  if (membership.rows.length === 0) {
    return { valid: false, error: tr(language, 'copilot:validatorNoSpaceRights') };
  }

  if (!data?.name || !data?.type || !data?.surface_m2) {
    return { valid: false, error: tr(language, 'copilot:validatorSpaceFieldsRequired') };
  }

  return { valid: true, data: { role: membership.rows[0].role } };
}

export async function validateRespondInvitation(
  talentId: string,
  invitationId: string,
  accept: boolean,
  language?: string
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

  return { valid: false, error: tr(language, 'copilot:validatorInvitationNotFound') };
}
