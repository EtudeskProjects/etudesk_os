import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
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
  Heart,
  FolderOpen,
  Coins,
  Gem,
  User,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, ThemeColors } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Header, FooterNav, Button, IconButton, SelectCard, LoadingShimmer } from '../../../src/components/ui';
import { CreateOfferModal } from '../../../src/components/CreateOfferModal';
import { formatCompactNumber, formatNumberNoTrailingZeros } from '../../../src/utils/number';
import {
  opportunityService,
  communityService,
  spaceService,
  orgTalentService,
  orgDocumentService,
  billingService,
  dailyObjectiveService,
  type DailyObjective,
} from '../../../src/services';
import { notificationService, type Notification as EcoNotification } from '../../../src/services/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Palette Luxe Africain - Theme-aware colors for quick action cards
const getPastelColors = (colors: ThemeColors) => ({
  green: { bg: colors.successLight, icon: colors.success, text: colors.successDark },
  blue: { bg: colors.infoLight, icon: colors.info, text: colors.infoDark },
  purple: { bg: colors.cardTalent, icon: colors.primaryMuted, text: colors.primaryDark },
  orange: { bg: colors.warningLight, icon: colors.warning, text: colors.warningDark },
  red: { bg: colors.errorLight, icon: colors.error, text: colors.errorDark },
  teal: { bg: colors.cardCommunity, icon: colors.cardCommunityText, text: colors.success },
  indigo: { bg: colors.cardOrg, icon: colors.primary, text: colors.primaryDark },
  amber: { bg: colors.cardOpportunity, icon: colors.warning, text: colors.warningDark },
});

