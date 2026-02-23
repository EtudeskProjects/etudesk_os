-- Migration: Rename OBSERVATEUR role to OBSERVER (language-neutral key)
-- Affects: organization_members, organization_invitations

UPDATE organization_members SET role = 'OBSERVER' WHERE role = 'OBSERVATEUR';
UPDATE organization_invitations SET role = 'OBSERVER' WHERE role = 'OBSERVATEUR';
