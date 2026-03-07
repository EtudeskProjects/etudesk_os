/**
 * File Service
 * Handles generic file uploads (attachments)
 */

import { api } from './api';
import { getApiUrl } from '../constants/config';

export interface UploadedFile {
  url: string;
  publicUrl: string;
  fileId: string;
  size?: number;
  contentType?: string;
  originalName?: string;
}

export interface UploadFileInput {
  uri: string;
  name: string;
  type: string;
  category?: string;
}

export async function uploadFile({
  uri,
  name,
  type,
  category = 'general',
}: UploadFileInput): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type,
    name,
  } as any);
  formData.append('category', category);

  let token = await api.getToken();
  const uploadUrl = getApiUrl('/files/upload');

  let response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (response.status === 401) {
    token = await api.tryRefreshToken();
    if (token) {
      const retryFormData = new FormData();
      retryFormData.append('file', {
        uri,
        type,
        name,
      } as any);
      retryFormData.append('category', category);

      response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: retryFormData,
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data.data?.url) {
    throw new Error('Invalid upload response');
  }

  return {
    url: data.data.url,
    publicUrl: data.data.public_url || data.data.url,
    fileId: data.data.file_id,
    size: data.data.size,
    contentType: data.data.content_type,
    originalName: data.data.original_name,
  };
}
