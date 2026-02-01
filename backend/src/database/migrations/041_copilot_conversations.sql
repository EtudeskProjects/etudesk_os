-- Migration: Copilot Conversations System
-- Description: Tables for AI copilot sessions and messages

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- COPILOT SESSIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS copilot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL DEFAULT 'explore' CHECK (mode IN ('explore', 'study')),
    title VARCHAR(255),
    context JSONB DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast lookups by talent
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_talent ON copilot_sessions(talent_id);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_talent_active ON copilot_sessions(talent_id) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- COPILOT MESSAGES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS copilot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    output_type VARCHAR(50),
    output_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast message retrieval by session
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session ON copilot_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session_created ON copilot_messages(session_id, created_at);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Update session timestamp on new message
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_copilot_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE copilot_sessions
    SET last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_copilot_session_timestamp ON copilot_messages;
CREATE TRIGGER trigger_update_copilot_session_timestamp
    AFTER INSERT ON copilot_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_copilot_session_timestamp();

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE copilot_sessions IS 'AI copilot conversation sessions';
COMMENT ON COLUMN copilot_sessions.mode IS 'Copilot mode: explore (discovery) or study (learning)';
COMMENT ON COLUMN copilot_sessions.context IS 'Active context (entities, preferences, etc.)';

COMMENT ON TABLE copilot_messages IS 'Messages within copilot sessions';
COMMENT ON COLUMN copilot_messages.role IS 'Message role: user, assistant, system, or tool';
COMMENT ON COLUMN copilot_messages.tool_calls IS 'Tool calls made by the assistant';
COMMENT ON COLUMN copilot_messages.tool_results IS 'Results from tool executions';
COMMENT ON COLUMN copilot_messages.output_type IS 'Output format: text, card_list, skill_graph, quiz, learning_path';
COMMENT ON COLUMN copilot_messages.output_data IS 'Structured data for rendering (cards, quiz questions, etc.)';
