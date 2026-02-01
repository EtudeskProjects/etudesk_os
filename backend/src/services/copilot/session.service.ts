/**
 * Copilot Session Service
 * Session and message management for copilot conversations
 */

import { pool } from '../database';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export const COPILOT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
} as const;

export type CopilotMode = (typeof COPILOT_MODES)[keyof typeof COPILOT_MODES];

export interface CopilotSession {
  id: string;
  talentId: string;
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
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function createSession(
  talentId: string,
  mode: CopilotMode = COPILOT_MODES.EXPLORE
): Promise<CopilotSession> {
  const result = await pool.query(
    `INSERT INTO copilot_sessions (talent_id, mode, context, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, talent_id, mode, title, context, last_message_at, created_at, updated_at`,
    [talentId, mode, JSON.stringify({})]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    talentId: row.talent_id,
    mode: row.mode as CopilotMode,
    title: row.title,
    context: row.context || {},
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSession(sessionId: string, talentId: string): Promise<CopilotSession | null> {
  const result = await pool.query(
    `SELECT id, talent_id, mode, title, context, last_message_at, created_at, updated_at
     FROM copilot_sessions
     WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
    [sessionId, talentId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    talentId: row.talent_id,
    mode: row.mode as CopilotMode,
    title: row.title,
    context: row.context || {},
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSessions(
  talentId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  title?: string;
  mode: CopilotMode;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
}>> {
  const result = await pool.query(
    `SELECT
       cs.id, cs.title, cs.mode, cs.last_message_at, cs.created_at,
       (SELECT COUNT(*) FROM copilot_messages cm WHERE cm.session_id = cs.id) as message_count
     FROM copilot_sessions cs
     WHERE cs.talent_id = $1 AND cs.deleted_at IS NULL
     ORDER BY cs.last_message_at DESC NULLS LAST, cs.created_at DESC
     LIMIT $2`,
    [talentId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode as CopilotMode,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    messageCount: parseInt(row.message_count) || 0,
  }));
}

export async function deleteSession(sessionId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE copilot_sessions
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [sessionId, talentId]
  );
  return result.rows.length > 0;
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await pool.query(
    `UPDATE copilot_sessions SET title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [sessionId, title]
  );
}

export async function getSessionMessages(sessionId: string, limit: number = 50): Promise<CopilotMessage[]> {
  const result = await pool.query(
    `SELECT id, session_id, role, content, tool_calls, tool_results, created_at
     FROM copilot_messages
     WHERE session_id = $1
     ORDER BY created_at ASC
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
