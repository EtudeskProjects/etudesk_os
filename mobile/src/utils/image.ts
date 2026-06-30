/**
 * Image utility functions
 */

import { API_CONFIG } from '../constants/config';

export interface ImageUrlOptions {
  width?: number;
  quality?: number;
}

function setQueryParam(url: string, key: string, value: number): string {
  const [withoutHash, hash = ''] = url.split('#');
  const [base, query = ''] = withoutHash.split('?');
  const params = query
    ? query
        .split('&')
        .filter(Boolean)
        .filter((part) => part.split('=')[0] !== key)
    : [];

  params.push(`${key}=${value}`);
  return `${base}?${params.join('&')}${hash ? `#${hash}` : ''}`;
}

function optimizeImageUrl(url: string, options?: ImageUrlOptions): string {
  if (!options || (!options.width && !options.quality)) return url;

  if (url.includes('images.unsplash.com/')) {
    let optimized = url;
    if (options.width) optimized = setQueryParam(optimized, 'w', options.width);
    if (options.quality) optimized = setQueryParam(optimized, 'q', options.quality);
    return optimized;
  }

  return url;
}

/**
 * Convert a relative image URL to a full URL
 * Handles both relative paths (/uploads/...) and already-full URLs (http://...)
 */
export function getFullImageUrl(url: string | undefined | null, options?: ImageUrlOptions): string | undefined {
  if (!url) return undefined;

  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return optimizeImageUrl(url, options);
  }

  // Relative URL - prepend base URL
  if (url.startsWith('/')) {
    return optimizeImageUrl(`${API_CONFIG.BASE_URL}${url}`, options);
  }

  // Unknown format, return as-is
  return optimizeImageUrl(url, options);
}
