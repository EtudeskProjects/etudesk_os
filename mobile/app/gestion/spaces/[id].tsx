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
  Edit,
  Calendar,
  UserPlus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, COMPONENT } from '../../../src/constants/theme';
import { Button, Chip, IconButton, PageLayout, EmptyState, SelectCard } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { spaceService, Space, SpaceBooking } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { formatPrice } from '../../../src/constants/space';
import { useAlert } from '../../../src/contexts/AlertContext';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
type FilterStatus = 'all' | BookingStatus;

// Status configuration
const getStatusConfig = (colors: any, t: (key: string) => string): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: t('gestion.bookingStatus.pending') },
  CONFIRMED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: t('gestion.bookingStatus.confirmed') },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: t('gestion.bookingStatus.cancelled') },
  COMPLETED: { color: colors.info, icon: CheckCircle2, bgColor: withOpacity(colors.info, OPACITY[15]), label: t('gestion.bookingStatus.completed') },
});

export default function SpaceBookingsManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  const [space, setSpace] = useState<Space | null>(null);
  const [bookings, setBookings] = useState<SpaceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const alerts = useAlert();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const [spaceResponse, bookingsResponse] = await Promise.all([
        spaceService.getById(id),
        spaceService.getSpaceBookings(id),
      ]);

      setSpace(spaceResponse.data || null);
      const bookingsList = bookingsResponse.data || [];
      setBookings(bookingsList);

      const counts: Record<string, number> = {};
      bookingsList.forEach((b: SpaceBooking) => {
        counts[b.status] = (counts[b.status] || 0) + 1;
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
    if (!id) return;

    setIsRefreshing(true);
    try {
      const response = await spaceService.getSpaceBookings(id);
      const bookingsList = response.data || [];
      setBookings(bookingsList);

      const counts: Record<string, number> = {};
      bookingsList.forEach((b: SpaceBooking) => {
        counts[b.status] = (counts[b.status] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (error) {
      if (__DEV__) console.error('Error refreshing bookings:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [id]);

  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await spaceService.updateBookingStatus(bookingId, newStatus);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      handleRefresh();
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.error || t('gestion.bookings.statusUpdateError'));
    }
  };

  const handleConfirmBooking = (bookingId: string) => {
    void alerts.showAlert({ title: t('gestion.bookings.confirmTitle'), message: t('gestion.bookings.confirmMessage'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => handleUpdateStatus(bookingId, 'CONFIRMED'),
        },
      ] });
  };

  const handleCancelBooking = (bookingId: string) => {
    void alerts.showAlert({ title: t('gestion.bookings.cancelTitle'), message: t('gestion.bookings.cancelMessage'), buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('gestion.bookings.cancelYes'),
          style: 'destructive',
          onPress: () => handleUpdateStatus(bookingId, 'CANCELLED'),
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

  const formatBookingDate = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateStr = start.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const startTime = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} - ${startTime} à ${endTime}`;
  };

  const STATUS_CONFIG = getStatusConfig(colors, t);

  const renderBookingItem = ({ item }: { item: SpaceBooking }) => {
    const statusConfig = STATUS_CONFIG[item.status as BookingStatus] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const bookerName = talent?.first_name && talent?.last_name
      ? `${talent.first_name} ${talent.last_name}`
      : talent?.display_name || t('common.user');

	    return (
	      <SelectCard
	        accessibilityLabel={t('common.viewBooking')}
	        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
	        onPress={() => router.push(`/gestion/spaces/bookings/details/${item.id}` as any)}
	      >
        <View style={styles.cardHeader}>
          {talent?.avatar_url ? (
            <Image source={{ uri: talent.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(bookerName)}
              </Text>
            </View>
          )}

          <View style={styles.bookingInfo}>
            <Text style={[styles.bookerName, { color: colors.textPrimary }]} numberOfLines={1}>
              {bookerName}
            </Text>
            <View style={styles.dateRow}>
              <Calendar size={12} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.bookingDate, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatBookingDate(item.start_datetime, item.end_datetime)}
              </Text>
            </View>
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <StatusIcon size={COMPONENT.pill.iconSize} color={statusConfig.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <View style={styles.cardMeta}>
            {item.total_amount && (
              <Text style={[styles.priceText, { color: colors.textPrimary }]}>
                {formatPrice(item.total_amount)} FCFA
              </Text>
            )}
            <Text style={[styles.createdDate, { color: colors.gray500 }]}>
              {formatRelativeTime(item.created_at)}
            </Text>
          </View>
        </View>

        {item.status === 'PENDING' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderColor }]}>
            <Button
              title="Confirmer"
              size="sm"
              variant="secondary"
              onPress={() => handleConfirmBooking(item.id)}
              style={{ flex: 1, backgroundColor: withOpacity(colors.success, OPACITY[15]) }}
              textStyle={{ color: colors.success }}
              icon={<CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />}
            />
            <Button
              title="Annuler"
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

  const localCounts = (() => {
    const counts: Record<string, number> = { all: bookings.length };
    bookings.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  })();

  const filterChips = [
    { key: 'all' as FilterStatus, label: 'Toutes', count: localCounts.all || 0 },
    { key: 'PENDING' as FilterStatus, label: 'En attente', count: localCounts['PENDING'] || 0 },
    { key: 'CONFIRMED' as FilterStatus, label: 'Confirmées', count: localCounts['CONFIRMED'] || 0 },
    { key: 'CANCELLED' as FilterStatus, label: 'Annulées', count: localCounts['CANCELLED'] || 0 },
  ];

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
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
              label={`${chip.label} (${chip.count})`}
              selected={isActive}
              onPress={() => setFilter(chip.key)}
              style={[
                styles.filterChip,
                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              textStyle={[
                styles.filterChipText,
                { color: isActive ? colors.textOnPrimary : colors.gray700 },
              ]}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const rightAction = (
    <View style={styles.headerActions}>
      <IconButton
        onPress={() => router.push(`/gestion/spaces/invitations/${id}` as any)}
        icon={<UserPlus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel={t('common.invitations')}
      />
      <IconButton
        onPress={() => router.push(`/settings/organization/edit-space/${id}` as any)}
        icon={<Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel={t('common.edit')}
      />
    </View>
  );

  const emptySubtitle = filter === 'all'
    ? 'Cet espace n\'a pas encore de réservations.'
    : 'Aucune réservation avec ce statut.';

  return (
    <PageLayout
      title="Réservations"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      rightAction={rightAction}
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
            title={filter === 'all' ? 'Aucune réservation' : 'Aucun résultat'}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
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
    marginBottom: SPACING.md,
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

  bookerName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },

  bookingDate: {
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

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  priceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  createdDate: {
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
