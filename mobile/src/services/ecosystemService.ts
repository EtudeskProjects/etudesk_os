/**
 * Ecosystem Service
 * Aggregates all user ecosystem data for the graph view
 */

import { api, ApiResponse } from './api';
import { Notification } from './notificationService';


export interface EcosystemNode {
  id: string;
  type: 'opportunity' | 'community' | 'space';
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
  spaces: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      city: string;
      status: string;
      reservation_date?: string;
    }>;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'interview' | 'deadline' | 'booking';
}

// --- Service ---

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
}

export const ecosystemService = new EcosystemService();
