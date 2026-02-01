-- Migration: 047_kyc_verifications
-- Create kyc_verifications table required by kyc routes

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    front_image_url TEXT,
    back_image_url TEXT,
    verification_score NUMERIC(5,2),
    verification_details JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent ON kyc_verifications(talent_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);
