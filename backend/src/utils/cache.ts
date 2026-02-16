/**
 * Simple in-memory cache with TTL.
 * No external dependencies (no Redis needed for current volume).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) { // 5 min default
    this.defaultTtlMs = defaultTtlMs;

    // Periodic cleanup every 60s
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Get-or-set: return cached value, or call factory and cache the result.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Delete all keys matching a prefix (e.g., 'ctx:talentId:')
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Return cache stats for monitoring
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: [...this.store.keys()],
    };
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton cache instance for general use
export const cache = new MemoryCache();
