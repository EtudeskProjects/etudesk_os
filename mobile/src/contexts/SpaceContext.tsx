import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { organizationService } from '../services/organizationService';
import { Organization as OrgModel } from '../types/models';
import { useAuth } from './AuthContext';

type SpaceType = 'talent' | 'organization';

interface UserOrganization {
  id: string;
  name: string;
  type: string;
  logoUrl?: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
}

interface SpaceContextType {
  currentSpace: SpaceType;
  selectedOrgId: string | null;
  selectedOrg: UserOrganization | null;
  userOrganizations: UserOrganization[];
  setSpace: (type: SpaceType, orgId?: string) => void;
  isOrganizationSpace: boolean;
  isLoading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [currentSpace, setCurrentSpace] = useState<SpaceType>('talent');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasAutoSelected = useRef(false);
  const lastUserId = useRef<string | null>(null);

  const mapOrganization = (org: OrgModel): UserOrganization => ({
    id: org.id,
    name: org.name,
    type: (org.types && org.types.length > 0 ? org.types[0] : org.type) || 'COMPANY',
    logoUrl: org.logo_url,
    role: (org.user_role?.toUpperCase() || 'MEMBER') as 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER',
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.getMyOrganizations();
      if (response.data) {
        const orgs = response.data.map(mapOrganization);
        setUserOrganizations(orgs);

        // Auto-select first organization if user has organizations and hasn't been auto-selected yet
        if (orgs.length > 0 && !hasAutoSelected.current) {
          const firstOrg = orgs[0];
          setCurrentSpace('organization');
          setSelectedOrgId(firstOrg.id);
          hasAutoSelected.current = true;
        }
      }
    } catch (error) {
      console.error('[Space] Failed to load organizations:', error);
      // Keep existing organizations if fetch fails
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentUserId = user?.id || null;

    if (lastUserId.current !== null && lastUserId.current !== currentUserId) {
      setCurrentSpace('talent');
      setSelectedOrgId(null);
      setUserOrganizations([]);
      hasAutoSelected.current = false;
    }

    lastUserId.current = currentUserId;
  }, [user?.id]);

  useEffect(() => {
    if (status === 'authenticated' && user?.id) {
      fetchOrganizations();
    } else if (status === 'unauthenticated') {
      setUserOrganizations([]);
      setSelectedOrgId(null);
      setCurrentSpace('talent');
      hasAutoSelected.current = false;
      setIsLoading(false);
    }
  }, [status, user?.id, fetchOrganizations]);

  const selectedOrg = selectedOrgId
    ? userOrganizations.find(org => org.id === selectedOrgId) || null
    : null;

  const setSpace = (type: SpaceType, orgId?: string) => {
    setCurrentSpace(type);
    setSelectedOrgId(type === 'organization' && orgId ? orgId : null);
  };

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const value: SpaceContextType = {
    currentSpace,
    selectedOrgId,
    selectedOrg,
    userOrganizations,
    setSpace,
    isOrganizationSpace: currentSpace === 'organization',
    isLoading,
    refreshOrganizations,
  };

  return (
    <SpaceContext.Provider value={value}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (context === undefined) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
}
