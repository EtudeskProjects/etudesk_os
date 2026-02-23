/**
 * useDataFetching - A powerful hook for data fetching with caching, retry, and deduplication
 *
 * Features:
 * - Automatic caching with TTL
 * - Retry on failure with exponential backoff
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Loading, error, and data states
 * - Refetch on focus (optional)
 * - Manual refetch capability
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { readCache, writeCache } from '../services/persistentCache';
import i18n from '../i18n';

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

// In-flight requests for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// Default configuration
const DEFAULT_CONFIG = {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL: 5 * 60 * 1000,
  /** Number of retry attempts (default: 3) */
  retryAttempts: 3,
  /** Initial retry delay in milliseconds (default: 1000ms) */
  retryDelay: 1000,
  /** Whether to refetch when app comes to foreground (default: false) */
  refetchOnFocus: false,
  /** Whether to use cache (default: true) */
  useCache: true,
  /** Whether to fetch immediately on mount (default: true) */
  immediate: true,
};

export interface UseDataFetchingConfig {
  cacheTTL?: number;
  retryAttempts?: number;
  retryDelay?: number;
  refetchOnFocus?: boolean;
  useCache?: boolean;
  immediate?: boolean;
}

export interface UseDataFetchingResult<T> {
  /** The fetched data */
  data: T | null;
  /** Whether the request is in progress */
  isLoading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Whether data is from cache */
  isFromCache: boolean;
  /** Refetch the data (bypasses cache) */
  refetch: () => Promise<void>;
  /** Manually set data */
  setData: (data: T | null) => void;
  /** Clear the cache for this key */
  clearCache: () => void;
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a cache key from the fetcher function and dependencies
 */
const generateCacheKey = (key: string | string[]): string => {
  if (Array.isArray(key)) {
    return key.filter(Boolean).join(':');
  }
  return key;
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = <T>(entry: CacheEntry<T> | undefined): boolean => {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
};

/**
 * useDataFetching hook
 *
 * @param key - Unique key for caching (can be string or array of strings)
 * @param fetcher - Async function that fetches the data
 * @param config - Optional configuration
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useDataFetching(
 *   ['opportunity', id],
 *   () => opportunityService.getById(id),
 *   { cacheTTL: 60000, refetchOnFocus: true }
 * );
 * ```
 */
export function useDataFetching<T>(
  key: string | string[],
  fetcher: () => Promise<{ data: T }>,
  config: UseDataFetchingConfig = {}
): UseDataFetchingResult<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const cacheKey = generateCacheKey(key);

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(mergedConfig.immediate);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const mountedRef = useRef(true);
  const configRef = useRef(mergedConfig);
  configRef.current = mergedConfig;

  /**
   * Fetch data with retry logic
   */
  const fetchWithRetry = useCallback(async (
    attempt: number = 1
  ): Promise<T> => {
    try {
      const response = await fetcher();
      return response.data;
    } catch (err) {
      const maxAttempts = configRef.current.retryAttempts;

      if (attempt < maxAttempts) {
        // Exponential backoff
        const delay = configRef.current.retryDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        return fetchWithRetry(attempt + 1);
      }

      throw err;
    }
  }, [fetcher]);

  /**
   * Main fetch function with caching, persistent cache fallback, and deduplication
   */
  const fetchData = useCallback(async (bypassCache: boolean = false) => {
    // Check in-memory cache first (if enabled and not bypassing)
    if (!bypassCache && configRef.current.useCache) {
      const cachedEntry = cache.get(cacheKey);
      if (isCacheValid(cachedEntry)) {
        if (mountedRef.current) {
          setData(cachedEntry!.data);
          setIsFromCache(true);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      // Fallback: check persistent cache (AsyncStorage) — stale-while-revalidate
      const persistent = await readCache<T>(cacheKey).catch(() => null);
      if (persistent) {
        // Show stale data immediately
        if (mountedRef.current) {
          setData(persistent.data);
          setIsFromCache(true);
          setIsLoading(persistent.isStale); // Keep loading spinner if stale
          setError(null);
        }
        // Populate in-memory cache
        cache.set(cacheKey, {
          data: persistent.data,
          timestamp: Date.now(),
          expiresAt: Date.now() + (persistent.isStale ? 0 : configRef.current.cacheTTL),
        });
        // If fresh, we're done
        if (!persistent.isStale) return;
        // If stale, continue to revalidate in background (no early return)
      }
    }

    // Check for in-flight request (deduplication)
    if (inFlightRequests.has(cacheKey)) {
      try {
        const result = await inFlightRequests.get(cacheKey);
        if (mountedRef.current) {
          setData(result);
          setIsFromCache(false);
          setIsLoading(false);
          setError(null);
        }
        return;
      } catch (err) {
        // Error will be handled below
      }
    }

    // Start loading (only if we don't already have stale data showing)
    if (mountedRef.current && data === null) {
      setIsLoading(true);
      setError(null);
    }

    // Create the fetch promise
    const fetchPromise = fetchWithRetry();
    inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;

      // Store in both in-memory and persistent cache
      if (configRef.current.useCache) {
        const ttl = configRef.current.cacheTTL;
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttl,
        });
        // Persist to AsyncStorage (fire-and-forget)
        writeCache(cacheKey, result, ttl).catch(() => {});
      }

      if (mountedRef.current) {
        setData(result);
        setIsFromCache(false);
        setIsLoading(false);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : i18n.t('common.genericError');

      if (mountedRef.current) {
        // Only set error if we don't have stale data to show
        if (data === null) {
          setError(errorMessage);
        }
        setIsLoading(false);
      }
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }, [cacheKey, fetchWithRetry, data]);

  /**
   * Refetch data (bypasses cache)
   */
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  /**
   * Clear cache for this key
   */
  const clearCache = useCallback(() => {
    cache.delete(cacheKey);
  }, [cacheKey]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (configRef.current.immediate) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Refetch on app focus (if enabled)
  useEffect(() => {
    if (!configRef.current.refetchOnFocus) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && mountedRef.current) {
        fetchData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    isFromCache,
    refetch,
    setData,
    clearCache,
  };
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Clear cache entries matching a prefix
 */
export function clearCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate cache for a specific key (mark as expired)
 */
export function invalidateCache(key: string | string[]): void {
  const cacheKey = generateCacheKey(key);
  const entry = cache.get(cacheKey);
  if (entry) {
    entry.expiresAt = 0;
  }
}

export default useDataFetching;
