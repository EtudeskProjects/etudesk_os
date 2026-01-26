/**
 * Ecosystem Service
 * Aggregates all user ecosystem data for the graph view
 */

import { api, ApiResponse } from './api';
import { Application, Community, Hub, Opportunity } from '../types/models';
import { Notification } from './notificationService';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EcosystemNode {
  id: string;
  type: 'opportunity' | 'community' | 'hub' | 'document';
  label: string;
  status: 'active' | 'pending' | 'completed' | 'saved';
  meta?: string;
  relationLabel?: string;
}

export interface EcosystemData {
  opportunities: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      organization_name: string;
      status: string;
      applied_at?: string;
    }>;
  };
  communities: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      role: string;
      status: string;
      members_count: number;
    }>;
  };
  hubs: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      city: string;
      status: string;
      reservation_date?: string;
    }>;
  };
  documents: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      type: string;
      skills_count: number;
      uploaded_at: string;
    }>;
  };
}


export interface Document {
  id: string;
  name: string;
  type: 'cv' | 'certificate' | 'portfolio' | 'other';
  file_url: string;
  skills_extracted: string[];
  uploaded_at: string;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

class EcosystemService {
  /**
   * Get aggregated ecosystem data for the current user
   */
  async getEcosystemData(): Promise<ApiResponse<EcosystemData>> {
    return api.get<EcosystemData>('/api/ecosystem/me');
  }

  /**
   * Get user notifications
   */
  async getNotifications(filters?: {
    unread_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Notification[]>> {
    return api.get('/api/notifications', filters);
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.put(`/api/notifications/${id}/read`, {});
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<ApiResponse<{ success: boolean }>> {
    return api.put('/api/notifications/read-all', {});
  }

  /**
   * Get user documents
   */
  async getMyDocuments(filters?: {
    type?: Document['type'];
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ documents: Document[]; total_skills: number }>> {
    return api.get('/api/documents/me', filters);
  }

  /**
   * Upload a document
   */
  async uploadDocument(data: {
    name: string;
    type: Document['type'];
    file_url: string;
  }): Promise<ApiResponse<Document>> {
    return api.post('/api/documents', data);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.delete(`/api/documents/${id}`);
  }
}

export const ecosystemService = new EcosystemService();
