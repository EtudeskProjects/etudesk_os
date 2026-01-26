-- Migration: Add verification score and details fields to kyc_verifications
-- Version: 004
-- Date: 2026-01-20

-- ============================================================================
-- KYC_VERIFICATIONS TABLE: Add AI verification fields
-- ============================================================================

-- Add verification_score field (0-100)
ALTER TABLE kyc_verifications
ADD COLUMN IF NOT EXISTS verification_score INTEGER;

-- Add verification_details JSONB for storing detailed analysis
ALTER TABLE kyc_verifications
ADD COLUMN IF NOT EXISTS verification_details JSONB;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN kyc_verifications.verification_score IS 'AI verification confidence score (0-100)';
COMMENT ON COLUMN kyc_verifications.verification_details IS 'Detailed verification analysis from Gemini Vision';
