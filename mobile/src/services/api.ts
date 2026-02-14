/**
 * Base API Service
 * Handles all HTTP requests to the backend with authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logService';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import i18n from '../i18n';

const API_BASE_URL = API_CONFIG.BASE_URL;
const API_TIMEOUT = API_CONFIG.TIMEOUT;
const API_PREFIX = API_CONFIG.API_PREFIX;

/** Build full API URL — source unique /api/v1 */
function buildApiUrl(endpoint: string): string {
  const path = endpoint.startsWith('/api/') && !endpoint.startsWith('/api/v1/')
    ? API_PREFIX + '/' + endpoint.slice(5) // /api/xxx -> /api/v1/xxx
    : endpoint.startsWith('/')
      ? API_PREFIX + endpoint
      : endpoint;
  return `${API_BASE_URL}${path}`;
}
const LOG_SOURCE = 'API';

// Enable request logging in development
const ENABLE_REQUEST_LOGGING = __DEV__;

interface ApiResponse<T> {
  data: T;
  count?: number;
  error?: string;
  success?: boolean;
}

interface ApiError {
  error: string;
  message?: string;
  code?: string;
  status?: number;
}

interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

class ApiService {
  private baseUrl: string;
  private timeout: number;
  
  // Token refresh management - prevents race conditions
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(success: boolean) => void> = [];

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.timeout = API_TIMEOUT;
  }

  /**
   * Get the base URL for external use (e.g., direct downloads)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the access token from storage
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Get the refresh token from storage
   */
  private async getRefreshToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      return token || null; // Treat empty string as null
    } catch {
      return null;
    }
  }

  /**
   * Store new tokens
   */
  private async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  /**
   * Clear all auth data
   */
  async clearAuth(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
    ]);
  }

  /**
   * Subscribe to token refresh completion
   * Used to queue requests while a refresh is in progress
   */
  private subscribeToRefresh(): Promise<boolean> {
    return new Promise((resolve) => {
      this.refreshSubscribers.push(resolve);
    });
  }

  /**
   * Notify all subscribers of refresh result
   */
  private notifyRefreshSubscribers(success: boolean): void {
    this.refreshSubscribers.forEach((callback) => callback(success));
    this.refreshSubscribers = [];
  }

  /**
   * Refresh the access token using the refresh token
   * Implements a queue mechanism to prevent race conditions when multiple
   * requests receive 401 simultaneously
   */
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for the ongoing refresh to complete
    if (this.isRefreshing) {
      logger.debug(LOG_SOURCE, 'Token refresh already in progress, waiting...');
      return this.subscribeToRefresh();
    }

    // Mark as refreshing and create promise for other requests to wait on
    this.isRefreshing = true;

    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        logger.warn(LOG_SOURCE, 'No refresh token available');
        this.notifyRefreshSubscribers(false);
        return false;
      }

      logger.info(LOG_SOURCE, 'Refreshing access token...');

      const response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        logger.warn(LOG_SOURCE, `Token refresh failed with status ${response.status}`);
        // Only clear auth on 401 (token truly invalid), not on network/server errors
        if (response.status === 401) {
          await this.clearAuth();
        }
        this.notifyRefreshSubscribers(false);
        return false;
      }

      const data = await response.json();
      if (data.success && data.tokens) {
        await this.storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
        logger.info(LOG_SOURCE, 'Token refresh successful');
        this.notifyRefreshSubscribers(true);
        return true;
      }

      logger.warn(LOG_SOURCE, 'Token refresh response invalid');
      this.notifyRefreshSubscribers(false);
      return false;
    } catch (error) {
      logger.error(LOG_SOURCE, 'Token refresh failed', error);
      this.notifyRefreshSubscribers(false);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Make an HTTP request with authentication
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    headers?: Record<string, string>,
    retry: boolean = true,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = options?.timeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const startTime = Date.now();

    // Log request start
    if (ENABLE_REQUEST_LOGGING) {
      logger.debug(LOG_SOURCE, `[${requestId}] ${method} ${endpoint}`, body ? { body } : undefined);
    }

    try {
      // Get access token for authenticated requests
      const accessToken = await this.getAccessToken();

      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': i18n.locale,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        signal: controller.signal,
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          config.body = body;
          // Delete Content-Type to let fetch set it with boundary
          if (config.headers && (config.headers as any)['Content-Type']) {
            delete (config.headers as any)['Content-Type'];
          }
        } else {
          config.body = JSON.stringify(body);
        }
      }

      const response = await fetch(buildApiUrl(endpoint), config);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retry) {
        logger.info(LOG_SOURCE, `[${requestId}] 401 received, attempting token refresh`);
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          logger.info(LOG_SOURCE, `[${requestId}] Token refreshed, retrying request`);
          return this.request<T>(method, endpoint, body, headers, false);
        } else {
          await this.clearAuth();
          logger.apiError(LOG_SOURCE, 401, 'Session expired', endpoint);
          throw { error: 'Session expirée. Veuillez vous reconnecter.', status: 401 } as ApiError;
        }
      }

      const data = await response.json();

      if (!response.ok) {
        logger.apiError(LOG_SOURCE, response.status, data.error || 'Request failed', endpoint, data);
        throw {
          error: data.error || 'Request failed',
          message: data.message,
          code: data.code,
          status: response.status,
        } as ApiError;
      }

      // Log successful response
      if (ENABLE_REQUEST_LOGGING) {
        logger.debug(LOG_SOURCE, `[${requestId}] ${response.status} ${method} ${endpoint} (${duration}ms)`);
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error.name === 'AbortError') {
        logger.apiError(LOG_SOURCE, 408, 'Request timeout', endpoint, { duration });
        throw { error: 'Request timeout', status: 408 } as ApiError;
      }

      if (error.error) {
        // Already logged or an ApiError, re-throw
        throw error;
      }

      // Network or unexpected error
      logger.networkError(LOG_SOURCE, `${method} ${endpoint}: ${error.message}`, error);
      throw { error: 'Network error', message: error.message } as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T>('GET', url, undefined, undefined, true, options);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body, options?.headers, true, options);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body, options?.headers, true, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body, options?.headers, true, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, body, undefined, true, options);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * Returns null if no token available or refresh failed
   */
  async getToken(): Promise<string | null> {
    const token = await this.getAccessToken();
    return token;
  }

  /**
   * Try to refresh the token and return the new one
   * Returns null if refresh failed
   */
  async tryRefreshToken(): Promise<string | null> {
    const refreshed = await this.refreshAccessToken();
    if (refreshed) {
      return await this.getAccessToken();
    }
    return null;
  }
}

export const api = new ApiService();
export type { ApiResponse, ApiError };
