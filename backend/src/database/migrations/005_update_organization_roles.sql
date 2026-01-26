-- Migration: Update organization member roles from EDITOR/VIEWER to MANAGER/MEMBER
-- Version: 005
-- Date: 2026-01-20

-- ============================================================================
-- UPDATE ORGANIZATION_MEMBERS TABLE
-- ============================================================================

-- 1. First update existing data
UPDATE organization_members SET role = 'MANAGER' WHERE role = 'EDITOR';
UPDATE organization_members SET role = 'MEMBER' WHERE role = 'VIEWER';

-- 2. Drop old constraint and add new one
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER'));

-- 3. Update default value
ALTER TABLE organization_members ALTER COLUMN role SET DEFAULT 'MEMBER';

-- ============================================================================
-- UPDATE ORGANIZATION_INVITATIONS TABLE
-- ============================================================================

-- 1. First update existing data
UPDATE organization_invitations SET role = 'MANAGER' WHERE role = 'EDITOR';
UPDATE organization_invitations SET role = 'MEMBER' WHERE role = 'VIEWER';

-- 2. Drop old constraint and add new one
ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_role_check
    CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER'));

-- 3. Update default value
ALTER TABLE organization_invitations ALTER COLUMN role SET DEFAULT 'MEMBER';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN organization_members.role IS 'Member role: OWNER (full access), ADMIN (almost full), MANAGER (content management), MEMBER (read-only)';
COMMENT ON COLUMN organization_invitations.role IS 'Role to assign when invitation is accepted: ADMIN, MANAGER, or MEMBER';
