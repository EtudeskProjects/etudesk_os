/**
 * OTP Service for passwordless email authentication
 * Connects to backend API for OTP generation and verification
 *
 * Mailhog Configuration (development):
 * - SMTP Server: localhost:1025
 * - Web UI: http://localhost:8025
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { logger } from './logService';
import { clearPersistentCache } from './persistentCache';
import { STORAGE_KEYS } from '../constants/config';
import i18n from '../i18n';

const LOG_SOURCE = 'OTP';

// Configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

/**
 * Send OTP code to email address via backend API
 */
async function sendOTP(email: string): Promise<void> {
  try {
    await api.publicPost<{ success?: boolean; error?: string }>('/auth/request-otp', {
      email: email.toLowerCase(),
    });

    logger.info(LOG_SOURCE, `OTP sent to ${email}`);
    if (__DEV__) {
      logger.debug(LOG_SOURCE, 'Check Mailhog at http://localhost:8025');
    }
  } catch (error: any) {
    logger.error(LOG_SOURCE, 'Failed to send OTP', error, { email });
    throw new Error(error?.error || i18n.t('otpService.sendError'));
  }
}

async function sendWhatsAppOTP(phone: string): Promise<void> {
  try {
    await api.publicPost<{ success?: boolean; error?: string }>('/auth/request-otp', {
      phone,
      channel: 'whatsapp',
    });

    logger.info(LOG_SOURCE, `WhatsApp OTP sent to ${phone}`);
  } catch (error: any) {
    logger.error(LOG_SOURCE, 'Failed to send WhatsApp OTP', error, { phone });
    throw new Error(error?.error || i18n.t('otpService.sendError'));
  }
}

/**
 * Result of OTP verification
 */
interface VerifyOTPResult {
  success: boolean;
  needsOnboarding: boolean;
  user?: AuthUser;
}

interface AuthUser {
  id?: string;
  email?: string | null;
  phone?: string | null;
  preferredLanguage?: string | null;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  hasTalentProfile?: boolean;
  onboardingComplete?: boolean;
  talentId?: string;
  authMethod?: string;
  [key: string]: unknown;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthSessionPayload {
  success?: boolean;
  needsOnboarding?: boolean;
  user?: AuthUser;
  tokens?: AuthTokens;
  authMethod?: string;
  error?: string;
}

/**
 * Verify OTP code for email address
 * Returns verification result with needsOnboarding flag
 */
async function verifyOTP(email: string, code: string): Promise<VerifyOTPResult> {
  try {
    const { ok, status, data } = await api.rawRequest<AuthSessionPayload>('POST', '/auth/verify-otp', {
      email: email.toLowerCase(),
      code,
    });

    if (!ok) {
      logger.apiError(LOG_SOURCE, status, data.error || 'OTP verification failed', '/api/auth/verify-otp');
      return { success: false, needsOnboarding: false };
    }

    if (data.success && data.tokens) {
      const stored = await storeAuthSession(data);
      if (!stored) {
        return { success: false, needsOnboarding: false };
      }

      logger.info(LOG_SOURCE, 'Authentication successful', {
        email,
        needsOnboarding: data.needsOnboarding,
        hasTalentProfile: data.user?.hasTalentProfile
      });

      return {
        success: true,
        needsOnboarding: data.needsOnboarding ?? false,
        user: data.user
      };
    }

    return { success: false, needsOnboarding: false };
  } catch (error) {
    logger.error(LOG_SOURCE, 'OTP verification error', error, { email });
    return { success: false, needsOnboarding: false };
  }
}

async function storeAuthSession(data: AuthSessionPayload): Promise<boolean> {
  if (!data.tokens?.accessToken || !data.tokens?.refreshToken) {
    logger.error(LOG_SOURCE, 'Invalid tokens received from server', {
      hasAccessToken: !!data.tokens?.accessToken,
      hasRefreshToken: !!data.tokens?.refreshToken,
    });
    return false;
  }

  const stored = await api.persistAuthSession({
    tokens: data.tokens,
    user: data.user,
    needsOnboarding: data.needsOnboarding,
    authMethod: data.authMethod,
  });

  if (stored) {
    logger.debug(LOG_SOURCE, 'Auth session stored successfully');
  } else {
    logger.error(LOG_SOURCE, 'Failed to persist auth session');
  }

  return stored;
}

/**
 * Get stored access token
 */
async function getAccessToken(): Promise<string | null> {
  return api.getToken();
}

/**
 * Get stored user info
 */
async function getUser(): Promise<AuthUser | null> {
  return api.getUser();
}

/**
 * Logout - call backend and clear all stored auth data
 */
async function logout(allDevices: boolean = false): Promise<void> {
  try {
    const accessToken = await api.getToken();
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (accessToken && refreshToken) {
      // Call backend logout endpoint
      await api.post('/auth/logout', { refreshToken, allDevices });
    }
  } catch (error) {
    logger.warn(LOG_SOURCE, 'Logout API call failed (continuing with local logout)', { error });
    // Continue with local logout even if API fails
  }

  // Clear auth-related storage keys
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.ONBOARDING_SEEN,
  ]);
  logger.info(LOG_SOURCE, 'Cleared auth storage keys on logout');
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

