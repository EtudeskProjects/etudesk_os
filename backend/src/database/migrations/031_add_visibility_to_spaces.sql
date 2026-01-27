-- Migration 031: Add visibility to spaces
-- Allows spaces to be PUBLIC, PRIVATE, or UNLISTED

-- Add visibility column
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC';

-- Create index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_spaces_visibility ON spaces(visibility);

-- Add booking rules columns for better booking management
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS booking_rules TEXT[], -- Array of rules that must be accepted
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false, -- Whether org must approve bookings
ADD COLUMN IF NOT EXISTS questions TEXT[]; -- Additional questions asked during booking

-- Add view tracking
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Add comment explaining visibility values
COMMENT ON COLUMN spaces.visibility IS 'PUBLIC = visible in explore, PRIVATE = only org members, UNLISTED = accessible by link';
