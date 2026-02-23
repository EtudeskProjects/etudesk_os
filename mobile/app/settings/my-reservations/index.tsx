import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  AlertCircle,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { PageLayout, EmptyState, Chip } from '../../../src/components/ui';
import { SpaceCard } from '../../../src/components/cards';
import { spaceBookingService } from '../../../src/services';
import type { SpaceBookingDetails } from '../../../src/services/spaceBookingService';
import type { Space } from '../../../src/services/spaceService';
import { useI18n } from '../../../src/contexts/I18nContext';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'gestion.bookingStatus.pending' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: withOpacity(colors.info, OPACITY[15]), label: 'gestion.bookingStatus.confirmed' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'gestion.bookingStatus.completed' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'gestion.bookingStatus.cancelled' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: colors.gray200, label: 'gestion.bookingStatus.noShow' },
});

type FilterStatus = 'all' | BookingStatus;

export default function MyReservationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [bookings, setBookings] = useState<SpaceBookingDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const loadBookings = useCallback(async () => {
    try {
      const response = await spaceBookingService.getMyBookings();
      setBookings(response.data || []);
    } catch (error) {
      if (__DEV__) console.error('Error loading bookings:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadBookings();
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: bookings.length };
    bookings.forEach((booking) => {
      counts[booking.status] = (counts[booking.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const renderFilterChip = (status: FilterStatus, label: string) => {
    const isActive = filter === status;
    const count = statusCounts[status] || 0;

    return (
      <Chip
        key={status}
        label={`${label} (${count})`}
        selected={isActive}
        style={[
          styles.filterChip,
          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
          isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        textStyle={[
          styles.filterChipText,
          { color: colors.gray700 },
          isActive && { color: colors.textOnPrimary },
        ]}
        onPress={() => setFilter(status)}
      />
    );
  };

  const renderBookingItem = (item: SpaceBookingDetails) => {
    const statusConfig = getStatusConfig(colors)[item.status as BookingStatus];
    const StatusIcon = statusConfig?.icon || Clock;

    return (
      <SpaceCard
        key={item.id}
        space={(item.space || {}) as Space}
        onPress={() => router.push(`/settings/my-reservations/${item.id}`)}
        statusOverlay={{
          label: statusConfig?.label ? t(statusConfig.label) : item.status,
          color: statusConfig?.color || colors.gray500,
          bgColor: statusConfig?.bgColor || colors.gray100,
          icon: <StatusIcon size={12} color={statusConfig?.color || colors.gray500} strokeWidth={ICON.strokeWidth} />,
        }}
      />
    );
  };

  const filterChips = [
    { key: 'all' as FilterStatus, label: t('gestion.filters.all') },
    { key: 'PENDING' as FilterStatus, label: t('gestion.filters.pending') },
    { key: 'CONFIRMED' as FilterStatus, label: t('gestion.filters.confirmed') },
    { key: 'COMPLETED' as FilterStatus, label: t('gestion.filters.completed') },
    { key: 'CANCELLED' as FilterStatus, label: t('gestion.filters.cancelled') },
    { key: 'NO_SHOW' as FilterStatus, label: t('gestion.filters.noShow') },
  ];

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
      <FlatList
        horizontal
        data={filterChips}
        renderItem={({ item }) => renderFilterChip(item.key, item.label)}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      />
    </View>
  );

  return (
    <PageLayout
      title={t('myReservations.title')}
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
        renderItem={({ item }) => renderBookingItem(item)}
        ListEmptyComponent={
          <EmptyState
            icon={CalendarDays}
            title={filter === 'all' ? t('gestion.bookings.noBookings') : t('gestion.bookings.noResults')}
            subtitle={
              filter === 'all'
                ? t('myReservations.empty.subtitle')
                : t('gestion.bookings.noResultsDesc')
            }
            {...(filter === 'all' ? {
              actionLabel: t('tabs.explore'),
              onAction: () => router.push('/(tabs)/explore?category=spaces'),
            } : {})}
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
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
    marginRight: SPACING.sm,
  },

  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

});
