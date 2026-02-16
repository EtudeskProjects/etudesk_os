/**
 * Persistent Cache — AsyncStorage-backed with stale-while-revalidate.
 * Survives app kills. Used by useDataFetching as a fallback layer.
 *
 * Storage budget: ~100KB per user (auto-eviction of oldest entries).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@etudesk_cache:';
const MAX_ENTRIES = 100;

interface CachedItem<T = any> {
  data: T;
  storedAt: number;
  ttlMs: number;
}

/**
 * Read from persistent cache.
 * Returns { data, isStale } — stale data can be used while revalidating.
 */
export async function readCache<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const item: CachedItem<T> = JSON.parse(raw);
    const age = Date.now() - item.storedAt;
    const isStale = age > item.ttlMs;

    return { data: item.data, isStale };
  } catch {
    return null;
  }
}

/**
 * Write to persistent cache with TTL.
 */
export async function writeCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const item: CachedItem<T> = {
      data,
      storedAt: Date.now(),
      ttlMs,
    };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch {
    // Storage full — try eviction
    await evictOldest();
    try {
      const item: CachedItem<T> = { data, storedAt: Date.now(), ttlMs };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch {
      // Give up silently
    }
  }
}

/**
 * Remove a specific cache entry.
 */
export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // Ignore
  }
}

/**
 * Remove all cache entries matching a prefix.
 */
export async function removeCacheByPrefix(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => k.startsWith(CACHE_PREFIX + prefix));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // Ignore
  }
}

/**
 * Clear all cache entries.
 */
export async function clearPersistentCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Ignore
  }
}

/**
 * Evict oldest cache entries to stay under MAX_ENTRIES.
 */
async function evictOldest(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));

    if (cacheKeys.length <= MAX_ENTRIES) return;

    // Read all entries to find oldest
    const pairs = await AsyncStorage.multiGet(cacheKeys);
    const entries: Array<{ key: string; storedAt: number }> = [];

    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const item = JSON.parse(value);
        entries.push({ key, storedAt: item.storedAt || 0 });
      } catch {
        entries.push({ key, storedAt: 0 });
      }
    }

    // Sort by storedAt ascending (oldest first)
    entries.sort((a, b) => a.storedAt - b.storedAt);

    // Remove oldest entries to get back to MAX_ENTRIES / 2
    const toRemove = entries.slice(0, entries.length - Math.floor(MAX_ENTRIES / 2));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove.map(e => e.key));
    }
  } catch {
    // Ignore
  }
}
