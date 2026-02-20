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
  Eye,
  Inbox,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { PageLayout, EmptyState, Chip } from '../../../src/components/ui';
import { OpportunityCard } from '../../../src/components/cards';
import { applicationService } from '../../../src/services';
import type { Application, ApplicationStatus, Opportunity } from '../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../src/types/models';

const getStatusConfig = (colors: any): Record<string, { color: string; icon: typeof Clock; bgColor: string }> => ({
  SUBMITTED: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]) },
  IN_REVIEW: { color: colors.info, icon: Eye, bgColor: withOpacity(colors.info, OPACITY[15]) },
  ACCEPTED: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]) },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]) },
});

type FilterStatus = 'all' | ApplicationStatus;

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const loadApplications = useCallback(async () => {
    try {
      const response = await applicationService.getMyApplications();
      setApplications(response.data || []);
    } catch (error) {
      if (__DEV__) console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadApplications();
  };

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

  const renderApplicationItem = (item: Application) => {
    const statusConfig = getStatusConfig(colors)[item.status] || getStatusConfig(colors)['SUBMITTED'];
    const StatusIcon = statusConfig.icon;

    return (
      <OpportunityCard
        key={item.id}
        opportunity={(item.opportunity || {}) as Opportunity}
        onPress={() => router.push(`/settings/my-applications/${item.id}`)}
        statusOverlay={{
          label: APPLICATION_STATUS_LABELS[item.status],
          color: statusConfig.color,
          bgColor: statusConfig.bgColor,
          icon: <StatusIcon size={12} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />,
        }}
      />
    );
  };

  const filterChips = [
    { key: 'all' as FilterStatus, label: 'Toutes' },
    { key: 'SUBMITTED' as FilterStatus, label: 'Soumises' },
    { key: 'IN_REVIEW' as FilterStatus, label: "En cours d'examen" },
    { key: 'ACCEPTED' as FilterStatus, label: 'Acceptées' },
    { key: 'REJECTED' as FilterStatus, label: 'Refusées' },
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
      title="Mes candidatures"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      useScrollView={false}
    >
      <FlatList
        data={filteredApplications}
        keyExtractor={(a) => a.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => renderApplicationItem(item)}
        ListEmptyComponent={
          <EmptyState
            icon={Inbox}
            title={filter === 'all' ? 'Aucune candidature' : 'Aucun résultat'}
            subtitle={
              filter === 'all'
                ? "Vous n'avez pas encore postulé à des opportunités. Explorez les offres disponibles."
                : 'Aucune candidature avec ce statut.'
            }
            {...(filter === 'all' ? {
              actionLabel: 'Explorer',
              onAction: () => router.push('/(tabs)/explore?category=opportunities'),
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
