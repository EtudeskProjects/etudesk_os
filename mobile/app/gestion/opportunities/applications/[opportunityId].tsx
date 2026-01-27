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
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../src/constants/theme';

// Status color constants for static configuration
const STATUS_COLORS = {
  warning: '#F59E0B',
  info: '#3B82F6',
  success: '#10B981',
  error: '#EF4444',
  gray200: '#E5E7EB',
};
import { FooterNav } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/hooks/useTheme';
import { applicationService, opportunityService } from '../../../../src/services';
import { RankedApplication } from '../../../../src/services/applicationService';
import { formatRelativeTime } from '../../../../src/utils/date';
import type { ApplicationStatus, Opportunity } from '../../../../src/types/models';
import { APPLICATION_STATUS_LABELS } from '../../../../src/types/models';

// Status configuration - Simplified to 4 statuses
const STATUS_CONFIG: Record<ApplicationStatus, { color: string; icon: typeof Clock; bgColor: string }> = {
  SUBMITTED: { color: STATUS_COLORS.warning, icon: Clock, bgColor: STATUS_COLORS.warning + '15' },
  IN_REVIEW: { color: STATUS_COLORS.info, icon: Eye, bgColor: STATUS_COLORS.info + '15' },
  ACCEPTED: { color: STATUS_COLORS.success, icon: CheckCircle2, bgColor: STATUS_COLORS.success + '15' },
  REJECTED: { color: STATUS_COLORS.error, icon: XCircle, bgColor: STATUS_COLORS.error + '15' },
};

// Match category configuration
const MATCH_CATEGORY_CONFIG = {
  excellent: { label: 'Excellent', color: '#059669', bgColor: '#059669' + '15' },
  good: { label: 'Bon', color: '#2563eb', bgColor: '#2563eb' + '15' },
  average: { label: 'Moyen', color: '#d97706', bgColor: '#d97706' + '15' },
  low: { label: 'Faible', color: '#dc2626', bgColor: '#dc2626' + '15' },
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
  const [filter, setFilter] = useState<FilterStatus>('all');
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

      // Pre-populate recommendations from ranked data
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

      // Update recommendations
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

  // Lazy load recommendation for a specific application
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

  const handleExportPdf = async () => {
    if (!opportunityId) return;

    try {
      const response = await applicationService.exportToPdf(opportunityId);
      Alert.alert('Export PDF', `Le PDF a été généré avec succès.`);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de générer le PDF.');
    }
  };

  const handleExportCsv = async () => {
    if (!opportunityId) return;

    try {
      // Get the token for authentication
      const token = await require('@react-native-async-storage/async-storage').default.getItem('auth_access_token');
      const csvUrl = applicationService.getExportCsvUrl(opportunityId, {
        status: filter !== 'all' ? filter as ApplicationStatus : undefined,
      });

      // Download the file
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

      // Share the file
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

    // Trigger lazy load of recommendation if not already loaded
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
          {/* Avatar */}
          {talent?.profile_picture_url ? (
            <Image source={{ uri: talent.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name ? `${talent.first_name} ${talent.last_name}` : undefined)}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.talentInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.talentName, { color: colors.textPrimary }]} numberOfLines={1}>
                {talent ? `${talent.first_name} ${talent.last_name}` : 'Candidat'}
              </Text>
              {/* Match category badge */}
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

        {/* Recommendation */}
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

        {/* Quick actions */}
        {item.status === 'SUBMITTED' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.info + '15' }]}
              onPress={() => handleUpdateStatus(item.id, 'IN_REVIEW')}
            >
              <Eye size={14} color={colors.info} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.quickActionText, { color: colors.info }]}>Examiner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: colors.error + '15' }]}
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
          ? 'Cette opportunité n\'a pas encore reçu de candidatures.'
          : 'Aucune candidature avec ce statut.'}
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
            Candidatures
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.gray500 }]} numberOfLines={1}>
            {opportunity?.title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionButton}>
            <Edit size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
            <Trash2 size={20} color={colors.error} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportCsv} style={styles.actionButton}>
            <Download size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
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
            {applications.length}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'all' ? colors.primary : colors.gray500 }]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'IN_REVIEW' && { backgroundColor: colors.info + '12', borderColor: colors.info + '50' }
          ]}
          onPress={() => setFilter('IN_REVIEW')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.info }]}>
            {statusCounts['IN_REVIEW'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'IN_REVIEW' ? colors.info : colors.gray500 }]}>En examen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'ACCEPTED' && { backgroundColor: colors.success + '12', borderColor: colors.success + '50' }
          ]}
          onPress={() => setFilter('ACCEPTED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.success }]}>
            {statusCounts['ACCEPTED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'ACCEPTED' ? colors.success : colors.gray500 }]}>Acceptées</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statItem,
            { backgroundColor: colors.surface, borderColor: colors.gray200 },
            filter === 'REJECTED' && { backgroundColor: colors.error + '12', borderColor: colors.error + '50' }
          ]}
          onPress={() => setFilter('REJECTED')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.error }]}>
            {statusCounts['REJECTED'] || 0}
          </Text>
          <Text style={[styles.statLabel, { color: filter === 'REJECTED' ? colors.error : colors.gray500 }]}>Rejetées</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
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
