-- Migration: Add payment_methods field to talents table
-- Version: 003
-- Date: 2026-01-20

-- ============================================================================
-- TALENTS TABLE: Add payment_methods JSONB column
-- ============================================================================

-- Add payment_methods field to store payment methods as JSON array
-- Structure: [{ id, provider, phone, isDefault }]
ALTER TABLE talents
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN talents.payment_methods IS 'JSON array of payment methods: [{ id, provider, phone, isDefault }]';
