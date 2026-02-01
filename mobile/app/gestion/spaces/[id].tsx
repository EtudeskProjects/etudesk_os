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
  Edit,
  Calendar,
  UserPlus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { PageLayout, EmptyState } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { spaceService, Space, SpaceBooking } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { formatPrice } from '../../../src/constants/space';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
type FilterStatus = 'all' | BookingStatus;

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  CONFIRMED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Confirmée' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annulée' },
  COMPLETED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Terminée' },
});

export default function SpaceBookingsManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [space, setSpace] = useState<Space | null>(null);
  const [bookings, setBookings] = useState<SpaceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les réservations.');
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
      console.error('Error refreshing bookings:', error);
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
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleConfirmBooking = (bookingId: string) => {
    Alert.alert(
      'Confirmer la réservation',
      'Voulez-vous confirmer cette réservation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => handleUpdateStatus(bookingId, 'CONFIRMED'),
        },
      ]
    );
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Annuler la réservation',
      'Voulez-vous annuler cette réservation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => handleUpdateStatus(bookingId, 'CANCELLED'),
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

  const formatBookingDate = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} - ${startTime} à ${endTime}`;
  };

  const STATUS_CONFIG = getStatusConfig(colors);

  const renderBookingItem = ({ item }: { item: SpaceBooking }) => {
    const statusConfig = STATUS_CONFIG[item.status as BookingStatus] || STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const bookerName = talent?.first_name && talent?.last_name
      ? `${talent.first_name} ${talent.last_name}`
      : talent?.display_name || 'Utilisateur';

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/spaces/bookings/details/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {talent?.avatar_url ? (
            <Image source={{ uri: talent.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
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
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
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
              <Text style={[styles.quickActionText, { color: colors.error }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
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

  const rightAction = (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={() => router.push(`/gestion/spaces/invitations/${id}` as any)}
        style={styles.headerActionButton}
      >
        <UserPlus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push(`/settings/organization/edit-space/${id}` as any)}
        style={styles.headerActionButton}
      >
        <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
