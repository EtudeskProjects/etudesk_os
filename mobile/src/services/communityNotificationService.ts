import { api, ApiResponse } from './api';

export type CommunityNotificationType =
    | 'MENTION'
    | 'COMMENT_REPLY'
    | 'NEW_ACTIVITY'
    | 'EVENT_REMINDER_1D'
    | 'EVENT_REMINDER_1H'
    | 'SUBSCRIPTION_EXPIRING'
    | 'SUBSCRIPTION_EXPIRED'
    | 'PAYMENT_SUCCESS'
    | 'PAYMENT_FAILED'
    | 'TRIAL_ENDING'
    | 'MEMBERSHIP_APPROVED'
    | 'MEMBERSHIP_REJECTED';

export interface CommunityNotification {
    id: string;
    talent_id: string;
    community_id: string;
    type: CommunityNotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    is_read: boolean;
    created_at: string;
    community?: {
        id: string;
        name: string;
        cover_image_url?: string;
    };
}

export interface NotificationFilters {
    community_id?: string;
    type?: CommunityNotificationType;
    unread_only?: boolean;
    limit?: number;
    offset?: number;
}

export interface UnreadCount {
    community_id: string;
    count: number;
    community_name?: string;
}

class CommunityNotificationService {
    /**
     * Get notifications for the current user
     */
    async getNotifications(filters: NotificationFilters = {}): Promise<ApiResponse<{
        data: CommunityNotification[];
        total: number;
        unread_count: number;
    }>> {
        const params = new URLSearchParams();
        if (filters.community_id) params.append('community_id', filters.community_id);
        if (filters.type) params.append('type', filters.type);
        if (filters.unread_only) params.append('unread_only', 'true');
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());

        const queryString = params.toString();
        return api.get(`/api/community-notifications${queryString ? `?${queryString}` : ''}`);
    }

    /**
     * Get unread notification counts grouped by community
     */
    async getUnreadCounts(): Promise<ApiResponse<UnreadCount[]>> {
        return api.get('/api/community-notifications/unread-counts');
    }

    /**
     * Mark notifications as read
     */
    async markAsRead(options: {
        notification_ids?: string[];
        community_id?: string;
        all?: boolean;
    }): Promise<ApiResponse<{ success: boolean; marked_read: number }>> {
        return api.post('/api/community-notifications/read', options);
    }

    /**
     * Mark all notifications for a community as read
     */
    async markCommunityAsRead(communityId: string): Promise<ApiResponse<{ success: boolean; marked_read: number }>> {
        return api.post(`/api/community-notifications/${communityId}/read-all`, {});
    }
}

export const communityNotificationService = new CommunityNotificationService();
