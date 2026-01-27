-- Migration: Add organization_id to communities table
-- This allows organizations to own/manage communities
-- Note: hubs table has been replaced with spaces (see migration 030)

-- Add organization_id column to communities table
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add index for organization lookups
CREATE INDEX IF NOT EXISTS idx_communities_organization_id ON communities(organization_id);
