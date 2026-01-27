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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  ChevronRight,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { spaceBookingService } from '../../../src/services';
import type { SpaceBookingDetails } from '../../../src/services/spaceBookingService';
import { formatDate, formatTime } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';

// Booking status types
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Status configuration
const getStatusConfig = (colors: any): Record<BookingStatus, { color: string; icon: typeof Clock; bgColor: string; label: string }> => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15', label: 'En attente' },
  CONFIRMED: { color: colors.info, icon: CheckCircle2, bgColor: colors.info + '15', label: 'Confirmee' },
  COMPLETED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15', label: 'Terminee' },
  CANCELLED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15', label: 'Annulee' },
  NO_SHOW: { color: colors.gray500, icon: AlertCircle, bgColor: colors.gray200, label: 'Absent' },
});

type FilterStatus = 'all' | BookingStatus;

export default function MyReservationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [bookings, setBookings] = useState<SpaceBookingDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const response = await spaceBookingService.getMyBookings();
      setBookings(response.data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await spaceBookingService.getMyBookings();
      setBookings(response.data || []);
    } catch (error) {
      console.error('Error refreshing bookings:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
      <TouchableOpacity
        key={status}
        style={[
          styles.filterChip,
          { backgroundColor: colors.gray100, borderColor: colors.gray200 },
          isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        onPress={() => setFilter(status)}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: colors.gray700 },
            isActive && { color: colors.textOnPrimary },
          ]}
        >
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBookingItem = ({ item }: { item: SpaceBookingDetails }) => {
    const statusConfig = getStatusConfig(colors)[item.status as BookingStatus];
    const StatusIcon = statusConfig?.icon || Clock;

    const startDate = new Date(item.start_datetime);
    const endDate = new Date(item.end_datetime);

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/settings/my-reservations/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {/* Space image */}
          <View style={styles.imageContainer}>
            {item.space?.cover_image_url ? (
              <Image source={{ uri: getFullImageUrl(item.space.cover_image_url) || '' }} style={styles.spaceImage} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.gray100 }]}>
                <MapPin size={24} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </View>
            )}
          </View>

          {/* Space info */}
          <View style={styles.spaceInfo}>
            <Text style={[styles.spaceName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.space?.name || 'Espace'}
            </Text>
            <Text style={[styles.organizationName, { color: colors.gray500 }]} numberOfLines={1}>
              {item.space?.organization?.name || 'Organisation'}
            </Text>

            {/* Date & Time */}
            <View style={styles.dateTimeRow}>
              <CalendarDays size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>
                {formatDate(startDate)} - {formatTime(startDate)} a {formatTime(endDate)}
              </Text>
            </View>
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig?.bgColor || colors.gray100 }]}>
            <StatusIcon size={14} color={statusConfig?.color || colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig?.color || colors.gray500 }]}>
              {statusConfig?.label || item.status}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Users size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.gray500 }]}>
              {item.attendees_count || 1} {(item.attendees_count || 1) > 1 ? 'personnes' : 'personne'}
            </Text>
          </View>

          {item.total_price && item.total_price > 0 && (
            <Text style={[styles.priceText, { color: colors.primary }]}>
              {item.total_price.toLocaleString()} FCFA
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
        <CalendarDays size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {filter === 'all' ? 'Aucune reservation' : 'Aucun resultat'}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.gray500 }]}>
        {filter === 'all'
          ? 'Vous n\'avez pas encore de reservations. Explorez les espaces disponibles.'
          : 'Aucune reservation avec ce statut.'}
      </Text>
      {filter === 'all' && (
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Text style={[styles.exploreButtonText, { color: colors.textOnPrimary }]}>Explorer les espaces</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mes reservations</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters */}
      <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
        <FlatList
          horizontal
          data={[
            { key: 'all', label: 'Toutes' },
            { key: 'PENDING', label: 'En attente' },
            { key: 'CONFIRMED', label: 'Confirmees' },
            { key: 'COMPLETED', label: 'Terminees' },
            { key: 'CANCELLED', label: 'Annulees' },
          ]}
          renderItem={({ item }) => renderFilterChip(item.key as FilterStatus, item.label)}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
      )}

      <FooterNav activeTab="settings" />
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

  headerSpacer: {
    width: 40,
  },

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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },

  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },

  spaceImage: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  spaceInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  spaceName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: 2,
  },

  organizationName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },

  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  dateTimeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
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

  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  priceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
    marginBottom: SPACING.lg,
  },

  exploreButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.sm,
  },

  exploreButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
