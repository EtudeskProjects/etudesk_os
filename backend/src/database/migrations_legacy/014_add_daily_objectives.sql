-- Migration: Add daily_objectives table for caching AI-generated daily objectives
-- This table caches objectives for 24h per talent/organization to minimize API costs

CREATE TABLE IF NOT EXISTS daily_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure either talent_id or organization_id is set, not both
    CONSTRAINT chk_objective_owner CHECK (
        (talent_id IS NOT NULL AND organization_id IS NULL) OR
        (talent_id IS NULL AND organization_id IS NOT NULL)
    )
);

-- Unique constraint: one active objective per talent
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_objectives_talent_unique
ON daily_objectives (talent_id)
WHERE talent_id IS NOT NULL AND organization_id IS NULL;

-- Unique constraint: one active objective per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_objectives_org_unique
ON daily_objectives (organization_id)
WHERE organization_id IS NOT NULL AND talent_id IS NULL;

-- Index for cache lookup
CREATE INDEX IF NOT EXISTS idx_daily_objectives_expires
ON daily_objectives (expires_at);

-- Cleanup old expired entries periodically (optional: can be run via cron)
-- DELETE FROM daily_objectives WHERE expires_at < NOW() - INTERVAL '7 days';
