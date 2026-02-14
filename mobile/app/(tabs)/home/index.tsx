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
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import {
  Briefcase,
  Users,
  MapPin,
  Handshake,
  FileText,
  Bell,
  ChevronRight,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  CloudSun,
  Target,
  Plus,
  Gem,
  Banknote,
  Info,
  FolderOpen,
  Mail,
  User,
  Coins,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { Header, FooterNav, IconButton, SelectCard, Button, LoadingShimmer } from '../../../src/components/ui';
import { CreateOfferModal } from '../../../src/components/CreateOfferModal';
import { formatCompactNumber } from '../../../src/utils/number';
import {
  applicationService,
  communityService,
  spaceBookingService,
  documentService,
  dailyObjectiveService,
  billingService,
  type DailyObjective,
} from '../../../src/services';
import skillService from '../../../src/services/skillService';
import { communityInvitationService } from '../../../src/services/communityInvitationService';
import { spaceInvitationService } from '../../../src/services/spaceInvitationService';
import { opportunityInvitationService } from '../../../src/services/opportunityInvitationService';
import { notificationService, type Notification as EcoNotification } from '../../../src/services/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EcosystemScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { isOrganizationSpace } = useSpace();

  // There is a dedicated organization dashboard at `/(tabs)/gestion`.
  // Prevent duplicate "org home" screens: redirect org space away from this Talent home.
  if (isOrganizationSpace) {
    return <Redirect href="/(tabs)/gestion" />;
  }

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dailyObjective, setDailyObjective] = useState<DailyObjective | null>(null);
  const [isObjectiveExpanded, setIsObjectiveExpanded] = useState(false);
  const [notifications, setNotifications] = useState<EcoNotification[]>([]);
  const [quickActionCounts, setQuickActionCounts] = useState({
    talent: {
      skills: 0,
      documents: 0,
      communities: 0,
      reservations: 0,
      applications: 0,
      invitations: 0,
    },
  });
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Get greeting based on time of day
  const getGreeting = (): { text: string; icon: typeof Sun } => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bonjour', icon: Sun };
    if (hour < 18) return { text: 'Bon après-midi', icon: CloudSun };
    return { text: 'Bonsoir', icon: Moon };
  };

  const greeting = getGreeting();

  // Get first name, truncated to 10 characters
  const getDisplayName = () => {
    const raw = user?.firstName || user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Utilisateur';
    return raw.length > 10 ? raw.slice(0, 10) + '...' : raw;
  };

  // Card themes
  const CARD_THEMES = {
    talent: { bg: colors.cardTalent, icon: colors.cardTalentAccent, text: colors.cardTalentText },
    org: { bg: colors.cardOrg, icon: colors.cardOrgAccent, text: colors.cardOrgText },
    opportunity: { bg: colors.cardOpportunity, icon: colors.cardOpportunityAccent, text: colors.cardOpportunityText },
    community: { bg: colors.cardCommunity, icon: colors.cardCommunityAccent, text: colors.cardCommunityText },
    space: { bg: colors.cardSpace, icon: colors.cardSpaceAccent, text: colors.cardSpaceText },
  };

  // Quick actions for talent
  const talentQuickActions = [
    {
      id: 'skills',
      label: 'Mes compétences',
      icon: Gem,
      route: '/settings/skills',
      count: quickActionCounts.talent.skills,
      theme: CARD_THEMES.talent,
    },
    {
      id: 'documents',
      label: 'Mes documents',
      icon: FolderOpen,
      route: '/settings/documents',
      count: quickActionCounts.talent.documents,
      theme: CARD_THEMES.opportunity,
    },
    {
      id: 'communities',
      label: 'Mes communautés',
      icon: Users,
      route: '/settings/my-communities',
      count: quickActionCounts.talent.communities,
      theme: CARD_THEMES.community,
    },
    {
      id: 'reservations',
      label: 'Mes réservations',
      icon: MapPin,
      route: '/settings/my-reservations',
      count: quickActionCounts.talent.reservations,
      theme: CARD_THEMES.space,
    },
    {
      id: 'applications',
      label: 'Mes candidatures',
      icon: Briefcase,
      route: '/settings/my-applications',
      count: quickActionCounts.talent.applications,
      theme: CARD_THEMES.talent,
    },
    {
      id: 'profile',
      label: 'Mon Profil',
      icon: User,
      route: '/settings/edit-profile',
      count: undefined,
      theme: CARD_THEMES.talent,
    },
  ];

  const quickActions = talentQuickActions;

  // Helper functions
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return Briefcase;
      case 'community': return Users;
      case 'space': return MapPin;
      case 'application': return FileText;
      default: return Bell;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'opportunity': return { bg: CARD_THEMES.opportunity.bg, icon: CARD_THEMES.opportunity.icon };
      case 'community': return { bg: CARD_THEMES.community.bg, icon: CARD_THEMES.community.icon };
      case 'space': return { bg: CARD_THEMES.space.bg, icon: CARD_THEMES.space.icon };
      case 'application': return { bg: CARD_THEMES.talent.bg, icon: CARD_THEMES.talent.icon };
      default: return { bg: colors.gray100, icon: colors.textSecondary };
    }
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

  const formatRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "À l'instant";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}j`;
    return `${Math.floor(d / 7)} sem.`;
  };

  // Truncate objective to 200 characters for "Voir plus"
  const OBJECTIVE_TRUNCATE_LENGTH = 200;
  const getDisplayedObjective = (): string => {
    if (!dailyObjective?.objective) {
      return 'Explorez les opportunités qui vous correspondent et renforcez votre profil.';
    }
    if (isObjectiveExpanded || dailyObjective.objective.length <= OBJECTIVE_TRUNCATE_LENGTH) {
      return dailyObjective.objective;
    }
    return dailyObjective.objective.slice(0, OBJECTIVE_TRUNCATE_LENGTH) + '...';
  };

  const shouldShowSeeMore = dailyObjective?.objective && dailyObjective.objective.length > OBJECTIVE_TRUNCATE_LENGTH;

  const loadNotifications = useCallback(async () => {
    try {
      const response: any = await notificationService.getNotifications({ limit: 5 });
      const notifs = response?.data ?? [];
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
    } catch (error) {
      console.error('[Home] Failed to load notifications:', error);
    }
  }, []);

  const loadDailyObjective = useCallback(async () => {
    try {
      const response = await dailyObjectiveService.getTalentObjective();

      console.log('[Home] Daily objective response:', JSON.stringify(response, null, 2));

      if (response.data) {
        setDailyObjective(response.data);
        setIsObjectiveExpanded(false);
        console.log('[Home] Daily objective set:', response.data.objective?.slice(0, 50));
      } else {
        console.log('[Home] No data in response');
      }
    } catch (error) {
      console.error('[Home] Failed to load daily objective:', error);
    }
  }, []);

  // Auto-refresh objective when it expires
  useEffect(() => {
    if (!dailyObjective?.expiresAt) return;

    const expiresAt = new Date(dailyObjective.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // If already expired or expires within 5 seconds, refresh immediately
    if (timeUntilExpiry <= 5000) {
      loadDailyObjective();
      return;
    }

    // Set timeout to refresh when objective expires
    const timeoutId = setTimeout(() => {
      console.log('[Home] Daily objective expired, auto-refreshing...');
      loadDailyObjective();
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [dailyObjective?.expiresAt, loadDailyObjective]);

  const loadQuickActionCounts = useCallback(async () => {
    try {
      const [
        communitiesResult, bookingsResult, applicationsResult,
        skillsResult, documentsResult,
        communityInvResult, spaceInvResult, opportunityInvResult,
        talentBalanceResult,
      ] = await Promise.allSettled([
        communityService.getMyMemberships({ limit: 1, offset: 0 }),
        spaceBookingService.getMyBookings({ limit: 1, offset: 0 }),
        applicationService.getMyApplications({ limit: 1, offset: 0 }),
        skillService.getMySkills(),
        documentService.listDocuments({ limit: 1 }),
        communityInvitationService.getMyInvitations({ status: 'PENDING', limit: 1 }),
        spaceInvitationService.getMyInvitations({ limit: 1 }),
        opportunityInvitationService.getMyInvitations({ limit: 1 }),
        billingService.getBalance('TALENT'),
      ]);

      // Extract results safely, defaulting to 0 if failed
      const communitiesRes = communitiesResult.status === 'fulfilled' ? communitiesResult.value : null;
      const bookingsRes = bookingsResult.status === 'fulfilled' ? bookingsResult.value : null;
      const applicationsRes = applicationsResult.status === 'fulfilled' ? applicationsResult.value : null;

      const communitiesCount = communitiesRes?.count ?? communitiesRes?.data?.memberships?.length ?? 0;
      const reservationsCount = bookingsRes?.count ?? bookingsRes?.data?.length ?? 0;
      const applicationsCount = applicationsRes?.count ?? applicationsRes?.data?.length ?? 0;
      const skillsCount = skillsResult.status === 'fulfilled' ? skillsResult.value.length : 0;
      const documentsCount = documentsResult.status === 'fulfilled' ? (documentsResult.value?.total ?? documentsResult.value?.documents?.length ?? 0) : 0;

      const communityInvCount = communityInvResult.status === 'fulfilled' ? (communityInvResult.value.data?.count ?? communityInvResult.value.data?.data?.length ?? 0) : 0;
      const spaceInvCount = spaceInvResult.status === 'fulfilled' ? (spaceInvResult.value.data?.count ?? spaceInvResult.value.data?.data?.length ?? 0) : 0;
      const opportunityInvCount = opportunityInvResult.status === 'fulfilled' ? (opportunityInvResult.value.data?.count ?? opportunityInvResult.value.data?.data?.length ?? 0) : 0;
      const invitationsCount = communityInvCount + spaceInvCount + opportunityInvCount;

      if (talentBalanceResult.status === 'fulfilled') {
        const bal = talentBalanceResult.value?.data?.balance_credits ?? null;
        setCreditBalance(typeof bal === 'number' ? bal : null);
      }

      setQuickActionCounts((prev) => ({
        ...prev,
        talent: {
          skills: skillsCount,
          documents: documentsCount,
          communities: communitiesCount,
          reservations: reservationsCount,
          applications: applicationsCount,
          invitations: invitationsCount,
        },
      }));
    } catch (error) {
      console.error('[Ecosystem] Failed to load quick action counts:', error);
    }
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setIsObjectiveExpanded(false);
    await Promise.all([loadQuickActionCounts(), loadNotifications(), loadDailyObjective()]);
    setIsRefreshing(false);
  }, [loadQuickActionCounts, loadNotifications, loadDailyObjective]);

  // Load data
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadQuickActionCounts(), loadNotifications(), loadDailyObjective()]);
      if (isMounted) {
        setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [loadQuickActionCounts, loadNotifications, loadDailyObjective]);

// Render Talent Content
const renderTalentContent = () => (
  <>
    {/* Greeting */}
    <View style={styles.greetingSection}>
      <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
        Bonjour {getDisplayName()} 👋
      </Text>
      <Text style={[styles.dateText, { color: colors.textSecondary }]}>
        {new Date().toLocaleDateString('fr-FR', {
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
        accessibilityLabel="Ouvrir crédits et facturation"
      >
        <View style={styles.creditBannerLeft}>
          <Coins size={16} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.creditBannerText, { color: colors.textPrimary }]}>
            {creditBalance} crédits
          </Text>
        </View>
        <Text style={[styles.creditBannerLink, { color: colors.primary }]}>
          Recharger
        </Text>
      </SelectCard>
    )}

    {/* Objectif du jour (talents) */}
    <View style={[styles.insightContainer, { backgroundColor: CARD_THEMES.space.bg }]}>
      <View style={styles.insightHeader}>
        <Target size={16} color={CARD_THEMES.space.icon} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.insightLabel, { color: CARD_THEMES.space.text }]}>Objectif du jour</Text>
      </View>
      <Text style={[styles.insightText, { color: colors.textPrimary }]}>
        {getDisplayedObjective()}
        {shouldShowSeeMore && !isObjectiveExpanded && (
          <Text
            style={[styles.seeMoreLink, { color: colors.primary }]}
            onPress={() => setIsObjectiveExpanded(true)}
          >
            {' '}Voir plus
          </Text>
        )}
      </Text>
    </View>

    {/* Quick Actions Grid */}
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Accès rapide</Text>
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
                  <Text style={[styles.quickActionBadgeText, { color: colors.textOnPrimary }]}>
                    {formatCompactNumber(action.count)}
                  </Text>
                </View>
              )}
            </SelectCard>
          );
        })}
      </View>
    </View>

    {/* Train Button */}
    <Button
      title="Se former"
      onPress={() => router.push({ pathname: '/(tabs)/assistant', params: { mode: 'study', focusInput: 'true' } })}
      variant="primary"
      fullWidth
      icon={<BookOpen size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
      style={styles.actionButton}
      textStyle={styles.actionButtonText}
    />

    {/* Notifications Section */}
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
        </View>
        <Button
          title="Voir tout"
          onPress={() => router.push('/settings/notifications')}
          variant="ghost"
          size="sm"
          style={styles.seeMoreButton}
          textStyle={styles.seeMore}
        />
      </View>

      <View style={[styles.listContainer, { backgroundColor: colors.surface }]}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={40} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Aucune notification
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.gray400 }]}>
              Vous êtes à jour !
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
  </>
);

return (
  <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
    <Header
      title={t('ecosystem.title')}
      rightContent={
        <View style={styles.headerActions}>
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
          {renderTalentContent()}
          <View style={styles.bottomSpacer} />
        </>
      )}
    </ScrollView>

    <CreateOfferModal
      isVisible={showCreateModal}
      onClose={() => setShowCreateModal(false)}
    />
    <FooterNav activeTab="home" />
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
    // replaced by unified <IconButton />
    position: 'relative',
  },

  notificationBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: SPACING.lg,
    height: SPACING.lg,
    borderRadius: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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

  countBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER.radius.full,
    marginLeft: SPACING.xs,
  },

  countBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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

  // Credit Banner
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

  bottomSpacer: {
    height: SPACING.xl,
  },
});
