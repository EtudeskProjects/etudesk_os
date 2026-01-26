import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  canManageMembers as canManageMembersHelper,
  canInviteMembers as canInviteMembersHelper,
  canManageContent as canManageContentHelper,
} from '../types/models';
import { useSpace } from './SpaceContext';
import { useAuth } from './AuthContext';
import { organizationMemberService } from '../services';

interface OrganizationMemberContextType {
  // Data
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  currentUserMember: OrganizationMember | null;
  isLoading: boolean;

  // Role-based permission checks
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canManageContent: boolean;

  // Actions
  inviteMember: (email: string, role: OrganizationRole) => Promise<void>;
  updateMemberRole: (memberId: string, role: OrganizationRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;

  // Refresh
  refreshMembers: () => Promise<void>;
}

const OrganizationMemberContext = createContext<OrganizationMemberContextType | null>(null);

interface OrganizationMemberProviderProps {
  children: ReactNode;
}

export function OrganizationMemberProvider({ children }: OrganizationMemberProviderProps) {
  const { selectedOrgId, isOrganizationSpace } = useSpace();
  const { user } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load members when organization changes
  useEffect(() => {
    if (selectedOrgId && isOrganizationSpace) {
      refreshMembers();
    }
  }, [selectedOrgId, isOrganizationSpace]);

  // Current user member - match by user_id from auth
  const currentUserMember = useMemo(() => {
    if (!isOrganizationSpace || !selectedOrgId || !user?.id) return null;
    // Find member by authenticated user ID
    const memberByUserId = members.find(m => m.organization_id === selectedOrgId && m.user_id === user.id);
    if (memberByUserId) return memberByUserId;
    // Fallback: try to match by email if user_id not found
    const memberByEmail = members.find(m => m.organization_id === selectedOrgId && m.email === user.email);
    if (memberByEmail) return memberByEmail;
    // Last fallback for dev: first OWNER (remove in production)
    return members.find(m => m.organization_id === selectedOrgId && m.role === 'OWNER') || null;
  }, [members, selectedOrgId, isOrganizationSpace, user]);

  // Role-based permission checks
  const canManageMembers = useMemo(() =>
    currentUserMember ? canManageMembersHelper(currentUserMember.role) : false,
  [currentUserMember]);

  const canInviteMembers = useMemo(() =>
    currentUserMember ? canInviteMembersHelper(currentUserMember.role) : false,
  [currentUserMember]);

  const canManageContent = useMemo(() =>
    currentUserMember ? canManageContentHelper(currentUserMember.role) : false,
  [currentUserMember]);

  const inviteMember = useCallback(async (
    email: string,
    role: OrganizationRole
  ) => {
    if (!selectedOrgId || !currentUserMember) return;

    try {
      const response = await organizationMemberService.inviteMember(selectedOrgId, {
        email,
        role,
      });
      setInvitations(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Error inviting member:', error);
      throw error;
    }
  }, [selectedOrgId, currentUserMember]);

  const updateMemberRole = useCallback(async (
    memberId: string,
    role: OrganizationRole
  ) => {
    if (!selectedOrgId) return;

    try {
      const response = await organizationMemberService.updateMember(selectedOrgId, memberId, {
        role,
      });
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, ...response.data } : m
      ));
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  }, [selectedOrgId]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!selectedOrgId) return;

    try {
      await organizationMemberService.removeMember(selectedOrgId, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }, [selectedOrgId]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    if (!selectedOrgId) return;

    try {
      await organizationMemberService.cancelInvitation(selectedOrgId, invitationId);
      setInvitations(prev => prev.map(inv =>
        inv.id === invitationId ? { ...inv, status: 'CANCELLED' as const } : inv
      ));
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw error;
    }
  }, [selectedOrgId]);

  const resendInvitation = useCallback(async (invitationId: string) => {
    if (!selectedOrgId) return;

    try {
      const response = await organizationMemberService.resendInvitation(selectedOrgId, invitationId);
      setInvitations(prev => prev.map(inv =>
        inv.id === invitationId ? { ...inv, ...response.data } : inv
      ));
    } catch (error) {
      console.error('Error resending invitation:', error);
      throw error;
    }
  }, [selectedOrgId]);

  const refreshMembers = useCallback(async () => {
    if (!selectedOrgId) return;

    setIsLoading(true);
    try {
      const [membersResponse, invitationsResponse] = await Promise.all([
        organizationMemberService.getMembers(selectedOrgId),
        organizationMemberService.getInvitations(selectedOrgId),
      ]);
      setMembers(membersResponse.data || []);
      setInvitations(invitationsResponse.data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  const contextValue = useMemo(() => ({
    members: members.filter(m => m.organization_id === selectedOrgId),
    invitations: invitations.filter(i => i.organization_id === selectedOrgId && i.status === 'PENDING'),
    currentUserMember,
    isLoading,
    canManageMembers,
    canInviteMembers,
    canManageContent,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
    resendInvitation,
    refreshMembers,
  }), [
    members,
    invitations,
    selectedOrgId,
    currentUserMember,
    isLoading,
    canManageMembers,
    canInviteMembers,
    canManageContent,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
    resendInvitation,
    refreshMembers,
  ]);

  return (
    <OrganizationMemberContext.Provider value={contextValue}>
      {children}
    </OrganizationMemberContext.Provider>
  );
}

export function useOrganizationMembers() {
  const context = useContext(OrganizationMemberContext);
  if (!context) {
    throw new Error('useOrganizationMembers must be used within OrganizationMemberProvider');
  }
  return context;
}
