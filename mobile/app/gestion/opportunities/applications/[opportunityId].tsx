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
  Eye,
  ChevronRight,
  Inbox,
  Star,
  FileText,
  Download,
  TrendingUp,
  Edit,
  Trash2,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, MATCH_COLORS, ThemeColors, COMPONENT } from '../../../../src/constants/theme';
import { Button, Chip, IconButton, PageLayout, EmptyState, SelectCard } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { useI18n } from '../../../../src/contexts/I18nContext';
import { applicationService, opportunityService } from '../../../../src/services';
import { RankedApplication } from '../../../../src/services/applicationService';
import { formatRelativeTime } from '../../../../src/utils/date';
import type { ApplicationStatus, Opportunity } from '../../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../../src/types/models';
import { useAlert } from '../../../../src/contexts/AlertContext';

// Status configuration - Luxe Africain design system
const getStatusConfig = (colors: ThemeColors): Record<ApplicationStatus, { color: string; icon: typeof Clock; bgColor: string }> => ({
  SUBMITTED: { color: colors.warning, icon: Clock, bgColor: colors.warningLight },
  IN_REVIEW: { color: colors.info, icon: Eye, bgColor: colors.infoLight },
  ACCEPTED: { color: colors.success, icon: CheckCircle2, bgColor: colors.successLight },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: colors.errorLight },
});

// Match category configuration - Luxe Africain design system
const MATCH_CATEGORY_CONFIG = {
  excellent: { label: 'Excellent', color: MATCH_COLORS.excellent.color, bgColor: MATCH_COLORS.excellent.bgColor },
  good: { label: 'Bon', color: MATCH_COLORS.good.color, bgColor: MATCH_COLORS.good.bgColor },
  average: { label: 'Moyen', color: MATCH_COLORS.average.color, bgColor: MATCH_COLORS.average.bgColor },
  low: { label: 'Faible', color: MATCH_COLORS.low.color, bgColor: MATCH_COLORS.low.bgColor },
};

type FilterStatus = 'all' | ApplicationStatus;

