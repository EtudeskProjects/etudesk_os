import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Inbox,
  Calendar,
  AlertCircle,
  DollarSign,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, COMPONENT } from '../../../../src/constants/theme';
import { Button, Chip, PageLayout, EmptyState, SelectCard } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { spaceService, spaceBookingService, Space, SpaceBookingDetails, BookingStatus } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../src/contexts/I18nContext';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'gestion.bookingStatus.pending' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: withOpacity(colors.info, OPACITY[15]), label: 'gestion.bookingStatus.confirmed' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'gestion.bookingStatus.completed' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'gestion.bookingStatus.cancelled' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: withOpacity(colors.gray500, OPACITY[15]), label: 'gestion.bookingStatus.noShow' },
});

type FilterStatus = 'all' | BookingStatus;

export default function SpaceBookingsScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  const [space, setSpace] = useState<Space | null>(null);
  const [bookings, setBookings] = useState<SpaceBookingDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const alerts = useAlert();

  const STATUS_CONFIG = getStatusConfig(colors);

  useEffect(() => {
    loadData();
  }, [spaceId]);

  const loadData = async () => {
    if (!spaceId) return;

    setIsLoading(true);
    try {
      const [spaceResponse, bookingsResponse] = await Promise.all([
        spaceService.getById(spaceId),
        spaceBookingService.getSpaceBookings(spaceId),
      ]);

      setSpace(spaceResponse.data);
      const bookingsData = bookingsResponse.data || [];
      setBookings(bookingsData);

      const counts: Record<string, number> = { all: bookingsData.length };
      bookingsData.forEach((booking) => {
        counts[booking.status] = (counts[booking.status] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (error) {
      if (__DEV__) console.error('Error loading data:', error);
      void alerts.alert(t('common.error'), t('gestion.bookings.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!spaceId) return;

    setIsRefreshing(true);
    try {
      const response = await spaceBookingService.getSpaceBookings(spaceId);
      const bookingsData = response.data || [];
      setBookings(bookingsData);

      const counts: Record<string, number> = { all: bookingsData.length };
      bookingsData.forEach((booking) => {
        counts[booking.status] = (counts[booking.status] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (error) {
      if (__DEV__) console.error('Error refreshing bookings:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [spaceId]);

  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await spaceBookingService.updateBookingStatus(bookingId, 'CONFIRMED');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CONFIRMED' as BookingStatus } : b))
      );
      handleRefresh();
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.bookings.confirmError'));
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    void alerts.showAlert({ title: t('gestion.bookings.cancelTitle'), message: t('gestion.bookings.cancelMessage'), buttons: [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('gestion.bookings.cancelYes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.updateBookingStatus(bookingId, 'CANCELLED', t('gestion.bookings.cancelledByOrganization'));
              setBookings((prev) =>
                prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' as BookingStatus } : b))
              );
              handleRefresh();
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.error || t('gestion.bookings.cancelError'));
            }
          },
        },
      ] });
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatBookingTime = (startDatetime: string, endDatetime: string): string => {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    const dateStr = start.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const startTime = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} - ${startTime} ${t('gestion.bookings.to')} ${endTime}`;
  };

  const formatDuration = (startDatetime: string, endDatetime: string): string => {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days} jour${days > 1 ? 's' : ''}`;
  };

  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat(locale).format(amount) + ' FCFA';
  };

  const renderBookingItem = ({ item }: { item: SpaceBookingDetails }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : t('gestion.bookings.client'));

    return (
      <SelectCard
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/spaces/bookings/details/${item.id}`)}
        selected={false}
        accessibilityLabel={t('gestion.bookings.openBookingFor', { name: talentName })}
      >
        <View style={styles.cardHeader}>
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image source={{ uri: talent.avatar_url || talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(talentName)}
              </Text>
            </View>
          )}

          <View style={styles.bookingInfo}>
            <Text style={[styles.talentName, { color: colors.textPrimary }]} numberOfLines={1}>
              {talentName}
            </Text>
            <View style={styles.dateTimeRow}>
              <Calendar size={12} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.dateTimeText, { color: colors.gray500 }]} numberOfLines={1}>
                {formatBookingTime(item.start_datetime, item.end_datetime)}
              </Text>
            </View>
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        <View style={[styles.detailsRow, { borderTopColor: colors.gray100 }]}>
          <View style={styles.detailItem}>
            <Clock size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatDuration(item.start_datetime, item.end_datetime)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <DollarSign size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatPrice(item.total_amount)}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <StatusIcon size={COMPONENT.pill.iconSize} color={statusConfig.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {t(statusConfig.label)}
            </Text>
          </View>

          <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>

        {item.status === 'PENDING' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderColor }]}>
            <Button
              title={t('gestion.bookings.confirmBooking')}
              size="sm"
              variant="secondary"
              onPress={() => handleConfirmBooking(item.id)}
              style={{ flex: 1, backgroundColor: withOpacity(colors.success, OPACITY[15]) }}
              textStyle={{ color: colors.success }}
              icon={<CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />}
            />
            <Button
              title={t('gestion.bookings.cancelBooking')}
              size="sm"
              variant="secondary"
              onPress={() => handleCancelBooking(item.id)}
              style={{ flex: 1, backgroundColor: withOpacity(colors.error, OPACITY[15]) }}
              textStyle={{ color: colors.error }}
              icon={<XCircle size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            />
          </View>
        )}
      </SelectCard>
    );
  };

  const filterChips = [
    { key: 'all' as FilterStatus, label: t('gestion.filters.all'), count: statusCounts['all'] || 0 },
    { key: 'PENDING' as FilterStatus, label: t('gestion.filters.pending'), count: statusCounts['PENDING'] || 0 },
    { key: 'CONFIRMED' as FilterStatus, label: t('gestion.filters.confirmed'), count: statusCounts['CONFIRMED'] || 0 },
    { key: 'COMPLETED' as FilterStatus, label: t('gestion.filters.completed'), count: statusCounts['COMPLETED'] || 0 },
    { key: 'CANCELLED' as FilterStatus, label: t('gestion.filters.cancelled'), count: statusCounts['CANCELLED'] || 0 },
    { key: 'NO_SHOW' as FilterStatus, label: t('gestion.filters.noShow'), count: statusCounts['NO_SHOW'] || 0 },
  ];

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.borderColor }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      >
        {filterChips.map((chip) => {
          const isActive = filter === chip.key;
          return (
            <Chip
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              selected={isActive}
              label={`${chip.label} (${chip.count})`}
              style={[styles.filterChip, { backgroundColor: isActive ? colors.primary : colors.gray100, borderColor: isActive ? colors.primary : colors.gray200 }]}
              textStyle={[styles.filterChipText, { color: isActive ? colors.textOnPrimary : colors.gray700 }]}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const emptySubtitle = filter === 'all'
    ? t('gestion.bookings.noBookingsDesc')
    : t('gestion.bookings.noResultsDesc');

  return (
    <PageLayout
      title={t('gestion.bookingsList.title')}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      useScrollView={false}
    >
      <FlatList
        data={filteredBookings}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            {renderBookingItem({ item })}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Inbox}
            title={filter === 'all' ? t('gestion.bookings.noBookings') : t('gestion.bookings.noResults')}
            subtitle={emptySubtitle}
          />
        }
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderWidth: BORDER.width.thin,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  filterChipText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  cardWrapper: {
    marginBottom: SPACING.md,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  bookingCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  bookingInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  talentName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },

  dateTimeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },

  detailsRow: {
    flexDirection: 'row',
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    marginBottom: SPACING.sm,
    gap: SPACING.lg,
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },

  statusText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },

  appliedDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },
});
