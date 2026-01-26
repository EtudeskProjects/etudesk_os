/**
 * useNotifications Hook
 * Handles Expo Push Notifications setup and management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
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
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Register for push notifications
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF5722',
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
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Error sending push token to backend:', error);
    }
  }, []);

  // Initialize push notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const initPushNotifications = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        await sendTokenToBackend(token);
      }
    };

    initPushNotifications();

    // Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // Refresh notifications list
      fetchNotifications();
    });

    // Listen for notification interactions
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification response:', data);
      // Handle navigation based on notification data
      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isAuthenticated, registerForPushNotifications, sendTokenToBackend]);

  // Handle notification navigation
  const handleNotificationNavigation = (data: Record<string, unknown>) => {
    // This should be customized based on your navigation structure
    const { screen, opportunityId, applicationId, conversationId } = data as any;

    // You can use your navigation service here to navigate to the appropriate screen
    console.log('Navigate to:', screen, { opportunityId, applicationId, conversationId });
  };

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async (options?: { limit?: number; offset?: number }) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await api.get<{
        data: NotificationData[];
        total: number;
        unreadCount: number;
      }>('/api/notifications', options);

      if (response.data) {
        setNotifications(response.data);
      }
      if (response.unreadCount !== undefined) {
        setUnreadCount(response.unreadCount);
        // Update badge count
        await Notifications.setBadgeCountAsync(response.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      await Notifications.setBadgeCountAsync(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [unreadCount]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
      await Notifications.setBadgeCountAsync(0);
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
      const response = await api.get<{ data: NotificationPreferences }>('/api/notifications/preferences');
      if (response.data) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  }, [isAuthenticated]);

  // Update preferences
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      const response = await api.put<{ data: NotificationPreferences }>('/api/notifications/preferences', newPrefs);
      if (response.data) {
        setPreferences(response.data);
      }
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }, []);

  // Deactivate token on logout
  const deactivateToken = useCallback(async () => {
    if (!expoPushToken) return;

    try {
      await api.delete('/api/notifications/push-token', { token: expoPushToken });
      setExpoPushToken(null);
    } catch (error) {
      console.error('Error deactivating push token:', error);
    }
  }, [expoPushToken]);

  // Fetch notifications and preferences on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [isAuthenticated, fetchNotifications, fetchPreferences]);

  return {
    // Token
    expoPushToken,
    registerForPushNotifications,
    deactivateToken,

    // Notifications
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,

    // Preferences
    preferences,
    fetchPreferences,
    updatePreferences,
  };
}
