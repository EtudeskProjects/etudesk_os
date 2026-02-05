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
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { PageLayout, EmptyState } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { applicationService, opportunityService } from '../../../../src/services';
import { RankedApplication } from '../../../../src/services/applicationService';
import { formatRelativeTime } from '../../../../src/utils/date';
import type { ApplicationStatus, Opportunity } from '../../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../../src/types/models';

// Status color constants for static configuration
const STATUS_COLORS = {
  warning: '#F59E0B',
  info: '#3B82F6',
  success: '#10B981',
  error: '#EF4444',
};

// Status configuration
const STATUS_CONFIG: Record<ApplicationStatus, { color: string; icon: typeof Clock; bgColor: string }> = {
  SUBMITTED: { color: STATUS_COLORS.warning, icon: Clock, bgColor: withOpacity(STATUS_COLORS.warning, OPACITY[15]) },
  IN_REVIEW: { color: STATUS_COLORS.info, icon: Eye, bgColor: withOpacity(STATUS_COLORS.info, OPACITY[15]) },
  ACCEPTED: { color: STATUS_COLORS.success, icon: CheckCircle2, bgColor: withOpacity(STATUS_COLORS.success, OPACITY[15]) },
  REJECTED: { color: STATUS_COLORS.error, icon: XCircle, bgColor: withOpacity(STATUS_COLORS.error, OPACITY[15]) },
};

// Match category configuration
const MATCH_CATEGORY_CONFIG = {
  excellent: { label: 'Excellent', color: '#059669', bgColor: withOpacity('#059669', OPACITY[15]) },
  good: { label: 'Bon', color: '#2563eb', bgColor: withOpacity('#2563eb', OPACITY[15]) },
  average: { label: 'Moyen', color: '#d97706', bgColor: withOpacity('#d97706', OPACITY[15]) },
  low: { label: 'Faible', color: '#dc2626', bgColor: withOpacity('#dc2626', OPACITY[15]) },
};

type FilterStatus = 'all' | ApplicationStatus;

export default function OpportunityApplicationsScreen() {
  const { opportunityId } = useLocalSearchParams<{ opportunityId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<RankedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('SUBMITTED');
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});

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
      setApplications(appsResponse.data || []);

      const recos: Record<string, string> = {};
      (appsResponse.data || []).forEach((app: RankedApplication) => {
        if (app.ai_recommendation) {
          recos[app.id] = app.ai_recommendation;
        }
      });
      setRecommendations(recos);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les candidatures.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!opportunityId) return;

    setIsRefreshing(true);
    try {
      const response = await applicationService.getRankedApplications(opportunityId);
      setApplications(response.data || []);

      const recos: Record<string, string> = {};
      (response.data || []).forEach((app: RankedApplication) => {
        if (app.ai_recommendation) {
          recos[app.id] = app.ai_recommendation;
        }
      });
      setRecommendations(recos);
    } catch (error) {
      console.error('Error refreshing applications:', error);
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
      console.error('Error loading recommendation:', error);
    }
  }, [recommendations]);

  const handleUpdateStatus = async (applicationId: string, newStatus: ApplicationStatus) => {
    try {
      await applicationService.updateStatus(applicationId, newStatus);
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: newStatus } : app))
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
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
        Alert.alert('Succès', 'Le fichier CSV a été téléchargé.');
      }
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'exporter en CSV.');
    }
  };

  const handleEdit = () => {
    if (!opportunityId) return;
    router.push(`/settings/organization/edit-opportunity/${opportunityId}` as any);
  };

  const handleDelete = () => {
    if (!opportunity || !opportunityId) return;

    Alert.alert(
      'Supprimer l\'opportunité',
      `Êtes-vous sûr de vouloir supprimer "${opportunity.title}" ? Cette action est irréversible et supprimera toutes les candidatures associées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await opportunityService.delete(opportunityId);
              Alert.alert('Supprimé', 'L\'opportunité a été supprimée.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Une erreur est survenue lors de la suppression.');
            }
          },
        },
      ]
    );
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
    const statusConfig = STATUS_CONFIG[item.status as ApplicationStatus] || STATUS_CONFIG.SUBMITTED;
    const StatusIcon = statusConfig.icon;
    const talent = item.talent;
    const matchConfig = item.matchCategory ? MATCH_CATEGORY_CONFIG[item.matchCategory] : null;
    const recommendation = recommendations[item.id] || item.ai_recommendation;

    if (!recommendation && item.matchCategory) {
      loadRecommendation(item.id);
    }

    return (
      <TouchableOpacity
        style={[styles.applicationCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
        onPress={() => router.push(`/gestion/opportunities/applications/details/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {talent?.profile_picture_url ? (
            <Image source={{ uri: talent.profile_picture_url }} style={styles.avatar} />
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
                  <TrendingUp size={10} color={matchConfig.color} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.matchBadgeText, { color: matchConfig.color }]}>
                    {matchConfig.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.talentTitle, { color: colors.gray500 }]} numberOfLines={1}>
              {talent?.current_role || talent?.display_name || 'Candidat'}
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
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
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
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}
              onPress={() => handleUpdateStatus(item.id, 'IN_REVIEW')}
            >
              <Eye size={14} color={colors.info} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.info }]}>Examiner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}
              onPress={() => handleUpdateStatus(item.id, 'REJECTED')}
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
                  { color: isActive ? colors.textOnPrimary : colors.textPrimary },
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
      <TouchableOpacity onPress={handleEdit} style={styles.headerActionButton}>
        <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDelete} style={styles.headerActionButton}>
        <Trash2 size={20} color={colors.error} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleExportCsv} style={styles.headerActionButton}>
        <Download size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
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
    >
      {filteredApplications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'all' ? 'Aucune candidature' : 'Aucun résultat'}
          subtitle={emptySubtitle}
        />
      ) : (
        filteredApplications.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {renderApplicationItem({ item })}
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
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.sm,
  },

  matchBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs - 1,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
