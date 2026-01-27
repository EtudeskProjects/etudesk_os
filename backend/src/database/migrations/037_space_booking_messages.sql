-- Migration 037: Space Booking Messages
-- Handles messaging between talents and organizations for space bookings

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE SPACE BOOKING MESSAGES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS space_booking_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  booking_id UUID NOT NULL REFERENCES space_bookings(id) ON DELETE CASCADE,

  -- Sender Info
  sender_type VARCHAR(20) NOT NULL,  -- 'talent' or 'organization'
  sender_id UUID NOT NULL,           -- talent_id or organization_id depending on sender_type

  -- Message Content
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',    -- Array of {name, url, type, size}

  -- Datetime Proposals (for scheduling discussions)
  proposed_datetime TIMESTAMP WITH TIME ZONE,
  datetime_type VARCHAR(30),         -- 'BOOKING_PROPOSAL', 'RESCHEDULE_REQUEST', 'AVAILABILITY'

  -- Read Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_space_booking_messages_booking ON space_booking_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_space_booking_messages_sender ON space_booking_messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_space_booking_messages_read ON space_booking_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_space_booking_messages_created ON space_booking_messages(created_at DESC);

-- Composite index for efficient message retrieval
CREATE INDEX IF NOT EXISTS idx_space_booking_messages_booking_created
  ON space_booking_messages(booking_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 3. TRIGGER FOR UPDATED_AT
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS update_space_booking_messages_timestamp ON space_booking_messages;
CREATE TRIGGER update_space_booking_messages_timestamp
  BEFORE UPDATE ON space_booking_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 4. ADD INTERNAL NOTES TO SPACE_BOOKINGS IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_bookings' AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE space_bookings ADD COLUMN internal_notes TEXT;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════
