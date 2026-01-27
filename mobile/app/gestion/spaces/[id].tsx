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
  Edit,
  Calendar,
  User,
  MapPin,
  UserPlus,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { FooterNav } from '../../../src/components/ui';
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
  CONFIRMED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Confirmee' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annulee' },
  COMPLETED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Terminee' },
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

      // Calculate status counts
      const counts: Record<string, number> = {};
      bookingsList.forEach((b: SpaceBooking) => {
        counts[b.status] = (counts[b.status] || 0) + 1;
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
    if (!id) return;

    setIsRefreshing(true);
    try {
      const response = await spaceService.getSpaceBookings(id);
      const bookingsList = response.data || [];
      setBookings(bookingsList);

      // Recalculate status counts
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
      Alert.alert('Erreur', error.error || 'Impossible de mettre a jour le statut.');
    }
  };

  const handleConfirmBooking = (bookingId: string) => {
    Alert.alert(
      'Confirmer la reservation',
      'Voulez-vous confirmer cette reservation ?',
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
      'Annuler la reservation',
      'Voulez-vous annuler cette reservation ?',
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
    return `${dateStr} - ${startTime} a ${endTime}`;
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
          {/* Avatar */}
          {talent?.avatar_url ? (
            <Image source={{ uri: talent.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(bookerName)}
              </Text>
            </View>
          )}

          {/* Info */}
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
              <Text style={[styles.quickActionText, { color: colors.error }]}>Annuler</Text>
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
          ? 'Cet espace n\'a pas encore de reservations.'
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
            {space?.name || 'Espace'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/gestion/spaces/invitations/${id}` as any)}
            style={styles.actionButton}
          >
            <UserPlus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/settings/organization/edit-space/${id}` as any)}
            style={styles.actionButton}
          >
            <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>
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
            {bookings.length}
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
          <Text style={[styles.statLabel, { color: filter === 'PENDING' ? colors.warning : colors.gray500 }]}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'CONFIRMED' && { backgroundColor: colors.success + '12', borderColor: colors.success + '50' }
          ]}
          onPress={() => setFilter('CONFIRMED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.success }]}>
            {statusCounts['CONFIRMED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'CONFIRMED' ? colors.success : colors.gray500 }]}>Confirmees</Text>
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
          <Text style={[styles.statLabel, { color: filter === 'CANCELLED' ? colors.error : colors.gray500 }]}>Annulees</Text>
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

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
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
