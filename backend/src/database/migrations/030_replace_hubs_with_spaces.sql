-- Migration 030: Replace Hubs with Spaces
-- Spaces are bookable rooms/areas directly linked to Organizations
-- This migration removes the Hub abstraction layer

-- ═══════════════════════════════════════════════════════════════
-- 1. DROP OLD HUB-RELATED TABLES
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS hub_bookings CASCADE;
DROP TABLE IF EXISTS hub_skills CASCADE;
DROP TABLE IF EXISTS organization_hubs CASCADE;
DROP TABLE IF EXISTS hubs CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE SPACES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,

  -- Type & Category
  type VARCHAR(50) NOT NULL,  -- SALLE_REUNION, SALLE_FORMATION, AMPHITHEATRE, etc.

  -- Physical Characteristics
  surface_m2 DECIMAL(10, 2) NOT NULL,
  capacity INTEGER NOT NULL,
  floor_number SMALLINT DEFAULT 0,  -- 0 = RDC, -1 = sous-sol, 1+ = étages

  -- Location (inherited from organization or specific)
  address TEXT,
  city VARCHAR(100),
  region VARCHAR(100),
  country CHAR(2) DEFAULT 'CI',
  coordinates POINT,

  -- Equipment & Amenities
  equipment TEXT[] DEFAULT '{}',  -- ["Vidéoprojecteur", "Tableau blanc", "Climatisation"]
  amenities TEXT[] DEFAULT '{}',  -- ["WIFI", "PARKING", "CAFETERIA"]

  -- Accessibility
  is_accessible BOOLEAN DEFAULT false,
  accessibility_features TEXT[] DEFAULT '{}',
  accessibility_notes TEXT,

  -- Media
  cover_image_url TEXT,
  gallery_images TEXT[] DEFAULT '{}',

  -- Pricing (all in FCFA)
  hourly_rate DECIMAL(12, 2),      -- Prix par heure
  daily_rate DECIMAL(12, 2),       -- Prix par jour
  weekly_rate DECIMAL(12, 2),      -- Prix par semaine
  monthly_rate DECIMAL(12, 2),     -- Prix par mois
  deposit_amount DECIMAL(12, 2),   -- Caution

  -- Booking Settings
  is_bookable BOOLEAN DEFAULT true,
  min_booking_hours INTEGER DEFAULT 1,
  max_booking_hours INTEGER DEFAULT 24,
  advance_booking_days INTEGER DEFAULT 30,  -- Réservation max X jours à l'avance
  cancellation_hours INTEGER DEFAULT 24,    -- Annulation gratuite X heures avant

  -- Contact
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),

  -- Relations
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES talents(id),

  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, MAINTENANCE

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for spaces
CREATE INDEX IF NOT EXISTS idx_spaces_organization ON spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_spaces_type ON spaces(type);
CREATE INDEX IF NOT EXISTS idx_spaces_city ON spaces(city);
CREATE INDEX IF NOT EXISTS idx_spaces_country ON spaces(country);
CREATE INDEX IF NOT EXISTS idx_spaces_status ON spaces(status);
CREATE INDEX IF NOT EXISTS idx_spaces_is_bookable ON spaces(is_bookable);
CREATE INDEX IF NOT EXISTS idx_spaces_capacity ON spaces(capacity);
CREATE INDEX IF NOT EXISTS idx_spaces_deleted_at ON spaces(deleted_at);
CREATE INDEX IF NOT EXISTS idx_spaces_slug ON spaces(slug);

-- GIN indexes for array fields
CREATE INDEX IF NOT EXISTS idx_spaces_equipment ON spaces USING GIN(equipment);
CREATE INDEX IF NOT EXISTS idx_spaces_amenities ON spaces USING GIN(amenities);
CREATE INDEX IF NOT EXISTS idx_spaces_accessibility ON spaces USING GIN(accessibility_features);

