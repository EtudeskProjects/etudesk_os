import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Briefcase,
  Users,
  MapPin,
  Bell,
  Calendar,
  CalendarDays,
  ChevronRight,
  Plus,
  Building2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
  CloudSun,
  Target,
  TrendingUp,
  FileText,
  Search,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Header, FooterNav } from '../../../src/components/ui';
import { CreateOfferModal } from '../../../src/components/CreateOfferModal';
import { formatCompactNumber } from '../../../src/utils/number';
import {
  opportunityService,
  communityService,
  spaceService,
} from '../../../src/services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Palette de couleurs pâles cohérentes
const PASTEL_COLORS = {
  green: { bg: '#E8F5E9', icon: '#4CAF50', text: '#2E7D32' },
  blue: { bg: '#E3F2FD', icon: '#2196F3', text: '#1565C0' },
  purple: { bg: '#F3E5F5', icon: '#9C27B0', text: '#7B1FA2' },
  orange: { bg: '#FFF3E0', icon: '#FF9800', text: '#EF6C00' },
  red: { bg: '#FFEBEE', icon: '#F44336', text: '#C62828' },
  teal: { bg: '#E0F2F1', icon: '#009688', text: '#00796B' },
  indigo: { bg: '#E8EAF6', icon: '#3F51B5', text: '#303F9F' },
  amber: { bg: '#FFF8E1', icon: '#FFC107', text: '#FF8F00' },
};

interface QuickStats {
  opportunities: number;
  communities: number;
  spaces: number;
  applications: number;
  members: number;
}

interface Activity {
  id: string;
  type: 'opportunity' | 'community' | 'space' | 'application';
  title: string;
  message: string;
  time: string;
}

