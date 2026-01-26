-- Migration: Add organization_id to communities and hubs tables
-- This allows organizations to own/manage communities and hubs

-- Add organization_id column to communities table
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add index for organization lookups
CREATE INDEX IF NOT EXISTS idx_communities_organization_id ON communities(organization_id);

-- Add organization_id column to hubs table
ALTER TABLE hubs
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add index for organization lookups
CREATE INDEX IF NOT EXISTS idx_hubs_organization_id ON hubs(organization_id);

-- Add created_by column to hubs table (for consistency with other tables)
ALTER TABLE hubs
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES talents(id) ON DELETE SET NULL;
