import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Inbox,
  Calendar,
  MapPin,
  AlertCircle,
  DollarSign,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';
import { FooterNav } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { spaceService, spaceBookingService, Space, SpaceBookingDetails, BookingStatus } from '../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../src/utils/date';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Confirme' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Termine' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annule' },
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

      // Calculate status counts
      const counts: Record<string, number> = { all: bookingsData.length };
      bookingsData.forEach((booking) => {
        counts[booking.status] = (counts[booking.status] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les reservations.');
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

      // Recalculate counts
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
      Alert.alert('Erreur', error.error || 'Impossible de confirmer la reservation.');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Annuler la reservation',
      'Etes-vous sur de vouloir annuler cette reservation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await spaceBookingService.updateBookingStatus(bookingId, 'CANCELLED', 'Annule par l\'organisation');
              setBookings((prev) =>
                prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' as BookingStatus } : b))
              );
              handleRefresh();
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible d\'annuler la reservation.');
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
    return `${dateStr} - ${startTime} a ${endTime}`;
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
          {/* Avatar */}
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image source={{ uri: talent.avatar_url || talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(talentName)}
              </Text>
            </View>
          )}

          {/* Info */}
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

        {/* Booking Details */}
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

        {/* Quick actions for pending */}
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
        <Inbox size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {filter === 'all' ? 'Aucune reservation' : 'Aucun resultat'}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.gray500 }]}>
        {filter === 'all'
          ? 'Cet espace n\'a pas encore recu de reservations.'
          : 'Aucune reservation avec ce statut.'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Reservations
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.gray500 }]} numberOfLines={1}>
            {space?.name}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'all' && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '50' }
          ]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: filter === 'all' ? colors.primary : colors.textPrimary }]}>
            {statusCounts['all'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'all' ? colors.primary : colors.gray500 }]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'PENDING' && { backgroundColor: colors.warning + '12', borderColor: colors.warning + '50' }
          ]}
          onPress={() => setFilter('PENDING')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {statusCounts['PENDING'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'PENDING' ? colors.warning : colors.gray500 }]}>Attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'CONFIRMED' && { backgroundColor: colors.info + '12', borderColor: colors.info + '50' }
          ]}
          onPress={() => setFilter('CONFIRMED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.info }]}>
            {statusCounts['CONFIRMED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'CONFIRMED' ? colors.info : colors.gray500 }]}>Confirme</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'COMPLETED' && { backgroundColor: colors.success + '12', borderColor: colors.success + '50' }
          ]}
          onPress={() => setFilter('COMPLETED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.success }]}>
            {statusCounts['COMPLETED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'COMPLETED' ? colors.success : colors.gray500 }]}>Termine</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'CANCELLED' && { backgroundColor: colors.error + '12', borderColor: colors.error + '50' }
          ]}
          onPress={() => setFilter('CANCELLED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.error }]}>
            {statusCounts['CANCELLED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'CANCELLED' ? colors.error : colors.gray500 }]}>Annule</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <FooterNav activeTab="gestion" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  headerSpacer: {
    width: 40,
  },

  statsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs - 1,
    marginTop: 2,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  separator: {
    height: SPACING.md,
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  emptyDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },
});
