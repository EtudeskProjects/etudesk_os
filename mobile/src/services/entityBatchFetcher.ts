/**
 * Entity Batch Fetcher
 * Collects individual entity fetch requests and batches them into a single API call.
 * Debounces 100ms to aggregate concurrent EntityCard renders.
 */

import { api } from './api';

export type BatchedEntity = Record<string, unknown>;

interface PendingRequest {
  resolve: (data: BatchedEntity | null) => void;
  reject: (error: Error) => void;
}

const pending = new Map<string, PendingRequest[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 100;
const MAX_BATCH = 20;

async function flush() {
  timer = null;

  // Take up to MAX_BATCH items
  const entries = [...pending.entries()].slice(0, MAX_BATCH);
  const batch = new Map(entries);
  for (const key of batch.keys()) {
    pending.delete(key);
  }

  // If there are still pending items, schedule another flush
  if (pending.size > 0) {
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  const keys = [...batch.keys()];
  if (keys.length === 0) return;

  try {
    const itemsParam = keys.join(',');
    const response = await api.get<Record<string, BatchedEntity>>(`/entities/batch?items=${encodeURIComponent(itemsParam)}`);
    const data = response.data || {};

    for (const [key, callbacks] of batch) {
      const entity = data[key] || null;
      for (const cb of callbacks) {
        cb.resolve(entity);
      }
    }
  } catch (error) {
    for (const [, callbacks] of batch) {
      for (const cb of callbacks) {
        cb.reject(error instanceof Error ? error : new Error('Batch fetch failed'));
      }
    }
  }
}

/**
 * Fetch a single entity via batched request.
 * @param type Entity type (opportunity, community, etc.)
 * @param id Entity UUID
 * @returns Entity data or null if not found
 */
export function fetchEntityBatched(type: string, id: string): Promise<BatchedEntity | null> {
  const key = `${type}:${id}`;

  return new Promise((resolve, reject) => {
    if (!pending.has(key)) {
      pending.set(key, []);
    }
    pending.get(key)!.push({ resolve, reject });

    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  });
}
