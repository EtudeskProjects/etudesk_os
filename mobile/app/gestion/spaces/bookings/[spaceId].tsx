import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
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
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { PageLayout, EmptyState } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { spaceService, spaceBookingService, Space, SpaceBookingDetails, BookingStatus } from '../../../../src/services';
import { formatRelativeTime } from '../../../../src/utils/date';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Confirmée' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Terminée' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annulée' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: colors.gray500 + '15', label: 'Absent' },
});

type FilterStatus = 'all' | BookingStatus;

export default function SpaceBookingsScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [space, setSpace] = useState<Space | null>(null);
  const [bookings, setBookings] = useState<SpaceBookingDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les réservations.');
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
      console.error('Error refreshing bookings:', error);
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
      Alert.alert('Erreur', error.error || 'Impossible de confirmer la réservation.');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Annuler la réservation',
      'Êtes-vous sûr de vouloir annuler cette réservation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.updateBookingStatus(bookingId, 'CANCELLED', 'Annulée par l\'organisation');
              setBookings((prev) =>
                prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' as BookingStatus } : b))
              );
              handleRefresh();
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible d\'annuler la réservation.');
            }
          },
        },
      ]
    );
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
    const dateStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} - ${startTime} à ${endTime}`;
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
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const renderBookingItem = ({ item }: { item: SpaceBookingDetails }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const talentName = talent?.display_name ||
      (talent?.first_name && talent?.last_name
        ? `${talent.first_name} ${talent.last_name}`
        : 'Client');

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/spaces/bookings/details/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image source={{ uri: talent.avatar_url || talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
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
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>

        {item.status === 'PENDING' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleConfirmBooking(item.id)}
            >
              <CheckCircle2 size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.success }]}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.error + '15' }]}
              onPress={() => handleCancelBooking(item.id)}
            >
              <XCircle size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const filterChips = [
    { key: 'all' as FilterStatus, label: 'Toutes', count: statusCounts['all'] || 0 },
    { key: 'PENDING' as FilterStatus, label: 'En attente', count: statusCounts['PENDING'] || 0 },
    { key: 'CONFIRMED' as FilterStatus, label: 'Confirmées', count: statusCounts['CONFIRMED'] || 0 },
    { key: 'COMPLETED' as FilterStatus, label: 'Terminées', count: statusCounts['COMPLETED'] || 0 },
    { key: 'CANCELLED' as FilterStatus, label: 'Annulées', count: statusCounts['CANCELLED'] || 0 },
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
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilter(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.gray700 },
                  isActive && { color: colors.textOnPrimary },
                ]}
              >
                {chip.label} ({chip.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const emptySubtitle = filter === 'all'
    ? 'Cet espace n\'a pas encore reçu de réservations.'
    : 'Aucune réservation avec ce statut.';

  return (
    <PageLayout
      title="Réservations"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
    >
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'all' ? 'Aucune réservation' : 'Aucun résultat'}
          subtitle={emptySubtitle}
        />
      ) : (
        filteredBookings.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {renderBookingItem({ item })}
          </View>
        ))
      )}
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
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  cardWrapper: {
    marginBottom: SPACING.md,
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
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
    borderTopColor: '#E5E7EB',
  },

  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  quickActionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
