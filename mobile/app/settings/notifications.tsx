import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
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
  Users,
  CalendarCheck,
  UserCheck,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, ThemeColors } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useNotifications, NotificationData } from '../../src/hooks/useNotifications';
import { IconButton, LoadingShimmer } from '../../src/components/ui';
import { useI18n } from '../../src/contexts/I18nContext';
import { getCurrentLocale } from '../../src/i18n';


const formatRelativeTime = (dateString: string, t: (key: string, params?: Record<string, any>) => string): string => {
  try {
    const now = Date.now();
    const diff = now - new Date(dateString).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    const d = Math.floor(h / 24);
    if (min < 1) return t('common.time.justNow');
    if (min < 60) return t('common.time.minutes', { count: min });
    if (h < 24) return t('common.time.hours', { count: h });
    if (d === 1) return t('common.time.yesterday');
    if (d < 7) return t('common.time.days', { count: d });
    if (d < 30) return t('common.time.weeks', { count: Math.floor(d / 7) });
    if (d < 365) return t('common.time.months', { count: Math.floor(d / 30) });
    return new Date(dateString).toLocaleDateString(getCurrentLocale());
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
    case 'BOOKING': return MapPin;
    case 'NEW_ACTIVITY': return Users;
    case 'MENTION': return MessageCircle;
    case 'COMMENT_REPLY': return MessageCircle;
    case 'EVENT_REMINDER':
    case 'EVENT_REMINDER_1D':
    case 'EVENT_REMINDER_1H': return CalendarCheck;
    case 'BOOKING_REMINDER': return CalendarCheck;
    case 'OPPORTUNITY_REMINDER': return CalendarCheck;
    case 'APPLICATION_REMINDER': return CalendarCheck;
    case 'MEMBERSHIP_APPROVED':
    case 'MEMBERSHIP_REJECTED': return UserCheck;
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
  const { t, locale } = useI18n();
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
    } else if ((notification.type === 'EVENT_REMINDER' || notification.type === 'EVENT_REMINDER_1D' || notification.type === 'EVENT_REMINDER_1H' || notification.type === 'NEW_ACTIVITY' || notification.type === 'MENTION' || notification.type === 'COMMENT_REPLY') && data.communityId) {
      router.push(`/details/community/${data.communityId}`);
    } else if (notification.type === 'BOOKING_REMINDER' && data.bookingId) {
      router.push(`/settings/my-reservations/${data.bookingId}`);
    } else if (notification.type === 'OPPORTUNITY_REMINDER' && data.opportunityId) {
      router.push(`/details/opportunity/${data.opportunityId}`);
    } else if (notification.type === 'APPLICATION_REMINDER' && data.applicationId) {
      router.push(`/settings/my-applications/${data.applicationId}`);
    } else if ((notification.type === 'MEMBERSHIP_APPROVED' || notification.type === 'MEMBERSHIP_REJECTED') && data.communityId) {
      router.push(`/details/community/${data.communityId}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('notifications.title')}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Loading */}
      {isLoading && notifications.length === 0 && (
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      )}

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && notifications.length > 0}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item: notification }) => {
          const NotifIcon = getNotificationIcon(notification.type);
          const notifColor = getNotificationColor(notification.type, colors);

          return (
            <View>
              <Pressable
                style={[
                  styles.notificationItem,
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                  },
                ]}
                onPress={() => handleNotificationPress(notification)}
                accessibilityRole="button"
                accessibilityLabel={notification.title}
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
                      {formatRelativeTime(notification.created_at, t)}
                    </Text>
                  </View>
                </View>
                <IconButton
                  onPress={() => deleteNotification(notification.id)}
                  icon={<Trash2 size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('notifications.deleteNotification')}
                  style={styles.deleteButton}
                />
              </Pressable>
              <View style={[styles.notificationSeparator, { backgroundColor: colors.gray200 }]} />
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
                <Bell size={ICON.size.xl} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {t('notifications.empty')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {t('notifications.emptySubtitle')}
              </Text>
            </View>
          ) : null
        }
      />
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
  scrollContent: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.xxl },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
  },
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
  notificationSeparator: {
    height: 1,
    width: '100%',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xl },
  emptyIcon: { width: 80, height: 80, borderRadius: BORDER.radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: TYPOGRAPHY.fontSize.md, textAlign: 'center', lineHeight: TYPOGRAPHY.fontSize.md * 1.5 },
});
