/**
 * Notification Service
 * Handles push notifications and notification preferences
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api, ApiResponse } from './api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type NotificationType = 'OPPORTUNITY' | 'APPLICATION' | 'MESSAGE' | 'SYSTEM' | 'REMINDER';

export interface Notification {
  id: string;
  talent_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  talent_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  notify_opportunities: boolean;
  notify_messages: boolean;
  notify_applications: boolean;
  notify_reminders: boolean;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ═══════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

class NotificationService {
  private expoPushToken: string | null = null;

  // ─────────────────────────────────────────────────────────────
  // PUSH TOKEN MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID,
      });

      this.expoPushToken = tokenData.data;

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#26449F',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  async registerTokenWithBackend(): Promise<boolean> {
    const token = this.expoPushToken || await this.registerForPushNotifications();

    if (!token) {
      return false;
    }

    try {
      const response = await api.post('/api/notifications/push-token', {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      });

      return response.success;
    } catch (error) {
      console.error('Error registering token with backend:', error);
      return false;
    }
  }

  /**
   * Unregister push token (on logout)
   */
  async unregisterToken(): Promise<boolean> {
    if (!this.expoPushToken) {
      return true;
    }

    try {
      await api.delete('/api/notifications/push-token', {
        token: this.expoPushToken,
      });

      this.expoPushToken = null;
      return true;
    } catch (error) {
      console.error('Error unregistering token:', error);
      return false;
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATION LISTENERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Add listener for received notifications (when app is in foreground)
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add listener for notification responses (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Get last notification response (for deep linking on app open)
   */
  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return Notifications.getLastNotificationResponseAsync();
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS API
  // ─────────────────────────────────────────────────────────────

  /**
   * Get notifications for current user
   */
  async getNotifications(
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<ApiResponse<NotificationsResponse>> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;
    return api.get('/api/notifications', {
      limit,
      offset,
      unread: unreadOnly ? 'true' : undefined,
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.getNotifications({ limit: 1 });
      return response.data?.unreadCount ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.put(`/api/notifications/${notificationId}/read`, {});
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<ApiResponse<{ success: boolean; count: number }>> {
    return api.put('/api/notifications/read-all', {});
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.delete(`/api/notifications/${notificationId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // PREFERENCES
  // ─────────────────────────────────────────────────────────────

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    return api.get('/api/notifications/preferences');
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'talent_id'>>
  ): Promise<ApiResponse<NotificationPreferences>> {
    return api.put('/api/notifications/preferences', preferences);
  }

  // ─────────────────────────────────────────────────────────────
  // BADGE MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Set app badge number
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear app badge
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Update badge from server
   */
  async syncBadge(): Promise<void> {
    const count = await this.getUnreadCount();
    await this.setBadgeCount(count);
  }
}

export const notificationService = new NotificationService();