/**
 * Get current user profile from backend
 * Also updates local storage with latest data
 */
async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const token = await api.getToken();
    if (!token) return null;

    const response = await api.get<{ user?: Record<string, unknown> }>('/auth/me');
    const user = response.data?.user ?? null;

    if (user) {
      await api.storeUser(user);
      logger.debug(LOG_SOURCE, 'User profile refreshed', { userId: user.id });
    }

    return user;
  } catch (error: any) {
    if (error?.status === 401) {
      logger.warn(LOG_SOURCE, 'Token expired and refresh failed, returning null');
      return null;
    }
    logger.error(LOG_SOURCE, 'Get current user error', error);
    return null;
  }
}

/**
 * Sign in with Google OAuth ID token
 */
async function signInWithGoogle(idToken: string): Promise<VerifyOTPResult> {
  try {
    const { ok, status, data } = await api.rawRequest<AuthSessionPayload>('POST', '/auth/google', { idToken });

    if (!ok) {
      logger.apiError(LOG_SOURCE, status, data.error || 'Google auth failed', '/api/auth/google');
      return { success: false, needsOnboarding: false };
    }

    if (data.success && data.tokens) {
      const stored = await storeAuthSession(data);
      if (!stored) {
        return { success: false, needsOnboarding: false };
      }

      logger.info(LOG_SOURCE, 'Google authentication successful', {
        needsOnboarding: data.needsOnboarding,
      });

      return {
        success: true,
        needsOnboarding: data.needsOnboarding ?? false,
        user: data.user,
      };
    }

    return { success: false, needsOnboarding: false };
  } catch (error) {
    logger.error(LOG_SOURCE, 'Google sign-in error', error);
    return { success: false, needsOnboarding: false };
  }
}

/**
 * Delete the current user's account
 */
async function deleteAccount(): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  blockedOrganizations?: { id: string; name: string; memberCount: number }[];
}> {
  try {
    const accessToken = await api.getToken();
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const { ok, status, data } = await api.rawRequest<{
      error?: string;
      blockedOrganizations?: { id: string; name: string; memberCount: number }[];
    }>('DELETE', '/auth/delete-account', undefined, { authenticated: true });

    if (!ok) {
      return {
        success: false,
        error: data.error || 'Failed to delete account',
        status,
        blockedOrganizations: data.blockedOrganizations,
      };
    }

    // Clear ALL local data
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    await clearPersistentCache().catch(() => {});
    if (LegacyFileSystem.cacheDirectory) {
      await LegacyFileSystem.deleteAsync(LegacyFileSystem.cacheDirectory, { idempotent: true }).catch(() => {});
    }
    await Notifications.setBadgeCountAsync(0).catch(() => {});

    logger.info(LOG_SOURCE, 'Account deleted successfully — all local data cleared');
    return { success: true };
  } catch (error) {
    logger.error(LOG_SOURCE, 'Delete account error', error);
    return { success: false, error: 'Network error' };
  }
}

export const otpService = {
  sendOTP,
  sendWhatsAppOTP,
  verifyOTP,
  signInWithGoogle,
  getAccessToken,
  getUser,
  getCurrentUser,
  logout,
  deleteAccount,
  isAuthenticated,
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
};
