import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { organizationService } from '../services/organizationService';
import { Organization as OrgModel } from '../types/models';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS } from '../constants/config';

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
  const restoredFromStorage = useRef(false);
  const lastUserId = useRef<string | null>(null);

  const mapOrganization = (org: OrgModel): UserOrganization => ({
    id: org.id,
    name: org.name,
    type: (org.types && org.types.length > 0 ? org.types[0] : org.type) || 'COMPANY',
    logoUrl: org.logo_url,
    role: (org.user_role?.toUpperCase() || 'MEMBER') as 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER',
  });

  // Persist space choice to AsyncStorage
  const persistSpace = useCallback(async (type: SpaceType, orgId: string | null) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SPACE, type);
      if (orgId) {
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_ORG_ID, orgId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_ORG_ID);
      }
    } catch (error) {
      console.error('[Space] Failed to persist space:', error);
    }
  }, []);

  // Restore saved space from AsyncStorage
  const restoreSavedSpace = useCallback(async (): Promise<{ space: SpaceType | null; orgId: string | null }> => {
    try {
      const [savedSpace, savedOrgId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SPACE),
        AsyncStorage.getItem(STORAGE_KEYS.SELECTED_ORG_ID),
      ]);
      if (savedSpace === 'talent' || savedSpace === 'organization') {
        return { space: savedSpace, orgId: savedOrgId };
      }
      return { space: null, orgId: null };
    } catch (error) {
      console.error('[Space] Failed to restore space:', error);
      return { space: null, orgId: null };
    }
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.getMyOrganizations();
      if (response.data) {
        const orgs = response.data.map(mapOrganization);
        setUserOrganizations(orgs);

        // Restore saved preference or auto-select on first-ever login
        const saved = await restoreSavedSpace();

        if (saved.space && restoredFromStorage.current) {
          // Already restored this session, do nothing
        } else if (saved.space) {
          // User had a saved preference — restore it
          restoredFromStorage.current = true;
          if (saved.space === 'organization' && saved.orgId) {
            const orgStillExists = orgs.some(o => o.id === saved.orgId);
            if (orgStillExists) {
              setCurrentSpace('organization');
              setSelectedOrgId(saved.orgId);
            } else if (orgs.length > 0) {
              // Saved org no longer accessible, fallback to first org
              setCurrentSpace('organization');
              setSelectedOrgId(orgs[0].id);
              await persistSpace('organization', orgs[0].id);
            } else {
              // No orgs available, fallback to talent
              setCurrentSpace('talent');
              setSelectedOrgId(null);
              await persistSpace('talent', null);
            }
          } else {
            // Saved preference is talent
            setCurrentSpace('talent');
            setSelectedOrgId(null);
          }
        } else {
          // No saved preference (first-ever login) — auto-select first org
          restoredFromStorage.current = true;
          if (orgs.length > 0) {
            const firstOrg = orgs[0];
            setCurrentSpace('organization');
            setSelectedOrgId(firstOrg.id);
            await persistSpace('organization', firstOrg.id);
          }
        }
      }
    } catch (error) {
      console.error('[Space] Failed to load organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [restoreSavedSpace, persistSpace]);

  // Reset on user change (different account)
  useEffect(() => {
    const currentUserId = user?.id || null;

    if (lastUserId.current !== null && lastUserId.current !== currentUserId) {
      setCurrentSpace('talent');
      setSelectedOrgId(null);
      setUserOrganizations([]);
      restoredFromStorage.current = false;
    }

    lastUserId.current = currentUserId;
  }, [user?.id]);

  // Fetch orgs on auth
  useEffect(() => {
    if (status === 'authenticated' && user?.id) {
      fetchOrganizations();
    } else if (status === 'unauthenticated') {
      setUserOrganizations([]);
      setSelectedOrgId(null);
      setCurrentSpace('talent');
      restoredFromStorage.current = false;
      setIsLoading(false);
    }
  }, [status, user?.id, fetchOrganizations]);

  const selectedOrg = selectedOrgId
    ? userOrganizations.find(org => org.id === selectedOrgId) || null
    : null;

  const setSpace = (type: SpaceType, orgId?: string) => {
    const resolvedOrgId = type === 'organization' && orgId ? orgId : null;
    setCurrentSpace(type);
    setSelectedOrgId(resolvedOrgId);
    persistSpace(type, resolvedOrgId);
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
