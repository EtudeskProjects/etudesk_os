/**
 * OTP Service for passwordless email authentication
 * Connects to backend API for OTP generation and verification
 *
 * Mailhog Configuration (development):
 * - SMTP Server: localhost:1025
 * - Web UI: http://localhost:8025
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logService';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

const LOG_SOURCE = 'OTP';

// Configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

// API base URL
const API_BASE_URL = API_CONFIG.BASE_URL;

/**
 * Send OTP code to email address via backend API
 */
async function sendOTP(email: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, data.error || 'Failed to send OTP', '/api/auth/request-otp');
      throw new Error(data.error || 'Erreur lors de l\'envoi du code');
    }

    logger.info(LOG_SOURCE, `OTP sent to ${email}`);
    if (__DEV__) {
      logger.debug(LOG_SOURCE, 'Check Mailhog at http://localhost:8025');
    }
  } catch (error) {
    logger.error(LOG_SOURCE, 'Failed to send OTP', error, { email });
    throw error;
  }
}

/**
 * Result of OTP verification
 */
interface VerifyOTPResult {
  success: boolean;
  needsOnboarding: boolean;
  user?: any;
}

/**
 * Verify OTP code for email address
 * Returns verification result with needsOnboarding flag
 */
async function verifyOTP(email: string, code: string): Promise<VerifyOTPResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        code: code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, data.error || 'OTP verification failed', '/api/auth/verify-otp');
      return { success: false, needsOnboarding: false };
    }

    if (data.success && data.tokens) {
      // Store tokens
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.tokens.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.tokens.refreshToken);

      // Store user info with needsOnboarding flag
      if (data.user) {
        const userWithOnboarding = {
          ...data.user,
          needsOnboarding: data.needsOnboarding ?? false,
          hasTalentProfile: !data.needsOnboarding,
          onboardingComplete: !data.needsOnboarding,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userWithOnboarding));
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

/**
 * Get stored access token
 */
async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get stored user info
 */
async function getUser(): Promise<any | null> {
  const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Logout - call backend and clear all stored auth data
 */
async function logout(allDevices: boolean = false): Promise<void> {
  try {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (accessToken) {
      // Call backend logout endpoint
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken, allDevices }),
      });
    }
  } catch (error) {
    logger.warn(LOG_SOURCE, 'Logout API call failed (continuing with local logout)', { error });
    // Continue with local logout even if API fails
  }

  // Always clear local storage
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
  ]);
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
async function getCurrentUser(): Promise<any | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        logger.info(LOG_SOURCE, 'Token expired, clearing auth');
        await logout();
      } else {
        logger.apiError(LOG_SOURCE, response.status, 'Failed to get current user', '/api/auth/me');
      }
      return null;
    }

    const data = await response.json();
    if (data.success && data.user) {
      // Update local storage with fresh data
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      logger.debug(LOG_SOURCE, 'User profile refreshed', { userId: data.user.id });
      return data.user;
    }

    return null;
  } catch (error) {
    logger.error(LOG_SOURCE, 'Get current user error', error);
    return null;
  }
}

export const otpService = {
  sendOTP,
  verifyOTP,
  getAccessToken,
  getUser,
  getCurrentUser,
  logout,
  isAuthenticated,
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
};
