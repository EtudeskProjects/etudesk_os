/**
 * File utility functions
 */

import { API_CONFIG } from '../constants/config';

/**
 * File type detection based on extension or MIME type
 */
export type FileType = 'image' | 'pdf' | 'video' | 'other';

/**
 * Get file type from URL or MIME type
 */
export function getFileType(url: string, mimeType?: string): FileType {
  // Check MIME type first if provided
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType === 'application/pdf') {
      return 'pdf';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
  }

  // Fallback to extension detection
  const urlLower = url.toLowerCase();
  const extension = urlLower.split('.').pop() || '';

  // Image extensions
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  if (imageExtensions.includes(extension)) {
    return 'image';
  }

  // PDF extension
  if (extension === 'pdf') {
    return 'pdf';
  }

  // Video extensions
  const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv', 'm4v'];
  if (videoExtensions.includes(extension)) {
    return 'video';
  }

  return 'other';
}

/**
 * Convert a relative file URL to a full URL
 * Handles both relative paths (/uploads/...) and already-full URLs (http://...)
 */
export function getFullFileUrl(url: string | undefined | null): string {
  if (!url) return '';

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
