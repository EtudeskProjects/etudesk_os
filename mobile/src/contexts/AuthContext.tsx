/**
 * AuthContext - Centralized authentication state management
 * Handles user authentication, session persistence, and auth flow
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { User } from '../types/models';
import { otpService } from '../services/otpService';
import { onboardingService } from '../services/onboardingService';
import { logger } from '../services/logService';

const LOG_SOURCE = 'Auth';


export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  isLoading: boolean;
  needsOnboarding: boolean;
}

interface AuthContextType extends AuthState {
  // Actions
  signIn: (email: string, code: string) => Promise<boolean>;
  signInWhatsApp: (phone: string, code: string) => Promise<boolean>;
  signInGoogle: (idToken: string) => Promise<boolean>;
  signOut: (allDevices?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => void;
  // Helpers
  hasOrganizationAccess: (orgId: string) => boolean;
  getUserOrganizationRole: (orgId: string) => string | null;
}

// Storage keys
const STORAGE_KEYS = {
  ONBOARDING_SHOWN: 'onboarding_shown',
};

// --- Context ---

const AuthContext = createContext<AuthContextType | null>(null);

// --- Provider ---

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    isLoading: true,
    needsOnboarding: false,
  });

  const router = useRouter();
  const segments = useSegments();

  // INITIALIZATION - Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // NAVIGATION GUARD - Redirect based on auth state
  useEffect(() => {
    if (state.status === 'loading') return;

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';
    const isOnboarding = segments[0] === undefined; // index.tsx
    const isWelcomePage = inAuthGroup && segments[1] === 'welcome';

    if (state.status === 'unauthenticated') {
      // Not authenticated - allow auth screens and onboarding
      if (inTabsGroup || segments[0] === 'settings' || segments[0] === 'details' || segments[0] === 'gestion') {
        // Trying to access protected route - redirect to login
        router.replace('/auth/login');
      }
    } else if (state.status === 'authenticated') {
      // Authenticated
      if (state.needsOnboarding) {
        // Need to complete profile
        if (!inAuthGroup || segments[1] !== 'create-profile') {
          router.replace('/auth/create-profile');
        }
      } else {
        // Fully authenticated with profile
        // Allow welcome page to be shown after onboarding
        // Also allow create-profile page to handle its own navigation to welcome
        const isCreateProfilePage = inAuthGroup && segments[1] === 'create-profile';
        if ((inAuthGroup && !isWelcomePage && !isCreateProfilePage) || isOnboarding) {
          // On auth screen (except welcome/create-profile) or onboarding but already logged in - go to main app
          router.replace('/(tabs)/home');
        }
      }
    }
  }, [state.status, state.needsOnboarding, segments]);

  // CHECK AUTH STATE
  const checkAuthState = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Check if user has token
      const isAuth = await otpService.isAuthenticated();

      if (!isAuth) {
        logger.debug(LOG_SOURCE, 'No token found, user is unauthenticated');
        setState({
          status: 'unauthenticated',
          user: null,
          isLoading: false,
          needsOnboarding: false,
        });
        return;
      }

      // Get user from storage first (faster)
      let user = await otpService.getUser();
      logger.debug(LOG_SOURCE, 'User from storage', user ? { userId: user.id } : { userId: null });

      // Try to refresh from server
      try {
        const freshUser = await otpService.getCurrentUser();
        if (freshUser) {
          user = freshUser;
          logger.debug(LOG_SOURCE, 'Fresh user from API', { userId: freshUser.id });
        }
      } catch (error) {
        logger.warn(LOG_SOURCE, 'Could not fetch fresh user, using cached data');
      }

      if (!user) {
        // No user data available, clear auth
        logger.warn(LOG_SOURCE, 'No user data available, logging out');
        await otpService.logout();
        setState({
          status: 'unauthenticated',
          user: null,
          isLoading: false,
          needsOnboarding: false,
        });
        return;
      }

      // Check onboarding status
      // Priority: 1. Local user data, 2. API call (if local data is unclear)
      let needsOnboarding = false;

      // If user explicitly has talent profile or completed onboarding, they don't need onboarding
      if (user.hasTalentProfile === true || user.onboardingComplete === true || user.talentId) {
        needsOnboarding = false;
        logger.debug(LOG_SOURCE, 'User has completed onboarding (local check)');
      } else if (user.hasTalentProfile === false || user.onboardingComplete === false) {
        // Explicitly marked as incomplete
        needsOnboarding = true;
        logger.debug(LOG_SOURCE, 'User needs onboarding (local check)');
      } else {
        // Unclear from local data, try API
        logger.debug(LOG_SOURCE, 'Onboarding status unclear, checking API...');
        try {
          const onboardingStatus = await onboardingService.getStatus();
          if (onboardingStatus.data?.onboarding) {
            needsOnboarding = !onboardingStatus.data.onboarding.isComplete;
            logger.debug(LOG_SOURCE, 'Onboarding status from API', { isComplete: !needsOnboarding });
          } else {
            // API returned but no clear status - assume complete to avoid loops
            needsOnboarding = false;
            logger.debug(LOG_SOURCE, 'API returned unclear status, assuming complete');
          }
        } catch (error) {
          // API failed - assume complete to avoid loops (better UX)
          needsOnboarding = false;
          logger.warn(LOG_SOURCE, 'Could not fetch onboarding status, assuming complete');
        }
      }

      setState({
        status: 'authenticated',
        user: user as User,
        isLoading: false,
        needsOnboarding,
      });

      logger.info(LOG_SOURCE, 'Auth state initialized', { status: 'authenticated', needsOnboarding, userId: user.id });
    } catch (error) {
      logger.error(LOG_SOURCE, 'Error checking auth state', error);
      setState({
        status: 'unauthenticated',
        user: null,
        isLoading: false,
        needsOnboarding: false,
      });
    }
  };

  // SIGN IN
  const signIn = useCallback(async (email: string, code: string): Promise<boolean> => {
    try {
      logger.debug(LOG_SOURCE, 'Attempting sign in', { email });
      const result = await otpService.verifyOTP(email, code);

      if (result.success) {
        logger.info(LOG_SOURCE, 'Sign in successful', { email, needsOnboarding: result.needsOnboarding });
        await checkAuthState();
        return true;
      }

      logger.warn(LOG_SOURCE, 'Sign in failed - invalid OTP', { email });
      return false;
    } catch (error) {
      logger.error(LOG_SOURCE, 'Sign in error', error, { email });
      return false;
    }
  }, []);

  const signInWhatsApp = useCallback(async (phone: string, code: string): Promise<boolean> => {
    try {
      logger.debug(LOG_SOURCE, 'Attempting WhatsApp sign in', { phone });
      const result = await otpService.verifyWhatsAppOTP(phone, code);

      if (result.success) {
        logger.info(LOG_SOURCE, 'WhatsApp sign in successful', { phone, needsOnboarding: result.needsOnboarding });
        await checkAuthState();
        return true;
      }

      logger.warn(LOG_SOURCE, 'WhatsApp sign in failed - invalid OTP', { phone });
      return false;
    } catch (error) {
      logger.error(LOG_SOURCE, 'WhatsApp sign in error', error, { phone });
      return false;
    }
  }, []);

  // SIGN IN WITH GOOGLE
  const signInGoogle = useCallback(async (idToken: string): Promise<boolean> => {
    try {
      logger.debug(LOG_SOURCE, 'Attempting Google sign in');
      const result = await otpService.signInWithGoogle(idToken);

      if (result.success) {
        logger.info(LOG_SOURCE, 'Google sign in successful', { needsOnboarding: result.needsOnboarding });
        await checkAuthState();
        return true;
      }

      logger.warn(LOG_SOURCE, 'Google sign in failed');
      return false;
    } catch (error) {
      logger.error(LOG_SOURCE, 'Google sign in error', error);
      return false;
    }
  }, []);

  // SIGN OUT
  const signOut = useCallback(async (allDevices: boolean = false) => {
    try {
      logger.info(LOG_SOURCE, 'Signing out', { allDevices });
      await otpService.logout(allDevices);
      logger.info(LOG_SOURCE, 'Sign out successful');
    } catch (error) {
      logger.error(LOG_SOURCE, 'Sign out error', error);
    } finally {
      setState({
        status: 'unauthenticated',
        user: null,
        isLoading: false,
        needsOnboarding: false,
      });
      router.replace('/auth/login');
    }
  }, [router]);

  // REFRESH USER
  const refreshUser = useCallback(async () => {
    const freshUser = await otpService.getCurrentUser();
    if (freshUser) {
      setState(prev => ({
        ...prev,
        user: freshUser as User,
      }));
    }
  }, []);

  // COMPLETE ONBOARDING
  const completeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      needsOnboarding: false,
      user: prev.user ? { ...prev.user, hasTalentProfile: true, onboardingComplete: true } : null,
    }));
    // Proactively refresh user data from server to get full profile (firstName, lastName, etc.)
    refreshUser();
  }, [refreshUser]);

  // ORGANIZATION HELPERS
  const hasOrganizationAccess = useCallback((orgId: string): boolean => {
    if (!state.user?.organizationMemberships) return false;
    return state.user.organizationMemberships.some(m => m.organizationId === orgId);
  }, [state.user]);

  const getUserOrganizationRole = useCallback((orgId: string): string | null => {
    if (!state.user?.organizationMemberships) return null;
    const membership = state.user.organizationMemberships.find(m => m.organizationId === orgId);
    return membership?.role || null;
  }, [state.user]);

  // CONTEXT VALUE
  const contextValue: AuthContextType = {
    ...state,
    signIn,
    signInWhatsApp,
    signInGoogle,
    signOut,
    refreshUser,
    completeOnboarding,
    hasOrganizationAccess,
    getUserOrganizationRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// --- Protected Route Component ---

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status, isLoading } = useAuth();

  if (isLoading || status === 'loading') {
    return null; // Or a loading spinner
  }

  if (status === 'unauthenticated') {
    return null; // Navigation guard will redirect
  }

  return <>{children}</>;
}
