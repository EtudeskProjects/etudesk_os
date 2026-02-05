-- Migration 006: Add permissions to organization_members
-- Fixes error: column "permissions" of relation "organization_members" does not exist

ALTER TABLE organization_members ADD COLUMN permissions TEXT[] DEFAULT '{}';

-- Update existing owners to have all permissions if necessary
UPDATE organization_members 
SET permissions = ARRAY['organization:*', 'members:*', 'opportunities:*', 'billing:*']
WHERE role = 'OWNER' AND (permissions IS NULL OR permissions = '{}');
