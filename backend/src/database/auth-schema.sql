-- ═══════════════════════════════════════════════════════════════
-- ETUDESK AUTHENTICATION SCHEMA
-- Version: 1.0
-- OTP Passwordless Authentication
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- USERS TABLE (Authentication only - separate from Talents)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,

    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,

    -- Link to talent profile (null if not yet created)
    talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,

    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_talent_id ON users(talent_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- OTP CODES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Target
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- OTP Details
    code_hash VARCHAR(255) NOT NULL, -- bcrypt hash of the code

    -- Purpose: LOGIN, EMAIL_VERIFICATION, PASSWORD_RESET (for future)
    purpose VARCHAR(50) DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN', 'EMAIL_VERIFICATION')),

    -- Rate limiting & security
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Expiration (default: 10 minutes)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    used_at TIMESTAMP WITH TIME ZONE,
    is_valid BOOLEAN GENERATED ALWAYS AS (
        used_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND attempts < max_attempts
    ) STORED,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_is_valid ON otp_codes(is_valid) WHERE is_valid = TRUE;

-- ═══════════════════════════════════════════════════════════════
-- SESSIONS TABLE (JWT refresh tokens)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Refresh token (hashed)
    refresh_token_hash VARCHAR(255) NOT NULL,

    -- Device info
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- mobile, desktop, tablet
    ip_address INET,
    user_agent TEXT,

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255),

    -- Metadata
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to clean expired OTP codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_codes
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
       OR used_at IS NOT NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE sessions
    SET is_active = FALSE, revoked_reason = 'EXPIRED'
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Active users view
CREATE OR REPLACE VIEW active_users AS
SELECT
    u.*,
    COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
    t.avatar_url,
    t.slug as talent_slug
FROM users u
LEFT JOIN talents t ON u.talent_id = t.id
WHERE u.deleted_at IS NULL AND u.is_active = TRUE;

-- User with pending onboarding (no talent profile)
CREATE OR REPLACE VIEW users_pending_onboarding AS
SELECT u.*
FROM users u
WHERE u.deleted_at IS NULL
  AND u.is_active = TRUE
  AND u.email_verified = TRUE
  AND u.talent_id IS NULL;