export default function GestionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { selectedOrg, isOrganizationSpace } = useSpace();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic data states
  const [stats, setStats] = useState<QuickStats>({
    opportunities: 0,
    communities: 0,
    spaces: 0,
    applications: 0,
    members: 0,
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dailyInsight, setDailyInsight] = useState<string>('');

  // Get greeting based on time of day
  const getGreeting = (): { text: string; icon: typeof Sun } => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bonjour', icon: Sun };
    if (hour < 18) return { text: 'Bon après-midi', icon: CloudSun };
    return { text: 'Bonsoir', icon: Moon };
  };

  // Format relative date
  const formatRelativeDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays}j`;
  };

  // Load organization data
  const loadOrganizationData = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const [opportunitiesRes, communitiesRes, spacesRes] = await Promise.allSettled([
        opportunityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        communityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        spaceService.getByOrganization(selectedOrg.id, { limit: 100 }),
      ]);

      const opportunities = opportunitiesRes.status === 'fulfilled' && opportunitiesRes.value.data
        ? opportunitiesRes.value.data : [];
      const communities = communitiesRes.status === 'fulfilled' && communitiesRes.value.data
        ? communitiesRes.value.data : [];
      const spaces = spacesRes.status === 'fulfilled' && spacesRes.value.data
        ? spacesRes.value.data : [];

      const totalApplications = opportunities.reduce((sum, o) => sum + (o.applications_count || 0), 0);
      const totalMembers = communities.reduce((sum, c) => sum + (c.members_count || 0), 0);

      setStats({
        opportunities: opportunities.length,
        communities: communities.length,
        spaces: spaces.length,
        applications: totalApplications,
        members: totalMembers,
      });

      // Build recent activities
      const activities: Activity[] = [];

      opportunities.slice(0, 2).forEach(opp => {
        if (opp.applications_count && opp.applications_count > 0) {
          activities.push({
            id: `opp-${opp.id}`,
            type: 'application',
            title: 'Nouvelle candidature',
            message: `${opp.applications_count} candidature(s) pour "${opp.title}"`,
            time: formatRelativeDate(opp.updated_at || opp.created_at),
          });
        }
      });

      communities.slice(0, 1).forEach(comm => {
        activities.push({
          id: `comm-${comm.id}`,
          type: 'community',
          title: 'Communauté active',
          message: `${comm.members_count || 0} membres dans "${comm.name}"`,
          time: formatRelativeDate(comm.updated_at || comm.created_at),
        });
      });

      setRecentActivities(activities.slice(0, 5));

      // Objectif du jour (message pertinent pour les organisations)
      const activeOpps = opportunities.filter(o => o.status === 'OPEN').length;
      if (totalApplications > 0) {
        setDailyInsight(`Priorisez l'examen des ${totalApplications} candidature(s) en attente pour ne pas faire attendre les talents.`);
      } else if (activeOpps > 0) {
        setDailyInsight(`Vous avez ${activeOpps} opportunité(s) ouverte(s). Pensez à les promouvoir auprès de vos communautés pour maximiser les candidatures.`);
      } else {
        setDailyInsight('Publiez votre première opportunité, créez une communauté ou ajoutez un espace pour commencer à attirer des talents.');
      }
    } catch (error) {
      console.error('[Gestion] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    loadOrganizationData();
  }, [loadOrganizationData]);

  useFocusEffect(
    useCallback(() => {
      loadOrganizationData();
    }, [loadOrganizationData])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadOrganizationData();
  }, [loadOrganizationData]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Quick action blocks configuration for organizations
  const quickActions = [
    {
      id: 'opportunities',
      label: 'Opportunités',
      icon: Briefcase,
      color: PASTEL_COLORS.green,
      count: stats.opportunities,
      route: '/gestion/opportunities',
    },
    {
      id: 'communities',
      label: 'Communautés',
      icon: Users,
      color: PASTEL_COLORS.blue,
      count: stats.communities,
      route: '/gestion/communities',
    },
    {
      id: 'spaces',
      label: 'Espaces',
      icon: MapPin,
      color: PASTEL_COLORS.orange,
      count: stats.spaces,
      route: '/gestion/spaces',
    },
    {
      id: 'applications',
      label: 'Candidatures',
      icon: FileText,
      color: PASTEL_COLORS.purple,
      count: stats.applications,
      route: '/gestion/opportunities',
    },
    {
      id: 'members',
      label: 'Membres',
      icon: Users,
      color: PASTEL_COLORS.indigo,
      count: stats.members,
      route: '/gestion/communities',
    },
  ];

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'opportunity': return Briefcase;
      case 'community': return Users;
      case 'space': return MapPin;
      case 'application': return FileText;
      default: return Bell;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'opportunity': return PASTEL_COLORS.green;
      case 'community': return PASTEL_COLORS.blue;
      case 'space': return PASTEL_COLORS.orange;
      case 'application': return PASTEL_COLORS.purple;
      default: return PASTEL_COLORS.indigo;
    }
  };

  // Si pas en mode organisation, afficher un message
  if (!isOrganizationSpace || !selectedOrg) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: PASTEL_COLORS.indigo.bg }]}>
            <Building2 size={40} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('management.noOrganization')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('management.selectOrganization')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={[styles.emptyButtonText, { color: colors.textOnPrimary }]}>{t('management.goToSettings')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Header
        title={t('ecosystem.title')}
        rightContent={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
              activeOpacity={0.8}
            >
              <Bell size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Greeting */}
            <View style={styles.greetingSection}>
              <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
                {greeting.text}, {selectedOrg.name} 👋
              </Text>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </Text>
            </View>

            {/* Objectif du jour (organisations) */}
            <View style={[styles.insightContainer, { backgroundColor: PASTEL_COLORS.indigo.bg }]}>
              <View style={styles.insightHeader}>
                <Target size={16} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.insightLabel, { color: PASTEL_COLORS.indigo.text }]}>Objectif du jour</Text>
              </View>
              <Text style={[styles.insightText, { color: colors.textPrimary }]}>
                {dailyInsight}
              </Text>
            </View>

            {/* Quick Actions Grid */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: PASTEL_COLORS.indigo.bg }]}>
                    <Search size={14} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tableau de bord</Text>
                </View>
              </View>
              <View style={styles.quickActionsGrid}>
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <TouchableOpacity
                      key={action.id}
                      style={[styles.quickActionCard, { backgroundColor: action.color.bg }]}
                      onPress={() => router.push(action.route as any)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.quickActionIconContainer, { backgroundColor: colors.surface }]}>
                        <IconComponent size={22} color={action.color.icon} strokeWidth={ICON.strokeWidth} />
                      </View>
                      <Text style={[styles.quickActionLabel, { color: action.color.text }]} numberOfLines={2}>
                        {action.label}
                      </Text>
                      <View style={[styles.quickActionBadge, { backgroundColor: action.color.icon }]}>
                        <Text style={[styles.quickActionBadgeText, { color: colors.textOnPrimary }]}>{formatCompactNumber(action.count)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.createButtonText, { color: colors.textOnPrimary }]}>Créer une offre</Text>
            </TouchableOpacity>

            {/* Recent Activity Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: PASTEL_COLORS.orange.bg }]}>
                    <Bell size={14} color={PASTEL_COLORS.orange.icon} strokeWidth={ICON.strokeWidth} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activité récente</Text>
                </View>
                <TouchableOpacity>
                  <Text style={[styles.seeMore, { color: colors.primary }]}>Voir tout</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.activitiesContainer, { backgroundColor: colors.surface }]}>
                {recentActivities.length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Bell size={40} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      Aucune activité récente
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.gray400 }]}>
                      Créez des offres pour voir l'activité
                    </Text>
                  </View>
                ) : (
                  recentActivities.map((activity, index) => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    const activityColor = getActivityColor(activity.type);
                    const isLast = index === recentActivities.length - 1;
                    return (
                      <TouchableOpacity
                        key={activity.id}
                        style={[
                          styles.activityItem,
                          { borderBottomColor: colors.gray100 },
                          isLast && styles.activityItemLast,
                        ]}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.activityIconBox, { backgroundColor: activityColor.bg }]}>
                          <ActivityIcon size={18} color={activityColor.icon} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {activity.title}
                          </Text>
                          <Text style={[styles.activityMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                            {activity.message}
                          </Text>
                        </View>
                        <Text style={[styles.activityTime, { color: colors.gray400 }]}>
                          {activity.time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* Bottom spacing */}
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>

      <CreateOfferModal
        isVisible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
    paddingVertical: SPACING.xxl * 2,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },

  // Greeting Section
  greetingSection: {
    marginBottom: SPACING.md,
  },

  greetingText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs,
  },

  dateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textTransform: 'capitalize',
  },

  // Insight Container
  insightContainer: {
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },

  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },

  insightLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  insightText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  seeMore: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },

  quickActionCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm) / 2,
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    alignItems: 'center',
    position: 'relative',
  },

  quickActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },

  quickActionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.3,
  },

  quickActionBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  quickActionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Create Button
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  createButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Activities
  activitiesContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  activityItemLast: {
    borderBottomWidth: 0,
  },

  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },

  activityTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 2,
  },

  activityMessage: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  activityTime: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    marginLeft: SPACING.sm,
  },

  // Empty States
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BORDER.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
    marginBottom: SPACING.lg,
  },

  emptyButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.sm,
  },

  emptyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },

  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: SPACING.md,
  },

  emptyStateSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Bottom Spacer
  bottomSpacer: {
    height: SPACING.xxl,
  },
});