-- ═══════════════════════════════════════════════════════════════
-- 3. CREATE SPACE AVAILABILITIES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS space_availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,

  -- Recurring availability (weekly pattern)
  day_of_week SMALLINT NOT NULL,  -- 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
  start_time TIME NOT NULL,       -- 08:00
  end_time TIME NOT NULL,         -- 18:00

  -- Validity period
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,  -- NULL = indefinitely

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: no overlapping availabilities for same day
  CONSTRAINT unique_space_day_availability UNIQUE(space_id, day_of_week, start_time, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_space_availabilities_space ON space_availabilities(space_id);
CREATE INDEX IF NOT EXISTS idx_space_availabilities_day ON space_availabilities(day_of_week);
CREATE INDEX IF NOT EXISTS idx_space_availabilities_active ON space_availabilities(is_active);

-- ═══════════════════════════════════════════════════════════════
-- 4. CREATE SPACE UNAVAILABILITIES TABLE (blocked dates)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS space_unavailabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,

  -- Blocked period
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

  reason VARCHAR(50),  -- MAINTENANCE, HOLIDAY, PRIVATE_EVENT, OTHER
  notes TEXT,

  created_by UUID REFERENCES talents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_space_unavailabilities_space ON space_unavailabilities(space_id);
CREATE INDEX IF NOT EXISTS idx_space_unavailabilities_dates ON space_unavailabilities(start_datetime, end_datetime);

-- ═══════════════════════════════════════════════════════════════
-- 5. CREATE SPACE BOOKINGS TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS space_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  talent_id UUID NOT NULL REFERENCES talents(id),

  -- Booking Period
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Booking Details
  purpose TEXT,                    -- "Formation React Native"
  attendees_count INTEGER,
  special_requests TEXT,

  -- Pricing (calculated at booking time)
  pricing_type VARCHAR(20) NOT NULL,  -- HOURLY, DAILY, WEEKLY, MONTHLY
  unit_price DECIMAL(12, 2) NOT NULL,
  units_count DECIMAL(5, 2) NOT NULL, -- 2.5 hours, 3 days, etc.
  subtotal DECIMAL(12, 2) NOT NULL,
  deposit_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,

  -- Payment
  payment_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PARTIAL, PAID, REFUNDED
  payment_method VARCHAR(20),     -- PAYSTACK, WAVE, ORANGE_MONEY, CASH
  payment_reference VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Booking Status
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES talents(id),

  -- Cancellation
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES talents(id),
  cancellation_reason TEXT,
  refund_amount DECIMAL(12, 2),

  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  rating SMALLINT,  -- 1-5 stars
  review TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_space_bookings_space ON space_bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_space_bookings_organization ON space_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_space_bookings_talent ON space_bookings(talent_id);
CREATE INDEX IF NOT EXISTS idx_space_bookings_status ON space_bookings(status);
CREATE INDEX IF NOT EXISTS idx_space_bookings_payment ON space_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_space_bookings_dates ON space_bookings(start_datetime, end_datetime);

-- Prevent double bookings (no overlapping confirmed bookings for same space)
DROP INDEX IF EXISTS idx_space_no_double_booking;
CREATE UNIQUE INDEX idx_space_no_double_booking
ON space_bookings(space_id, start_datetime, end_datetime)
WHERE status IN ('PENDING', 'CONFIRMED');

-- ═══════════════════════════════════════════════════════════════
-- 6. UPDATE BOOKMARKS TABLE FOR SPACES
-- ═══════════════════════════════════════════════════════════════

-- Remove hub bookmarks if bookmarks table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookmarks' AND table_schema = 'public') THEN
    DELETE FROM bookmarks WHERE entity_type = 'hub';
  END IF;
END $$;

-- The bookmarks table already supports multiple entity types
-- Just need to use 'space' instead of 'hub' in application code

-- ═══════════════════════════════════════════════════════════════
-- 7. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to check if a space is available for a given time slot
CREATE OR REPLACE FUNCTION is_space_available(
  p_space_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict_count INTEGER;
  v_unavailable_count INTEGER;
BEGIN
  -- Check for conflicting bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM space_bookings
  WHERE space_id = p_space_id
    AND status IN ('PENDING', 'CONFIRMED')
    AND (
      (start_datetime <= p_start AND end_datetime > p_start) OR
      (start_datetime < p_end AND end_datetime >= p_end) OR
      (start_datetime >= p_start AND end_datetime <= p_end)
    );

  IF v_conflict_count > 0 THEN
    RETURN FALSE;
  END IF;

  -- Check for unavailability blocks
  SELECT COUNT(*) INTO v_unavailable_count
  FROM space_unavailabilities
  WHERE space_id = p_space_id
    AND (
      (start_datetime <= p_start AND end_datetime > p_start) OR
      (start_datetime < p_end AND end_datetime >= p_end) OR
      (start_datetime >= p_start AND end_datetime <= p_end)
    );

  RETURN v_unavailable_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate booking price
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_space_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE
) RETURNS TABLE(
  pricing_type VARCHAR(20),
  unit_price DECIMAL(12, 2),
  units_count DECIMAL(5, 2),
  subtotal DECIMAL(12, 2),
  deposit DECIMAL(12, 2),
  total DECIMAL(12, 2)
) AS $$
DECLARE
  v_space spaces%ROWTYPE;
  v_hours DECIMAL(5, 2);
  v_days DECIMAL(5, 2);
BEGIN
  SELECT * INTO v_space FROM spaces WHERE id = p_space_id;

  v_hours := EXTRACT(EPOCH FROM (p_end - p_start)) / 3600;
  v_days := v_hours / 24;

  -- Determine best pricing (monthly > weekly > daily > hourly)
  IF v_days >= 28 AND v_space.monthly_rate IS NOT NULL THEN
    pricing_type := 'MONTHLY';
    unit_price := v_space.monthly_rate;
    units_count := CEIL(v_days / 30);
  ELSIF v_days >= 7 AND v_space.weekly_rate IS NOT NULL THEN
    pricing_type := 'WEEKLY';
    unit_price := v_space.weekly_rate;
    units_count := CEIL(v_days / 7);
  ELSIF v_days >= 1 AND v_space.daily_rate IS NOT NULL THEN
    pricing_type := 'DAILY';
    unit_price := v_space.daily_rate;
    units_count := CEIL(v_days);
  ELSE
    pricing_type := 'HOURLY';
    unit_price := COALESCE(v_space.hourly_rate, 0);
    units_count := CEIL(v_hours);
  END IF;

  subtotal := unit_price * units_count;
  deposit := COALESCE(v_space.deposit_amount, 0);
  total := subtotal + deposit;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 8. TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Update timestamp trigger for spaces
DROP TRIGGER IF EXISTS update_spaces_timestamp ON spaces;
CREATE TRIGGER update_spaces_timestamp
  BEFORE UPDATE ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for availabilities
DROP TRIGGER IF EXISTS update_space_availabilities_timestamp ON space_availabilities;
CREATE TRIGGER update_space_availabilities_timestamp
  BEFORE UPDATE ON space_availabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for bookings
DROP TRIGGER IF EXISTS update_space_bookings_timestamp ON space_bookings;
CREATE TRIGGER update_space_bookings_timestamp
  BEFORE UPDATE ON space_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════