interface QuickStats {
  opportunities: number;
  communities: number;
  spaces: number;
  applications: number;
  members: number;
  talents: number;
  documents: number;
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
  const PASTEL_COLORS = getPastelColors(colors);
  const CARD_THEMES = {
    talent: { bg: colors.cardTalent, icon: colors.cardTalentAccent, text: colors.cardTalentText },
    org: { bg: colors.cardOrg, icon: colors.cardOrgAccent, text: colors.cardOrgText },
    opportunity: { bg: colors.cardOpportunity, icon: colors.cardOpportunityAccent, text: colors.cardOpportunityText },
    community: { bg: colors.cardCommunity, icon: colors.cardCommunityAccent, text: colors.cardCommunityText },
    space: { bg: colors.cardSpace, icon: colors.cardSpaceAccent, text: colors.cardSpaceText },
  };
  const { t, locale } = useI18n();
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
    talents: 0,
    documents: 0,
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dailyObjective, setDailyObjective] = useState<DailyObjective | null>(null);
  const [isObjectiveExpanded, setIsObjectiveExpanded] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<EcoNotification[]>([]);

  // Get greeting based on time of day
  const getGreeting = (): { text: string; icon: typeof Sun } => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: t('screens.gestion.greeting'), icon: Sun };
    if (hour < 18) return { text: t('screens.gestion.goodAfternoon'), icon: CloudSun };
    return { text: t('screens.gestion.goodEvening'), icon: Moon };
  };

  // Format relative date
  const formatRelativeDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return t('common.time.justNow');
    if (diffHours < 24) return t('common.time.hours', { count: diffHours });
    if (diffDays === 1) return t('screens.gestion.yesterday');
    return t('common.time.days', { count: diffDays });
  };

  // Load organization data
  const loadOrganizationData = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const [opportunitiesRes, communitiesRes, spacesRes, talentCountRes, docStatsRes, balanceRes] = await Promise.allSettled([
        opportunityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        communityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        spaceService.getByOrganization(selectedOrg.id, { limit: 100 }),
        orgTalentService.getTalentCount(selectedOrg.id),
        orgDocumentService.getDocumentStats(selectedOrg.id),
        billingService.getBalance('ORGANIZATION', selectedOrg.id),
      ]);

      if (balanceRes.status === 'fulfilled') {
        const bal = balanceRes.value?.data?.balance_credits ?? null;
        setCreditBalance(typeof bal === 'number' ? bal : null);
      }

      const opportunities = opportunitiesRes.status === 'fulfilled' && opportunitiesRes.value.data
        ? opportunitiesRes.value.data : [];
      const communities = communitiesRes.status === 'fulfilled' && communitiesRes.value.data
        ? communitiesRes.value.data : [];
      const spaces = spacesRes.status === 'fulfilled' && spacesRes.value.data
        ? spacesRes.value.data : [];

      const totalApplications = opportunities.reduce((sum, o) => sum + (o.applications_count || 0), 0);
      const totalMembers = communities.reduce((sum, c) => sum + (c.members_count || 0), 0);

      const talentCount = talentCountRes.status === 'fulfilled' ? talentCountRes.value : 0;
      const docTotal = docStatsRes.status === 'fulfilled' ? docStatsRes.value.total : 0;

      setStats({
        opportunities: opportunities.length,
        communities: communities.length,
        spaces: spaces.length,
        applications: totalApplications,
        members: totalMembers,
        talents: talentCount,
        documents: docTotal,
      });

      // Build recent activities
      const activities: Activity[] = [];

      opportunities.slice(0, 2).forEach(opp => {
        if (opp.applications_count && opp.applications_count > 0) {
          activities.push({
            id: `opp-${opp.id}`,
            type: 'application',
            title: t('screens.gestion.newApplication'),
            message: t('screens.gestion.applicationCount', { count: formatNumberNoTrailingZeros(opp.applications_count, 0), title: opp.title }),
            time: formatRelativeDate(opp.updated_at || opp.created_at),
          });
        }
      });

      communities.slice(0, 1).forEach(comm => {
        activities.push({
          id: `comm-${comm.id}`,
          type: 'community',
          title: t('screens.gestion.activeCommunity'),
          message: t('screens.gestion.memberCount', { count: formatNumberNoTrailingZeros(comm.members_count || 0, 0), name: comm.name }),
          time: formatRelativeDate(comm.updated_at || comm.created_at),
        });
      });

      setRecentActivities(activities.slice(0, 5));
    } catch (error) {
      if (__DEV__) console.error('[Gestion] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  const loadNotifications = useCallback(async () => {
    try {
      const response: any = await notificationService.getNotifications({ limit: 5 });
      const notifs = response?.data ?? [];
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
    } catch (error) {
      if (__DEV__) console.error('[Gestion] Failed to load notifications:', error);
    }
  }, []);

  const loadDailyObjective = useCallback(async () => {
    if (!selectedOrg?.id) return;
    try {
      const response = await dailyObjectiveService.getOrganizationObjective(selectedOrg.id);
      if (response.data) {
        setDailyObjective(response.data);
        setIsObjectiveExpanded(false);
      }
    } catch (error) {
      if (__DEV__) console.error('[Gestion] Failed to load daily objective:', error);
    }
  }, [selectedOrg?.id]);

  const formatRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('common.time.justNow');
    if (min < 60) return t('common.time.minutes', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('common.time.hours', { count: h });
    const d = Math.floor(h / 24);
    if (d < 7) return t('common.time.days', { count: d });
    return t('common.time.weeks', { count: Math.floor(d / 7) });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPLICATION': return CheckCircle;
      case 'OPPORTUNITY': return Briefcase;
      case 'COMMUNITY': return Users;
      case 'SYSTEM': return AlertCircle;
      case 'SPACE': return MapPin;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'APPLICATION': return { bg: CARD_THEMES.talent.bg, icon: CARD_THEMES.talent.icon };
      case 'OPPORTUNITY': return { bg: CARD_THEMES.opportunity.bg, icon: CARD_THEMES.opportunity.icon };
      case 'COMMUNITY': return { bg: CARD_THEMES.community.bg, icon: CARD_THEMES.community.icon };
      case 'SYSTEM': return { bg: CARD_THEMES.space.bg, icon: CARD_THEMES.space.icon };
      case 'SPACE': return { bg: CARD_THEMES.space.bg, icon: CARD_THEMES.space.icon };
      default: return { bg: colors.gray100, icon: colors.textSecondary };
    }
  };

  // Truncate objective to 200 characters for "Voir plus"
  const OBJECTIVE_TRUNCATE_LENGTH = 200;
  const getDisplayedObjective = (): string => {
    if (!dailyObjective?.objective) {
      return t('screens.gestion.defaultObjective');
    }
    if (isObjectiveExpanded || dailyObjective.objective.length <= OBJECTIVE_TRUNCATE_LENGTH) {
      return dailyObjective.objective;
    }
    return dailyObjective.objective.slice(0, OBJECTIVE_TRUNCATE_LENGTH) + '...';
  };

  const shouldShowSeeMore = dailyObjective?.objective && dailyObjective.objective.length > OBJECTIVE_TRUNCATE_LENGTH;

  // Auto-refresh objective when it expires
  useEffect(() => {
    if (!dailyObjective?.expiresAt) return;

    const expiresAt = new Date(dailyObjective.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 5000) {
      loadDailyObjective();
      return;
    }

    const timeoutId = setTimeout(() => {
      loadDailyObjective();
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [dailyObjective?.expiresAt, loadDailyObjective]);

  useFocusEffect(
    useCallback(() => {
      loadOrganizationData();
      loadNotifications();
      loadDailyObjective();
    }, [loadOrganizationData, loadNotifications, loadDailyObjective])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([loadOrganizationData(), loadNotifications(), loadDailyObjective()]);
  }, [loadOrganizationData, loadNotifications, loadDailyObjective]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Quick action blocks configuration for organizations
  const quickActions = [
    {
      id: 'talents',
      label: t('screens.gestion.talents'),
      icon: Gem,
      route: '/gestion/talents',
      count: stats.talents,
      theme: CARD_THEMES.talent,
    },
    {
      id: 'documents',
      label: t('screens.gestion.documents'),
      icon: FolderOpen,
      route: '/gestion/documents',
      count: stats.documents,
      theme: CARD_THEMES.opportunity,
    },
    {
      id: 'communities',
      label: t('screens.gestion.communities'),
      icon: Users,
      route: '/gestion/communities',
      count: stats.communities,
      theme: CARD_THEMES.community,
    },
    {
      id: 'spaces',
      label: t('screens.gestion.spaces'),
      icon: MapPin,
      route: '/gestion/spaces',
      count: stats.spaces,
      theme: CARD_THEMES.space,
    },
    {
      id: 'opportunities',
      label: t('screens.gestion.opportunities'),
      icon: Briefcase,
      route: '/gestion/opportunities',
      count: stats.opportunities,
      theme: CARD_THEMES.opportunity,
    },
    {
      id: 'organization',
      label: t('screens.gestion.myOrganization'),
      icon: Building2,
      route: `/details/organization/${selectedOrg?.id}`,
      count: undefined,
      theme: CARD_THEMES.org,
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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
          <Button
            title={t('management.goToSettings')}
            onPress={() => router.push('/(tabs)/settings')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header
        title={t('ecosystem.title')}
        rightContent={
          <View style={styles.headerActions}>
            <IconButton
              variant="filled"
              onPress={() => router.push('/settings/calendar' as any)}
              icon={<CalendarDays size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel={t('ecosystem.agenda')}
              style={{ backgroundColor: colors.gray100 }}
            />
            <IconButton
              variant="filled"
              onPress={() => router.push('/settings/notifications')}
              icon={<Bell size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel={t('notifications.title')}
              style={{ backgroundColor: colors.gray100 }}
            >
              {(() => {
                const unread = notifications.filter(n => !n.read_at).length;
                return unread > 0 ? (
                  <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
                    <Text style={[styles.notificationBadgeText, { color: colors.textOnPrimary }]}>{unread}</Text>
                  </View>
                ) : null;
              })()}
            </IconButton>
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
            <LoadingShimmer variant="fullPage" />
          </View>
        ) : (
          <>
            {/* Greeting */}
            <View style={styles.greetingSection}>
              <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
                {greeting.text}, {selectedOrg.name} 👋
              </Text>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {new Date().toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </Text>
            </View>

            {/* Credit Balance Banner */}
            {creditBalance !== null && (
              <SelectCard
                style={[styles.creditBanner, { backgroundColor: colors.surface, borderWidth: 0, borderColor: 'transparent' }]}
                onPress={() => router.push('/settings/credits' as any)}
                selected={false}
                accessibilityLabel={t('screens.gestion.openCredits')}
              >
                <View style={styles.creditBannerLeft}>
                  <Coins size={16} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.creditBannerText, { color: colors.textPrimary }]}>
                    {t('screens.gestion.credits', { count: creditBalance })}
                  </Text>
                </View>
                <Text style={[styles.creditBannerLink, { color: colors.primary }]}>
                  {t('screens.gestion.recharge')}
                </Text>
              </SelectCard>
            )}

            {/* Objectif du jour */}
            <View style={[styles.insightContainer, { backgroundColor: CARD_THEMES.space.bg }]}>
              <View style={styles.insightHeader}>
                <Target size={16} color={CARD_THEMES.space.icon} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.insightLabel, { color: CARD_THEMES.space.text }]}>{t('screens.home.dailyObjective')}</Text>
              </View>
              <Text style={[styles.insightText, { color: colors.textPrimary }]}>
                {getDisplayedObjective()}
                {shouldShowSeeMore && !isObjectiveExpanded && (
                  <Text
                    style={[styles.seeMoreLink, { color: colors.primary }]}
                    onPress={() => setIsObjectiveExpanded(true)}
                  >
                    {' '}{t('screens.gestion.seeMore')}
                  </Text>
                )}
              </Text>
            </View>

            {/* Quick Actions Grid */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('screens.gestion.quickAccess')}</Text>
              </View>
              <View style={styles.quickActionsGrid}>
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <SelectCard
                      key={action.id}
                      style={[styles.quickActionCard, { backgroundColor: action.theme.bg, borderWidth: 0, borderColor: 'transparent' }]}
                      onPress={() => router.push(action.route as any)}
                      selected={false}
                      accessibilityLabel={action.label}
                    >
                      <View style={[styles.quickActionIconContainer, { backgroundColor: colors.surface }]}>
                        <IconComponent size={22} color={action.theme.icon} strokeWidth={ICON.strokeWidth} />
                      </View>
                      <Text style={[styles.quickActionLabel, { color: action.theme.text }]} numberOfLines={2}>
                        {action.label}
                      </Text>
                      {action.count !== undefined && (
                        <View style={[styles.quickActionBadge, { backgroundColor: action.theme.icon }]}>
                          <Text style={[styles.quickActionBadgeText, { color: colors.textOnPrimary }]}>{formatCompactNumber(action.count)}</Text>
                        </View>
                      )}
                    </SelectCard>
                  );
                })}
              </View>
            </View>

            {/* Action Button */}
            <Button
              title={t('screens.gestion.createOffer')}
              onPress={() => setShowCreateModal(true)}
              variant="primary"
              fullWidth
              icon={<Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              style={styles.actionButton}
              textStyle={styles.actionButtonText}
            />

            {/* Notifications Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('screens.gestion.notifications')}</Text>
                </View>
                <Button
                  title={t('screens.gestion.seeAll')}
                  onPress={() => router.push('/settings/notifications')}
                  variant="ghost"
                  size="sm"
                  style={styles.seeMoreButton}
                  textStyle={styles.seeMore}
                />
              </View>

              <View style={[styles.listContainer, { backgroundColor: colors.surface }]}>
                {notifications.length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Bell size={40} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      {t('screens.gestion.noNotifications')}
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.gray400 }]}>
                      {t('screens.gestion.upToDate')}
                    </Text>
                  </View>
                ) : (
                  notifications.map((notification, index) => {
                    const NotifIcon = getNotificationIcon(notification.type);
                    const notifColor = getNotificationColor(notification.type);
                    const isLast = index === notifications.length - 1;
                    return (
                      <SelectCard
                        key={notification.id}
                        style={[
                          styles.listItem,
                          { borderBottomColor: colors.gray100 },
                          isLast && styles.listItemLast,
                          { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                        ]}
                        onPress={() => {}}
                        selected={false}
                        accessibilityLabel={notification.title}
                      >
                        <View style={[styles.listItemIconBox, { backgroundColor: notifColor.bg }]}>
                          <NotifIcon size={18} color={notifColor.icon} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.listItemContent}>
                          <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {notification.title}
                          </Text>
                          <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {notification.body}
                          </Text>
                        </View>
                        <Text style={[styles.listItemTime, { color: colors.gray400 }]}>
                          {formatRelativeTime(notification.created_at)}
                        </Text>
                      </SelectCard>
                    );
                  })
                )}
              </View>
            </View>

            {/* Agenda Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('ecosystem.agenda')}</Text>
                </View>
                <Button
                  title={t('screens.gestion.seeAll')}
                  onPress={() => router.push('/settings/calendar' as any)}
                  variant="ghost"
                  size="sm"
                  style={styles.seeMoreButton}
                  textStyle={styles.seeMore}
                />
              </View>

              <View style={[styles.listContainer, { backgroundColor: colors.surface }]}>
                <SelectCard
                  style={[
                    styles.listItem,
                    styles.listItemLast,
                    { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 },
                  ]}
                  onPress={() => router.push('/settings/calendar' as any)}
                  selected={false}
                  accessibilityLabel={t('ecosystem.agenda')}
                >
                  <View style={[styles.listItemIconBox, { backgroundColor: colors.gray100 }]}>
                    <CalendarDays size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {t('screens.gestion.viewAgenda')}
                    </Text>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {t('screens.gestion.agendaSubtitle')}
                    </Text>
                  </View>
                  <ChevronRight size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                </SelectCard>
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

  // Organization Profile Card
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  orgCardIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orgCardContent: {
    flex: 1,
    marginLeft: SPACING.sm,
    marginRight: SPACING.xs,
  },

  orgCardName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  orgCardType: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  orgCardDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.4,
  },

  // Credit Balance Banner
  creditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BORDER.radius.md,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },

  creditBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  creditBannerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  creditBannerLink: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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

  seeMoreLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
  seeMoreButton: {
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
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
    minWidth: SPACING.xl,
    height: SPACING.xl,
    borderRadius: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },

  quickActionBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Action Button
  actionButton: {
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // List Container
  listContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  listItemLast: {
    borderBottomWidth: 0,
  },

  listItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listItemContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },

  listItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 2,
  },

  listItemSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  listItemTime: {
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

  emptyButton: {},
  emptyButtonText: {},

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

  bottomSpacer: {
    height: SPACING.xl,
  },

  // Notification Badge
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
