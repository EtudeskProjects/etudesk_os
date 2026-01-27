import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronRight,
  Inbox,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { applicationService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import type { Application, ApplicationStatus } from '../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../src/types/models';

// Status configuration - Simplified to 4 statuses
const getStatusConfig = (colors: any): Record<ApplicationStatus, { color: string; icon: typeof Clock; bgColor: string }> => ({
  SUBMITTED: { color: colors.warning, icon: Clock, bgColor: colors.warning + '15' },
  IN_REVIEW: { color: colors.info, icon: Eye, bgColor: colors.info + '15' },
  ACCEPTED: { color: colors.success, icon: CheckCircle2, bgColor: colors.success + '15' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: colors.error + '15' },
});

type FilterStatus = 'all' | ApplicationStatus;

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const response = await applicationService.getMyApplications();
      setApplications(response.data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await applicationService.getMyApplications();
      setApplications(response.data || []);
    } catch (error) {
      console.error('Error refreshing applications:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: applications.length };
    applications.forEach((app) => {
      counts[app.status] = (counts[app.status] || 0) + 1;
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

  const renderApplicationItem = ({ item }: { item: Application }) => {
    const statusConfig = getStatusConfig(colors)[item.status];
    const StatusIcon = statusConfig.icon;

    return (
      <TouchableOpacity
        style={[styles.applicationCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/settings/my-applications/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.opportunityInfo}>
            <Text style={[styles.opportunityTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.opportunity?.title || 'Opportunité'}
            </Text>
            <Text style={[styles.organizationName, { color: colors.gray500 }]} numberOfLines={1}>
              {item.opportunity?.organization?.name || 'Organisation'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {APPLICATION_STATUS_LABELS[item.status]}
            </Text>
          </View>

          <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
            {formatRelativeTime(item.applied_at)}
          </Text>
        </View>

      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
        <Inbox size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {filter === 'all' ? 'Aucune candidature' : 'Aucun résultat'}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.gray500 }]}>
        {filter === 'all'
          ? 'Vous n\'avez pas encore postulé à des opportunités. Explorez les offres disponibles.'
          : 'Aucune candidature avec ce statut.'}
      </Text>
      {filter === 'all' && (
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Text style={[styles.exploreButtonText, { color: colors.textOnPrimary }]}>Explorer les opportunités</Text>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mes candidatures</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters */}
      <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
        <FlatList
          horizontal
          data={[
            { key: 'all', label: 'Toutes' },
            { key: 'SUBMITTED', label: 'Soumises' },
            { key: 'IN_REVIEW', label: 'En examen' },
            { key: 'ACCEPTED', label: 'Acceptées' },
            { key: 'REJECTED', label: 'Refusées' },
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
          data={filteredApplications}
          renderItem={renderApplicationItem}
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

      <FooterNav activeTab="home" />
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

  applicationCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },

  opportunityInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  opportunityTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: 4,
  },

  organizationName: {
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
