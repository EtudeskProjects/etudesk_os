-- Migration: 045_org_member_roles_fix
-- Fix organization_members role constraint to include OBSERVATEUR

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'OBSERVATEUR'));
