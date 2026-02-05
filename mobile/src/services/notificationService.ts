import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api, ApiResponse } from './api';

export type NotificationType = 'OPPORTUNITY' | 'APPLICATION' | 'MESSAGE' | 'SYSTEM' | 'SPACE' | 'REMINDER';

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;
      if (!projectId) {
        console.warn('Push notifications: no projectId found — skipping token registration');
        return null;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

      this.expoPushToken = tokenData.data;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B2416', // Primary brand color
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

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

  getPushToken(): string | null {
    return this.expoPushToken;
  }

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return Notifications.getLastNotificationResponseAsync();
  }

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

  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.getNotifications({ limit: 1 });
      return response.data?.unreadCount ?? 0;
    } catch {
      return 0;
    }
  }

  async markAsRead(notificationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.put(`/api/notifications/${notificationId}/read`, {});
  }

  async markAllAsRead(): Promise<ApiResponse<{ success: boolean; count: number }>> {
    return api.put('/api/notifications/read-all', {});
  }

  async deleteNotification(notificationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return api.delete(`/api/notifications/${notificationId}`);
  }

  async getPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    return api.get('/api/notifications/preferences');
  }

  async updatePreferences(
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'talent_id'>>
  ): Promise<ApiResponse<NotificationPreferences>> {
    return api.put('/api/notifications/preferences', preferences);
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  async syncBadge(): Promise<void> {
    const count = await this.getUnreadCount();
    await this.setBadgeCount(count);
  }
}

export const notificationService = new NotificationService();
