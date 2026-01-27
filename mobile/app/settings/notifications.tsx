import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Handshake,
  Users,
  MessageCircle,
  Check,
  Clock,
  Trash2,
  Settings,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useNotifications, NotificationData } from '../../src/hooks/useNotifications';

type NotificationType = 'OPPORTUNITY' | 'APPLICATION' | 'MESSAGE' | 'SYSTEM' | 'REMINDER';

// Format relative time in French
const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) return "à l'instant";
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffWeeks === 1) return 'il y a 1 semaine';
    if (diffWeeks < 4) return `il y a ${diffWeeks} semaines`;
    if (diffMonths === 1) return 'il y a 1 mois';
    if (diffMonths < 12) return `il y a ${diffMonths} mois`;
    return date.toLocaleDateString('fr-FR');
  } catch {
    return dateString;
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'OPPORTUNITY': return Briefcase;
    case 'APPLICATION': return Handshake;
    case 'MESSAGE': return MessageCircle;
    case 'REMINDER': return Clock;
    case 'SYSTEM':
    default: return Bell;
  }
};

const getNotificationColor = (type: string): string => {
  switch (type) {
    case 'OPPORTUNITY': return '#4CAF50';
    case 'APPLICATION': return '#9C27B0';
    case 'MESSAGE': return '#FF9800';
    case 'REMINDER': return '#2196F3';
    case 'SYSTEM':
    default: return '#607D8B';
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleRefresh = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
  };

  const handleNotificationPress = (notification: NotificationData) => {
    // Mark as read
    if (!notification.read_at) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type and data
    const data = notification.data || {};

    if (notification.type === 'APPLICATION' && data.applicationId) {
      router.push(`/settings/my-applications/${data.applicationId}`);
    } else if (notification.type === 'OPPORTUNITY' && data.opportunityId) {
      router.push(`/details/opportunity/${data.opportunityId}`);
    } else if (notification.type === 'MESSAGE' && data.applicationId) {
      router.push(`/settings/my-applications/${data.applicationId}`);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read_at);
  const readNotifications = notifications.filter(n => n.read_at);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings/preferences')}
          style={styles.backButton}
        >
          <Settings size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* Actions Bar */}
      {notifications.length > 0 && (
        <View style={styles.actionsBar}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: colors.primary + '15' }]}
              onPress={handleMarkAllAsRead}
            >
              <Check size={14} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.actionChipText, { color: colors.primary }]}>
                Tout marquer comme lu
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Loading */}
      {isLoading && notifications.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && notifications.length > 0}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Unread Section */}
        {unreadNotifications.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Non lues ({unreadNotifications.length})
            </Text>
            <View style={[styles.notificationsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {unreadNotifications.map((notification, index, arr) => {
                const NotifIcon = getNotificationIcon(notification.type);
                const notifColor = getNotificationColor(notification.type);
                const isLast = index === arr.length - 1;

                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      { borderBottomColor: colors.gray100, backgroundColor: colors.primary + '05' },
                      isLast && styles.notificationItemLast,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    <View style={[styles.notificationIcon, { backgroundColor: notifColor + '15' }]}>
                      <NotifIcon size={ICON.size.md} color={notifColor} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                        {notification.title}
                      </Text>
                      <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notification.body}
                      </Text>
                      <View style={styles.notificationMeta}>
                        <Clock size={12} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.notificationTime, { color: colors.gray400 }]}>
                          {formatRelativeTime(notification.created_at)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(notification.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Read Section */}
        {readNotifications.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Lues
            </Text>
            <View style={[styles.notificationsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {readNotifications.map((notification, index, arr) => {
                const NotifIcon = getNotificationIcon(notification.type);
                const notifColor = getNotificationColor(notification.type);
                const isLast = index === arr.length - 1;

                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      { borderBottomColor: colors.gray100 },
                      isLast && styles.notificationItemLast,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.notificationIcon, { backgroundColor: notifColor + '15' }]}>
                      <NotifIcon size={ICON.size.md} color={notifColor} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationTitle, { color: colors.textSecondary }]}>
                        {notification.title}
                      </Text>
                      <Text style={[styles.notificationMessage, { color: colors.gray400 }]} numberOfLines={2}>
                        {notification.body}
                      </Text>
                      <View style={styles.notificationMeta}>
                        <Clock size={12} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.notificationTime, { color: colors.gray300 }]}>
                          {formatRelativeTime(notification.created_at)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(notification.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && notifications.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
              <Bell size={ICON.size.xl} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Aucune notification
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tu recevras des notifications sur les opportunités, candidatures et messages
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions Bar
  actionsBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },

  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },

  actionChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  // Notifications List
  notificationsList: {
    marginHorizontal: SPACING.lg,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    position: 'relative',
  },

  notificationItemLast: {
    borderBottomWidth: 0,
  },

  unreadDot: {
    position: 'absolute',
    top: SPACING.md + 18,
    left: SPACING.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },

  notificationContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  notificationTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  notificationMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },

  notificationTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  deleteButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
  },
});
