/**
 * Copilot Session Service
 * Session and message management for copilot conversations
 * - Personal sessions: scoped by talent_id (organization_id IS NULL)
 * - Org sessions: shared across all active members of the organization
 *   Any member can see all org sessions & messages, with sender info attached
 */

import { pool } from '../database';


export const COPILOT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
  ORG: 'org',
} as const;

export type CopilotMode = (typeof COPILOT_MODES)[keyof typeof COPILOT_MODES];

export interface CopilotSession {
  id: string;
  talentId: string;
  organizationId?: string;
  mode: CopilotMode;
  title?: string;
  context: Record<string, unknown>;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any;
  toolResults?: any;
  outputData?: any;
  attachments?: any[];
  senderName?: string;
  senderAvatarUrl?: string;
  createdAt: string;
}

// --- Session Management ---

export async function createSession(
  talentId: string,
  mode: CopilotMode = COPILOT_MODES.EXPLORE,
  organizationId?: string
): Promise<CopilotSession> {
  const result = await pool.query(
    `INSERT INTO copilot_sessions (talent_id, organization_id, mode, context, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, talent_id, organization_id, mode, title, context, last_message_at, created_at, updated_at`,
    [talentId, organizationId || null, mode, JSON.stringify({})]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    talentId: row.talent_id,
    organizationId: row.organization_id || undefined,
    mode: row.mode as CopilotMode,
    title: row.title,
    context: row.context || {},
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get a session by ID.
 * - Personal: requires matching talent_id
 * - Org: requires active membership in the organization (any member can access)
 */
export async function getSession(
  sessionId: string,
  talentId: string,
  organizationId?: string
): Promise<CopilotSession | null> {
  let result;

  if (organizationId) {
    // Org session: verify the caller is an active member of this org
    result = await pool.query(
      `SELECT cs.id, cs.talent_id, cs.organization_id, cs.mode, cs.title, cs.context,
              cs.last_message_at, cs.created_at, cs.updated_at
       FROM copilot_sessions cs
       WHERE cs.id = $1
         AND cs.organization_id = $2
         AND cs.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = $2 AND om.talent_id = $3 AND om.status = 'ACTIVE'
         )`,
      [sessionId, organizationId, talentId]
    );
  } else {
    // Personal session: must belong to this talent
    result = await pool.query(
      `SELECT id, talent_id, organization_id, mode, title, context,
              last_message_at, created_at, updated_at
       FROM copilot_sessions
       WHERE id = $1 AND talent_id = $2 AND organization_id IS NULL AND deleted_at IS NULL`,
      [sessionId, talentId]
    );
  }

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    talentId: row.talent_id,
    organizationId: row.organization_id || undefined,
    mode: row.mode as CopilotMode,
    title: row.title,
    context: row.context || {},
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List sessions.
 * - Personal (no organizationId): only this talent's personal sessions
 * - Org (with organizationId): ALL sessions for this org (shared across members)
 */
export async function listSessions(
  talentId: string,
  limit: number = 20,
  organizationId?: string
): Promise<Array<{
  id: string;
  title?: string;
  mode: CopilotMode;
  organizationId?: string;
  createdByName?: string;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
}>> {
  let result;

  if (organizationId) {
    // All org sessions (shared) — verify membership first, then return all
    result = await pool.query(
      `SELECT
         cs.id, cs.title, cs.mode, cs.organization_id, cs.last_message_at, cs.created_at,
         COALESCE(t.first_name || ' ' || t.last_name, t.email) as created_by_name,
         (SELECT COUNT(*) FROM copilot_messages cm WHERE cm.session_id = cs.id AND cm.deleted_at IS NULL) as message_count
       FROM copilot_sessions cs
       LEFT JOIN talents t ON t.id = cs.talent_id
       WHERE cs.organization_id = $2
         AND cs.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = $2 AND om.talent_id = $1 AND om.status = 'ACTIVE'
         )
       ORDER BY cs.last_message_at DESC NULLS LAST, cs.created_at DESC
       LIMIT $3`,
      [talentId, organizationId, limit]
    );
  } else {
    // Personal sessions only
    result = await pool.query(
      `SELECT
         cs.id, cs.title, cs.mode, cs.organization_id, cs.last_message_at, cs.created_at,
         (SELECT COUNT(*) FROM copilot_messages cm WHERE cm.session_id = cs.id AND cm.deleted_at IS NULL) as message_count
       FROM copilot_sessions cs
       WHERE cs.talent_id = $1 AND cs.organization_id IS NULL AND cs.deleted_at IS NULL
       ORDER BY cs.last_message_at DESC NULLS LAST, cs.created_at DESC
       LIMIT $2`,
      [talentId, limit]
    );
  }

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode as CopilotMode,
    organizationId: row.organization_id || undefined,
    createdByName: row.created_by_name || undefined,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    messageCount: parseInt(row.message_count) || 0,
  }));
}

export async function deleteSession(
  sessionId: string,
  talentId: string,
  organizationId?: string
): Promise<boolean> {
  let result;

  if (organizationId) {
    // Org sessions are shared across members. Deletion is allowed for:
    // 1) session creator, or
    // 2) active member with elevated management role.
    result = await pool.query(
      `UPDATE copilot_sessions cs
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE cs.id = $1
         AND cs.organization_id = $2
         AND cs.deleted_at IS NULL
         AND (
           cs.talent_id = $3
           OR EXISTS (
             SELECT 1
             FROM organization_members om
             WHERE om.organization_id = $2
               AND om.talent_id = $3
               AND om.status = 'ACTIVE'
               AND om.role IN ('OWNER', 'ADMIN', 'MANAGER', 'SUB_ADMIN')
           )
         )
       RETURNING cs.id`,
      [sessionId, organizationId, talentId]
    );
  } else {
    result = await pool.query(
      `UPDATE copilot_sessions
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND talent_id = $2 AND organization_id IS NULL AND deleted_at IS NULL
       RETURNING id`,
      [sessionId, talentId]
    );
  }

  return result.rows.length > 0;
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await pool.query(
    `UPDATE copilot_sessions SET title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [sessionId, title]
  );
}

/**
 * Get messages for a session.
 * JOINs with talents to include sender_name and sender_avatar_url for user messages.
 */
export async function getSessionMessages(sessionId: string, limit: number = 50): Promise<CopilotMessage[]> {
  const result = await pool.query(
    `SELECT cm.id, cm.session_id, cm.role, cm.content, cm.tool_calls, cm.tool_results,
            cm.output_data, cm.attachments, cm.created_at,
            CASE WHEN cm.talent_id IS NOT NULL
              THEN COALESCE(t.first_name || ' ' || t.last_name, t.email)
              ELSE NULL
            END as sender_name,
            CASE WHEN cm.talent_id IS NOT NULL
              THEN t.avatar_url
              ELSE NULL
            END as sender_avatar_url
     FROM copilot_messages cm
     LEFT JOIN talents t ON t.id = cm.talent_id
     WHERE cm.session_id = $1 AND cm.deleted_at IS NULL
     ORDER BY cm.created_at ASC
     LIMIT $2`,
    [sessionId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls,
    toolResults: row.tool_results,
    outputData: row.output_data,
    attachments: row.attachments,
    senderName: row.sender_name || undefined,
    senderAvatarUrl: row.sender_avatar_url || undefined,
    createdAt: row.created_at,
  }));
}

export const copilotService = {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSessionMessages,
};
