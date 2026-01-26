/**
 * Image utility functions
 */

import { API_CONFIG } from '../constants/config';

/**
 * Convert a relative image URL to a full URL
 * Handles both relative paths (/uploads/...) and already-full URLs (http://...)
 */
export function getFullImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Relative URL - prepend base URL
  if (url.startsWith('/')) {
    return `${API_CONFIG.BASE_URL}${url}`;
  }

  // Unknown format, return as-is
  return url;
}
