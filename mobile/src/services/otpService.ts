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
import { API_CONFIG, STORAGE_KEYS, getApiUrl } from '../constants/config';
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
    const response = await fetch(getApiUrl('/auth/request-otp'), {
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
      throw new Error(data.error || i18n.t('otpService.sendError'));
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
 * Send OTP code to phone number via WhatsApp
 */
async function sendWhatsAppOTP(phone: string): Promise<void> {
  try {
    const response = await fetch(getApiUrl('/auth/request-whatsapp-otp'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, data.error || 'Failed to send WhatsApp OTP', '/api/auth/request-whatsapp-otp');
      throw new Error(data.error || i18n.t('otpService.sendError'));
    }

    logger.info(LOG_SOURCE, 'WhatsApp OTP sent', { phone });
  } catch (error) {
    logger.error(LOG_SOURCE, 'Failed to send WhatsApp OTP', error, { phone });
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
    const response = await fetch(getApiUrl('/auth/verify-otp'), {
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

/**
 * Verify WhatsApp OTP code
 */
async function verifyWhatsAppOTP(phone: string, code: string): Promise<VerifyOTPResult> {
  try {
    const response = await fetch(getApiUrl('/auth/verify-whatsapp-otp'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, data.error || 'WhatsApp OTP verification failed', '/api/auth/verify-whatsapp-otp');
      return { success: false, needsOnboarding: false };
    }

    if (data.success && data.tokens) {
      const stored = await storeAuthSession(data);
      if (!stored) {
        return { success: false, needsOnboarding: false };
      }

      logger.info(LOG_SOURCE, 'WhatsApp authentication successful', {
        phone,
        needsOnboarding: data.needsOnboarding,
      });

      return {
        success: true,
        needsOnboarding: data.needsOnboarding ?? false,
        user: data.user
      };
    }

    return { success: false, needsOnboarding: false };
  } catch (error) {
    logger.error(LOG_SOURCE, 'WhatsApp OTP verification error', error, { phone });
    return { success: false, needsOnboarding: false };
  }
}

async function storeAuthSession(data: any): Promise<boolean> {
  if (!data.tokens.accessToken || !data.tokens.refreshToken) {
    logger.error(LOG_SOURCE, 'Invalid tokens received from server', {
      hasAccessToken: !!data.tokens.accessToken,
      hasRefreshToken: !!data.tokens.refreshToken,
    });
    return false;
  }

  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
  ]);

  await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.tokens.accessToken);
  await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.tokens.refreshToken);

  const storedRefresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!storedRefresh) {
    logger.error(LOG_SOURCE, 'Failed to store refresh token');
    return false;
  }
  logger.debug(LOG_SOURCE, 'Tokens stored successfully');

  if (data.user) {
    const userWithOnboarding = {
      ...data.user,
      needsOnboarding: data.needsOnboarding ?? false,
      hasTalentProfile: !data.needsOnboarding,
      onboardingComplete: !data.needsOnboarding,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userWithOnboarding));
  }

  return true;
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
      await fetch(getApiUrl('/auth/logout'), {
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
async function getCurrentUser(): Promise<any | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    let response = await fetch(getApiUrl('/auth/me'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    // On 401, try refreshing the token before giving up
    if (response.status === 401) {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        logger.info(LOG_SOURCE, 'Token expired, attempting refresh');
        const refreshResponse = await fetch(getApiUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success && refreshData.tokens) {
            await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, refreshData.tokens.accessToken);
            await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshData.tokens.refreshToken);
            logger.info(LOG_SOURCE, 'Token refreshed in getCurrentUser');

            // Retry with new token
            response = await fetch(getApiUrl('/auth/me'), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${refreshData.tokens.accessToken}`,
              },
            });
          }
        }
      }

      // If still 401 after refresh attempt, return null but don't logout
      // (let the main API layer handle session expiry)
      if (response.status === 401) {
        logger.warn(LOG_SOURCE, 'Token expired and refresh failed, returning null');
        return null;
      }
    }

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, 'Failed to get current user', '/api/auth/me');
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

/**
 * Sign in with Google OAuth ID token
 */
async function signInWithGoogle(idToken: string): Promise<VerifyOTPResult> {
  try {
    const response = await fetch(getApiUrl('/auth/google'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.apiError(LOG_SOURCE, response.status, data.error || 'Google auth failed', '/api/auth/google');
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

export const otpService = {
  sendOTP,
  sendWhatsAppOTP,
  verifyOTP,
  verifyWhatsAppOTP,
  signInWithGoogle,
  getAccessToken,
  getUser,
  getCurrentUser,
  logout,
  isAuthenticated,
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
};
