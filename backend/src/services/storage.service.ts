/**
 * Storage Service
 * Handles file uploads, downloads, and deletions
 * Uses local filesystem storage
 */

import fs from 'fs';
import path from 'path';

// --- Configuration ---

const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './uploads';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// --- Local Storage Functions ---

/**
 * Ensure directory exists
 */
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Upload a file to local storage
 */
export async function uploadFile(
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<string> {
  const fullPath = path.join(LOCAL_STORAGE_PATH, storagePath);
  ensureDir(fullPath);

  await fs.promises.writeFile(fullPath, buffer);

  // Return URL for accessing the file
  return `/uploads/${storagePath}`;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  const storagePath = fileUrl.replace('/uploads/', '');
  const fullPath = path.join(LOCAL_STORAGE_PATH, storagePath);

  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
  }
}

/**
 * Get a URL for accessing a file
 * For local storage, returns the absolute URL
 */
export async function getSignedUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  // For local storage, return absolute URL
  if (fileUrl.startsWith('/')) {
    return `${APP_URL}${fileUrl}`;
  }
  return fileUrl;
}

/**
 * Get file content as buffer
 * Supports local /uploads/ paths and remote http(s) URLs.
 * Rejects file: URIs (mobile local paths that don't exist on the server).
 */
export async function getFileBuffer(fileUrl: string): Promise<Buffer> {
  // Reject mobile file: URIs — they reference device-local paths, not server files
  // Also catches mangled paths like "uploads/file:/var/mobile/..." or "/uploads/file:/..."
  if (fileUrl.startsWith('file:') || fileUrl.includes('/file:')) {
    throw new Error(`Cannot read mobile-local URI on server: ${fileUrl.slice(0, 80)}`);
  }

  // Remote URLs: fetch over HTTP
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fileUrl}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // Local uploads path
  const storagePath = fileUrl.replace('/uploads/', '');
  const fullPath = path.join(LOCAL_STORAGE_PATH, storagePath);
  return fs.promises.readFile(fullPath);
}

/**
 * Check if a file exists
 */
export async function fileExists(fileUrl: string): Promise<boolean> {
  try {
    const storagePath = fileUrl.replace('/uploads/', '');
    const fullPath = path.join(LOCAL_STORAGE_PATH, storagePath);
    return fs.existsSync(fullPath);
  } catch {
    return false;
  }
}

export default {
  uploadFile,
  deleteFile,
  getSignedUrl,
  getFileBuffer,
  fileExists,
};
