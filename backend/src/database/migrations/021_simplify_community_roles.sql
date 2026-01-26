-- Migration: Simplify Community Roles
-- Date: 2026-01-25
--
-- New logic:
-- - ADMIN = All members of the organization that owns the community
-- - MEMBER = All other users who join the community
-- - MODERATOR role is removed

-- Step 1: Convert all MODERATOR to MEMBER (they will be ADMIN if they're org members anyway)
UPDATE community_members
SET role = 'MEMBER'
WHERE role = 'MODERATOR';

-- Step 2: Update org members to be ADMIN in their communities
-- Any user who is a member of the organization that owns the community becomes ADMIN
UPDATE community_members cm
SET role = 'ADMIN'
FROM communities c
JOIN organization_members om ON c.organization_id = om.organization_id
WHERE cm.community_id = c.id
  AND cm.talent_id = om.talent_id
  AND c.organization_id IS NOT NULL;

-- Step 3: Ensure community creators are ADMIN
UPDATE community_members cm
SET role = 'ADMIN'
FROM communities c
WHERE cm.community_id = c.id
  AND cm.talent_id = c.created_by;

-- Step 4: Update the constraint to only allow ADMIN and MEMBER
ALTER TABLE community_members DROP CONSTRAINT IF EXISTS community_members_role_check;
ALTER TABLE community_members ADD CONSTRAINT community_members_role_check
  CHECK (role IN ('ADMIN', 'MEMBER'));

-- Step 5: Update community_invitations table if it has role column
ALTER TABLE community_invitations DROP CONSTRAINT IF EXISTS community_invitations_role_check;
ALTER TABLE community_invitations ADD CONSTRAINT community_invitations_role_check
  CHECK (role IN ('ADMIN', 'MEMBER'));

-- Update any pending invitations with MODERATOR role to MEMBER
UPDATE community_invitations
SET role = 'MEMBER'
WHERE role = 'MODERATOR';

-- Add comment explaining the new role logic
COMMENT ON COLUMN community_members.role IS 'ADMIN = org members, MEMBER = regular users. Role is derived: org members are auto-ADMIN.';
