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
  MessageCircle,
  Clock,
  MapPin,
  Trash2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, ThemeColors } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useNotifications, NotificationData } from '../../src/hooks/useNotifications';

const formatRelativeTime = (dateString: string): string => {
  try {
    const now = Date.now();
    const diff = now - new Date(dateString).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    const d = Math.floor(h / 24);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    if (h < 24) return `il y a ${h}h`;
    if (d === 1) return 'hier';
    if (d < 7) return `il y a ${d}j`;
    if (d < 30) return `il y a ${Math.floor(d / 7)} sem.`;
    if (d < 365) return `il y a ${Math.floor(d / 30)} mois`;
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return '';
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'OPPORTUNITY': return Briefcase;
    case 'APPLICATION': return Handshake;
    case 'MESSAGE': return MessageCircle;
    case 'REMINDER': return Clock;
    case 'SPACE': return MapPin;
    default: return Bell;
  }
};

// Notification colors - Luxe Africain design system
const getNotificationColor = (type: string, colors: ThemeColors): string => {
  switch (type) {
    case 'OPPORTUNITY': return colors.success;      // Forest green
    case 'APPLICATION': return colors.primary;      // Rich brown
    case 'MESSAGE': return colors.warning;          // Warm amber
    case 'REMINDER': return colors.info;            // Warm taupe
    case 'SPACE': return colors.primaryLight;       // Light brown
    default: return colors.gray500;                 // Neutral gray
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
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Auto mark all as read when opening the page
  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (unreadCount > 0 && notifications.length > 0) {
      markAllAsRead();
    }
  }, [notifications.length]);

  const handleRefresh = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationPress = (notification: NotificationData) => {
    const data = notification.data || {};
    const screen = data.screen as string | undefined;

    if (notification.type === 'MESSAGE') {
      // Message notifications → go to messages tab
      if (data.applicationId) {
        router.push(`/settings/my-applications/${data.applicationId}?tab=messages`);
      } else if (data.membershipId) {
        router.push(`/settings/my-communities/${data.membershipId}?tab=messages`);
      } else if (data.bookingId) {
        router.push(`/settings/my-reservations/${data.bookingId}?tab=messages`);
      }
    } else if (notification.type === 'APPLICATION' && data.applicationId) {
      router.push(`/settings/my-applications/${data.applicationId}`);
    } else if (notification.type === 'OPPORTUNITY' && data.opportunityId) {
      router.push(`/details/opportunity/${data.opportunityId}`);
    } else if (notification.type === 'MEMBERSHIP' && data.membershipId) {
      router.push(`/settings/my-communities/${data.membershipId}`);
    } else if (notification.type === 'BOOKING' && data.bookingId) {
      router.push(`/settings/my-reservations/${data.bookingId}`);
    } else if (notification.type === 'SPACE' && data.spaceId) {
      router.push(`/details/space/${data.spaceId}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <View style={styles.backButton} />
      </View>

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
        {notifications.length > 0 && (
          <View style={[styles.notificationsList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {notifications.map((notification, index) => {
              const NotifIcon = getNotificationIcon(notification.type);
              const notifColor = getNotificationColor(notification.type, colors);
              const isLast = index === notifications.length - 1;

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
                  <View style={[styles.notificationIcon, { backgroundColor: withOpacity(notifColor, OPACITY[15]) }]}>
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
                    onPress={() => deleteNotification(notification.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  notificationsList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  notificationItemLast: { borderBottomWidth: 0 },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: { flex: 1, marginLeft: SPACING.md },
  notificationTitle: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  notificationMessage: { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: 2, lineHeight: TYPOGRAPHY.fontSize.sm * 1.4 },
  notificationMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  notificationTime: { fontSize: TYPOGRAPHY.fontSize.xs },
  deleteButton: { padding: SPACING.xs, marginLeft: SPACING.sm },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xl },
  emptyIcon: { width: 80, height: 80, borderRadius: BORDER.radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center', lineHeight: TYPOGRAPHY.fontSize.md * 1.5 },
});
