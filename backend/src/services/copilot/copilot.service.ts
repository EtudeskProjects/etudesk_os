/**
 * Copilot Service
 * Orchestrates the copilot agents and manages conversation sessions
 */

import { pool } from '../database';
import {
  CopilotMode,
  COPILOT_MODES,
  CopilotSession,
  CopilotMessage,
  SessionContext,
  ChatResponse,
  OutputType,
  OutputData,
  MessageRole,
  MESSAGE_ROLES,
} from './ontology/schema';
import { TalentContext, loadTalentContext, EXPLORER_CONTEXT_OPTIONS, STUDY_CONTEXT_OPTIONS } from './ontology/context';
import { runCopilot, AgentOutput, AgentMessage } from './agents';

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function createSession(
  talentId: string,
  mode: CopilotMode = COPILOT_MODES.EXPLORE
): Promise<CopilotSession> {
  const result = await pool.query(
    `
    INSERT INTO copilot_sessions (talent_id, mode, context, created_at, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id, talent_id, mode, title, context, last_message_at, created_at, updated_at
  `,
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
    `
    SELECT id, talent_id, mode, title, context, last_message_at, created_at, updated_at
    FROM copilot_sessions
    WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
  `,
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
): Promise<
  Array<{
    id: string;
    title?: string;
    mode: CopilotMode;
    lastMessageAt?: string;
    createdAt: string;
    messageCount: number;
  }>
> {
  const result = await pool.query(
    `
    SELECT
      cs.id, cs.title, cs.mode, cs.last_message_at, cs.created_at,
      (SELECT COUNT(*) FROM copilot_messages cm WHERE cm.session_id = cs.id) as message_count
    FROM copilot_sessions cs
    WHERE cs.talent_id = $1 AND cs.deleted_at IS NULL
    ORDER BY cs.last_message_at DESC NULLS LAST, cs.created_at DESC
    LIMIT $2
  `,
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
    `
    UPDATE copilot_sessions
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
    RETURNING id
  `,
    [sessionId, talentId]
  );

  return result.rows.length > 0;
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await pool.query(
    `
    UPDATE copilot_sessions
    SET title = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `,
    [sessionId, title]
  );
}

export async function updateSessionContext(sessionId: string, context: SessionContext): Promise<void> {
  await pool.query(
    `
    UPDATE copilot_sessions
    SET context = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `,
    [sessionId, JSON.stringify(context)]
  );
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function getSessionMessages(sessionId: string, limit: number = 50): Promise<CopilotMessage[]> {
  const result = await pool.query(
    `
    SELECT id, session_id, role, content, tool_calls, tool_results, output_type, output_data, created_at
    FROM copilot_messages
    WHERE session_id = $1
    ORDER BY created_at ASC
    LIMIT $2
  `,
    [sessionId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    toolCalls: row.tool_calls,
    toolResults: row.tool_results,
    outputType: row.output_type as OutputType | undefined,
    outputData: row.output_data,
    createdAt: row.created_at,
  }));
}

async function saveMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  options?: {
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    toolResults?: Array<{ toolCallId: string; result: unknown }>;
    outputType?: OutputType;
    outputData?: OutputData;
  }
): Promise<CopilotMessage> {
  const result = await pool.query(
    `
    INSERT INTO copilot_messages (session_id, role, content, tool_calls, tool_results, output_type, output_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, session_id, role, content, tool_calls, tool_results, output_type, output_data, created_at
  `,
    [
      sessionId,
      role,
      content,
      options?.toolCalls ? JSON.stringify(options.toolCalls) : null,
      options?.toolResults ? JSON.stringify(options.toolResults) : null,
      options?.outputType || null,
      options?.outputData ? JSON.stringify(options.outputData) : null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    toolCalls: row.tool_calls,
    toolResults: row.tool_results,
    outputType: row.output_type as OutputType | undefined,
    outputData: row.output_data,
    createdAt: row.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHAT FUNCTION
// ═══════════════════════════════════════════════════════════════

export interface ProcessMessageInput {
  sessionId?: string;
  message: string;
  mode?: CopilotMode; // Optional - triage will determine if not provided
  talentId: string;
}

export async function processMessage(input: ProcessMessageInput): Promise<ChatResponse> {
  const { message, talentId } = input;
  let { sessionId, mode } = input;

  // Get or create session
  let session: CopilotSession;

  if (sessionId) {
    const existingSession = await getSession(sessionId, talentId);
    if (!existingSession) {
      // Session not found, create new one
      session = await createSession(talentId, mode || COPILOT_MODES.EXPLORE);
    } else if (mode && existingSession.mode !== mode) {
      // Mode changed, create new session
      session = await createSession(talentId, mode);
    } else {
      session = existingSession;
      mode = session.mode as CopilotMode; // Use session's mode if not provided
    }
  } else {
    session = await createSession(talentId, mode || COPILOT_MODES.EXPLORE);
    mode = session.mode as CopilotMode;
  }

  sessionId = session.id;

  // Load talent context based on mode
  const contextOptions = mode === COPILOT_MODES.STUDY
    ? STUDY_CONTEXT_OPTIONS
    : EXPLORER_CONTEXT_OPTIONS;

  const talentContext = await loadTalentContext(talentId, contextOptions);
  const talentName = talentContext.profile?.firstName
    ? `${talentContext.profile.firstName} ${talentContext.profile.lastName || ''}`.trim()
    : undefined;

  // Save user message
  await saveMessage(sessionId, MESSAGE_ROLES.USER, message);

  // Get conversation history
  const history = await getSessionMessages(sessionId, 20);

  // Format history for agent
  const formattedHistory: AgentMessage[] = history.slice(0, -1).map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
    content: msg.content,
    toolCalls: msg.toolCalls?.map((tc: { id: string; name: string; arguments: Record<string, unknown> }) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    })),
    toolCallId: undefined as string | undefined,
  }));

  // Run copilot with orchestration (handles triage and handoffs automatically)
  const agentOutput: AgentOutput = await runCopilot(
    message,
    formattedHistory,
    {
      talentId,
      talentName,
      talentContext,
    },
    mode as 'explore' | 'study' | undefined
  );

  // Save assistant response
  const assistantMessage = await saveMessage(sessionId, MESSAGE_ROLES.ASSISTANT, agentOutput.content, {
    toolCalls: agentOutput.toolCalls,
    toolResults: agentOutput.toolResults,
    outputType: agentOutput.outputType as OutputType | undefined,
    outputData: agentOutput.outputData as OutputData | undefined,
  });

  // Generate title if first message
  if (history.length <= 1) {
    const title = generateSessionTitle(message);
    await updateSessionTitle(sessionId, title);
  }

  // Update session context with latest talent context summary
  await updateSessionContext(sessionId, {
    lastTalentContext: {
      hasProfile: !!talentContext.profile,
      hasKYC: !!talentContext.kyc,
      documentCount: talentContext.documents?.totalCount || 0,
      learningTopicsCount: talentContext.learning?.topics?.length || 0,
    },
  });

  return {
    sessionId,
    message: assistantMessage,
    context: session.context,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generateSessionTitle(firstMessage: string): string {
  // Extract key words from first message
  const cleanMessage = firstMessage.replace(/[?!.,]/g, '').trim();
  const words = cleanMessage.split(/\s+/);

  if (words.length <= 5) {
    return cleanMessage;
  }

  // Take first 5 meaningful words
  return words.slice(0, 5).join(' ') + '...';
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export const copilotService = {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  updateSessionContext,
  getSessionMessages,
  processMessage,
};

export default copilotService;
