/**
 * useNotifications Hook
 * Fetches and manages notification state
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Configure foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  notify_opportunities: boolean;
  notify_messages: boolean;
  notify_applications: boolean;
  notify_reminders: boolean;
}

export function useNotifications() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Register push token
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status: s } = await Notifications.requestPermissionsAsync();
      finalStatus = s;
    }
    if (finalStatus !== 'granted') return null;

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;
      if (!projectId) {
        console.warn('Push notifications: no projectId found — skipping token registration');
        return null;
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }, []);

  // Send token to backend
  const sendTokenToBackend = useCallback(async (token: string) => {
    try {
      await api.post('/api/notifications/push-token', {
        token,
        platform: Platform.OS,
        deviceName: Device.modelName || 'Unknown Device',
      });
    } catch (error) {
      console.error('Error sending push token to backend:', error);
    }
  }, []);

  // Init push notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        await sendTokenToBackend(token);
      }
    })();

    const sub1 = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications();
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      fetchNotifications();
      // Navigate based on notification data
      const data = response.notification.request.content.data || {};
      const type = data.type as string | undefined;
      const screen = data.screen as string | undefined;
      try {
        if (type === 'MESSAGE' || screen?.includes('messages')) {
          if (data.applicationId) {
            router.push(`/settings/my-applications/${data.applicationId}?tab=messages`);
          } else if (data.membershipId) {
            router.push(`/settings/my-communities/${data.membershipId}?tab=messages`);
          } else if (data.bookingId) {
            router.push(`/settings/my-reservations/${data.bookingId}?tab=messages`);
          }
        } else if (type === 'APPLICATION' && data.applicationId) {
          router.push(`/settings/my-applications/${data.applicationId}`);
        } else if (type === 'MEMBERSHIP' && data.membershipId) {
          router.push(`/settings/my-communities/${data.membershipId}`);
        } else if (type === 'BOOKING' && data.bookingId) {
          router.push(`/settings/my-reservations/${data.bookingId}`);
        } else if (type === 'OPPORTUNITY' && data.opportunityId) {
          router.push(`/details/opportunity/${data.opportunityId}`);
        } else if (type === 'SPACE' && data.spaceId) {
          router.push(`/details/space/${data.spaceId}`);
        }
      } catch (e) {
        // Navigation may fail if router not ready
      }
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [isAuthenticated]);

  // Fetch notifications
  const fetchNotifications = useCallback(async (options?: { limit?: number; offset?: number }) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response: any = await api.get('/api/notifications', options);
      const notifs = response?.data ?? [];
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
      if (response?.unreadCount !== undefined) {
        setUnreadCount(response.unreadCount);
        try { await Notifications.setBadgeCountAsync(response.unreadCount); } catch {}
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`, {});
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      try { await Notifications.setBadgeCountAsync(Math.max(0, unreadCount - 1)); } catch {}
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [unreadCount]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all', {});
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
      try { await Notifications.setBadgeCountAsync(0); } catch {}
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response: any = await api.get('/api/notifications/preferences');
      const prefs = response?.data ?? response;
      if (prefs && typeof prefs === 'object') setPreferences(prefs);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  }, [isAuthenticated]);

  // Update preferences
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      const response: any = await api.put('/api/notifications/preferences', newPrefs);
      const prefs = response?.data ?? response;
      if (prefs && typeof prefs === 'object') setPreferences(prefs);
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }, []);

  // Deactivate token
  const deactivateToken = useCallback(async () => {
    if (!expoPushToken) return;
    try {
      await api.delete('/api/notifications/push-token', { token: expoPushToken });
      setExpoPushToken(null);
    } catch (error) {
      console.error('Error deactivating push token:', error);
    }
  }, [expoPushToken]);

  // Auto-fetch on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [isAuthenticated]);

  return {
    expoPushToken,
    registerForPushNotifications,
    deactivateToken,
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    preferences,
    fetchPreferences,
    updatePreferences,
  };
}