export default function OpportunityApplicationsScreen() {
  const { opportunityId } = useLocalSearchParams<{ opportunityId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<RankedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('SUBMITTED');
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const alerts = useAlert();

  useEffect(() => {
    loadData();
  }, [opportunityId]);

  const loadData = async () => {
    if (!opportunityId) return;

    setIsLoading(true);
    try {
      const [oppResponse, appsResponse] = await Promise.all([
        opportunityService.getById(opportunityId),
        applicationService.getRankedApplications(opportunityId),
      ]);

      setOpportunity(oppResponse.data);
      setApplications(appsResponse.data?.data || []);

      const recos: Record<string, string> = {};
      (appsResponse.data?.data || []).forEach((app: RankedApplication) => {
        if (app.ai_recommendation) {
          recos[app.id] = app.ai_recommendation;
        }
      });
      setRecommendations(recos);
    } catch (error) {
      if (__DEV__) console.error('Error loading data:', error);
      void alerts.alert('Erreur', 'Impossible de charger les candidatures.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!opportunityId) return;

    setIsRefreshing(true);
    try {
      const response = await applicationService.getRankedApplications(opportunityId);
      setApplications(response.data?.data || []);

      const recos: Record<string, string> = {};
      (response.data?.data || []).forEach((app: RankedApplication) => {
        if (app.ai_recommendation) {
          recos[app.id] = app.ai_recommendation;
        }
      });
      setRecommendations(recos);
    } catch (error) {
      if (__DEV__) console.error('Error refreshing applications:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [opportunityId]);

  const loadRecommendation = useCallback(async (applicationId: string) => {
    if (recommendations[applicationId]) return;

    try {
      const response = await applicationService.getRecommendation(applicationId);
      if (response.data?.recommendation) {
        setRecommendations(prev => ({
          ...prev,
          [applicationId]: response.data.recommendation,
        }));
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading recommendation:', error);
    }
  }, [recommendations]);

  const handleUpdateStatus = async (applicationId: string, newStatus: ApplicationStatus) => {
    try {
      await applicationService.updateStatus(applicationId, newStatus);
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: newStatus } : app))
      );
    } catch (error: any) {
      void alerts.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleExportCsv = async () => {
    if (!opportunityId) return;

    try {
      const token = await require('@react-native-async-storage/async-storage').default.getItem('auth_access_token');
      const csvUrl = applicationService.getExportCsvUrl(opportunityId, {
        status: filter !== 'all' ? filter as ApplicationStatus : undefined,
      });

      const filename = `candidatures-${opportunity?.title?.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      const downloadResult = await FileSystem.downloadAsync(csvUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadResult.status !== 200) {
        throw new Error('Erreur lors du téléchargement');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exporter les candidatures',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        void alerts.alert('Succès', 'Le fichier CSV a été téléchargé.');
      }
    } catch (error: any) {
      if (__DEV__) console.error('Error exporting CSV:', error);
      void alerts.alert('Erreur', error.message || 'Impossible d\'exporter en CSV.');
    }
  };

  const handleEdit = () => {
    if (!opportunityId) return;
    router.push(`/settings/organization/edit-opportunity/${opportunityId}` as any);
  };

  const handleDelete = () => {
    if (!opportunity || !opportunityId) return;

    void alerts.showAlert({ title: 'Supprimer l\'opportunité', message: `Êtes-vous sûr de vouloir supprimer "${opportunity.title}" ? Cette action est irréversible et supprimera toutes les candidatures associées.`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await opportunityService.delete(opportunityId);
              void alerts.showAlert({ title: 'Supprimé', message: 'L\'opportunité a été supprimée.', buttons: [
                { text: 'OK', onPress: () => router.back() },
              ] });
            } catch (error: any) {
              void alerts.alert('Erreur', error.error || 'Une erreur est survenue lors de la suppression.');
            }
          },
        },
      ] });
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

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderApplicationItem = ({ item }: { item: RankedApplication }) => {
    const statusConfigs = getStatusConfig(colors);
    const statusConfig = statusConfigs[item.status as ApplicationStatus] || statusConfigs.SUBMITTED;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const matchConfig = item.matchCategory ? MATCH_CATEGORY_CONFIG[item.matchCategory] : null;
    const recommendation = recommendations[item.id] || item.ai_recommendation;

    if (!recommendation && item.matchCategory) {
      loadRecommendation(item.id);
    }

    return (
      <SelectCard
        accessibilityLabel="Voir la candidature"
        style={[styles.applicationCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/opportunities/applications/details/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          {(talent?.profile_picture_url || talent?.avatar_url) ? (
            <Image source={{ uri: (talent.profile_picture_url || talent.avatar_url)! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name ? `${talent.first_name} ${talent.last_name}` : undefined)}
              </Text>
            </View>
          )}

          <View style={styles.talentInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.talentName, { color: colors.textPrimary }]} numberOfLines={1}>
                {talent ? `${talent.first_name} ${talent.last_name}` : 'Candidat'}
              </Text>
              {matchConfig && (
                <View style={[styles.matchBadge, { backgroundColor: matchConfig.bgColor }]}>
                  <TrendingUp size={COMPONENT.pill.iconSize} color={matchConfig.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                  <Text style={[styles.matchBadgeText, { color: matchConfig.color }]}>
                    {matchConfig.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.talentTitle, { color: colors.gray500 }]} numberOfLines={1}>
              {talent?.current_role || talent?.headline || talent?.display_name || t('common.candidate')}
            </Text>
          </View>

          <ChevronRight size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
        </View>

        {recommendation && (
          <View style={[styles.recommendationContainer, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.recommendationText, { color: colors.textSecondary }]} numberOfLines={3}>
              {recommendation}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <StatusIcon size={COMPONENT.pill.iconSize} color={statusConfig.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {APPLICATION_STATUS_LABELS[item.status]}
            </Text>
          </View>

          <View style={styles.cardMeta}>
            {item.rating && (
              <View style={styles.ratingBadge}>
                <Star size={12} color={colors.warning} fill={colors.warning} />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                  {item.rating}
                </Text>
              </View>
            )}

            {item.resume_url && (
              <FileText size={14} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            )}

            <Text style={[styles.appliedDate, { color: colors.gray500 }]}>
              {formatRelativeTime(item.applied_at)}
            </Text>
          </View>
        </View>

        {item.status === 'SUBMITTED' && (
          <View style={[styles.quickActions, { borderTopColor: colors.borderColor }]}>
            <Button
              title="Examiner"
              size="sm"
              variant="secondary"
              onPress={() => handleUpdateStatus(item.id, 'IN_REVIEW')}
              style={{ flex: 1, backgroundColor: withOpacity(colors.info, OPACITY[15]) }}
              textStyle={{ color: colors.info }}
              icon={<Eye size={14} color={colors.info} strokeWidth={ICON.strokeWidth} />}
            />
            <Button
              title="Refuser"
              size="sm"
              variant="secondary"
              onPress={() => handleUpdateStatus(item.id, 'REJECTED')}
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
    { key: 'all' as FilterStatus, label: 'Toutes', count: statusCounts.all || 0 },
    { key: 'SUBMITTED' as FilterStatus, label: 'Soumises', count: statusCounts['SUBMITTED'] || 0 },
    { key: 'IN_REVIEW' as FilterStatus, label: "En cours d'examen", count: statusCounts['IN_REVIEW'] || 0 },
    { key: 'ACCEPTED' as FilterStatus, label: 'Acceptées', count: statusCounts['ACCEPTED'] || 0 },
    { key: 'REJECTED' as FilterStatus, label: 'Refusées', count: statusCounts['REJECTED'] || 0 },
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
                { color: isActive ? colors.textOnPrimary : colors.textPrimary },
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
        onPress={handleEdit}
        icon={<Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel="Modifier"
      />
      <IconButton
        onPress={handleDelete}
        icon={<Trash2 size={20} color={colors.error} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel="Supprimer"
      />
      <IconButton
        onPress={handleExportCsv}
        icon={<Download size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
        accessibilityLabel="Exporter CSV"
      />
    </View>
  );

  const emptySubtitle = filter === 'all'
    ? 'Cette opportunité n\'a pas encore reçu de candidatures.'
    : 'Aucune candidature avec ce statut.';

  return (
    <PageLayout
      title="Candidatures"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      rightAction={rightAction}
      useScrollView={false}
    >
      <FlatList
        data={filteredApplications}
        keyExtractor={(a) => a.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            {renderApplicationItem({ item })}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Inbox}
            title={filter === 'all' ? 'Aucune candidature' : 'Aucun résultat'}
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

  applicationCard: {
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

  talentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },

  talentName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    flexShrink: 1,
  },

  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },

  matchBadgeText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },

  talentTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  recommendationContainer: {
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  recommendationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
    fontStyle: 'italic',
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

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  ratingText: {
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
    borderTopColor: 'transparent',
  },
});
