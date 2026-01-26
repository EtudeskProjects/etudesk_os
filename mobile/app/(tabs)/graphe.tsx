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
  Award,
  Banknote,
  Info,
  Compass,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/contexts/I18nContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSpace } from '../../src/contexts/SpaceContext';
import { Header, FooterNav } from '../../src/components/ui';
import { CreateOfferModal } from '../../src/components/CreateOfferModal';
import { formatCompactNumber } from '../../src/utils/number';
import {
  ecosystemService,
  applicationService,
  communityService,
  hubService,
  opportunityService,
} from '../../src/services';
import type { Notification as EcoNotification } from '../../src/services/notificationService';

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

// Types for Talent
interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
  time: string;
}


interface TalentStats {
  applications: number;
  communities: number;
  sessions: number;
  reservations: number;
  documents: number;
}

// Types for Organization
interface OrgStats {
  opportunities: number;
  communities: number;
  hubs: number;
  applications: number;
  views: number;
  members: number;
}

interface Activity {
  id: string;
  type: 'opportunity' | 'community' | 'hub' | 'application';
  title: string;
  message: string;
  time: string;
}

export default function AccueilScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { selectedOrg, isOrganizationSpace } = useSpace();

  // Modal for organization
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Talent data states
  const [talentStats, setTalentStats] = useState<TalentStats>({
    applications: 0,
    communities: 0,
    sessions: 0,
    reservations: 0,
    documents: 0,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Organization data states
  const [orgStats, setOrgStats] = useState<OrgStats>({
    opportunities: 0,
    communities: 0,
    hubs: 0,
    applications: 0,
    views: 0,
    members: 0,
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dailyInsight, setDailyInsight] = useState<string>('');

  // Get user/org display name
  const getDisplayName = (): string => {
    if (isOrganizationSpace && selectedOrg) {
      return selectedOrg.name;
    }
    if (!user) return '';
    const name = user.displayName || user.firstName || user.email?.split('@')[0] || '';
    return name.split(' ')[0];
  };

  // Get greeting based on time of day
  const getGreeting = (): { text: string; icon: typeof Sun } => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bonjour', icon: Sun };
    if (hour < 18) return { text: 'Bon après-midi', icon: CloudSun };
    return { text: 'Bonsoir', icon: Moon };
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
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

  // Map notification type from backend to UI type
  const mapNotificationType = (type: string): 'success' | 'info' | 'warning' => {
    switch (type) {
      case 'APPLICATION':
      case 'OPPORTUNITY':
        return 'success';
      case 'REMINDER':
        return 'warning';
      default:
        return 'info';
    }
  };

  // Load Talent data
  const loadTalentData = useCallback(async () => {
    try {
      const [
        applicationsRes,
        membershipsRes,
        notificationsRes,
        documentsRes,
      ] = await Promise.allSettled([
        applicationService.getMyApplications({ limit: 10 }),
        communityService.getMyMemberships({ limit: 10 }),
        ecosystemService.getNotifications({ limit: 5 }),
        ecosystemService.getMyDocuments({ limit: 10 }),
      ]);

      const applications = applicationsRes.status === 'fulfilled' && applicationsRes.value.data
        ? applicationsRes.value.data : [];
      const memberships = membershipsRes.status === 'fulfilled' && membershipsRes.value.data?.memberships
        ? membershipsRes.value.data.memberships : [];
      const documents = documentsRes.status === 'fulfilled' && documentsRes.value.data?.documents
        ? documentsRes.value.data.documents : [];

      setTalentStats({
        applications: applications.length,
        communities: memberships.length,
        sessions: 0,
        reservations: 0,
        documents: documents.length,
      });

      // Process notifications
      if (notificationsRes.status === 'fulfilled' && notificationsRes.value.data) {
        const notifsData = Array.isArray(notificationsRes.value.data)
          ? notificationsRes.value.data
          : (notificationsRes.value.data as any).notifications || [];
        const notifs = notifsData.map((n: EcoNotification) => ({
          id: n.id,
          type: mapNotificationType(n.type),
          title: n.title,
          message: n.body || '',
          time: formatRelativeTime(n.created_at),
        }));
        setNotifications(notifs);
      }
    } catch (error) {
      console.error('[Accueil] Error loading talent data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load Organization data
  const loadOrganizationData = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const [opportunitiesRes, communitiesRes, hubsRes] = await Promise.allSettled([
        opportunityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        communityService.getByOrganization(selectedOrg.id, { limit: 100 }),
        hubService.getByOrganization(selectedOrg.id, { limit: 100 }),
      ]);

      const opportunities = opportunitiesRes.status === 'fulfilled' && opportunitiesRes.value.data
        ? opportunitiesRes.value.data : [];
      const communities = communitiesRes.status === 'fulfilled' && communitiesRes.value.data
        ? communitiesRes.value.data : [];
      const hubs = hubsRes.status === 'fulfilled' && hubsRes.value.data
        ? hubsRes.value.data : [];

      const totalViews = opportunities.reduce((sum, o) => sum + (o.views_count || 0), 0)
        + communities.reduce((sum, c) => sum + (c.views_count || 0), 0)
        + hubs.reduce((sum, h) => sum + (h.views_count || 0), 0);

      const totalApplications = opportunities.reduce((sum, o) => sum + (o.applications_count || 0), 0);
      const totalMembers = communities.reduce((sum, c) => sum + (c.members_count || 0), 0);

      setOrgStats({
        opportunities: opportunities.length,
        communities: communities.length,
        hubs: hubs.length,
        applications: totalApplications,
        views: totalViews,
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
            time: formatRelativeTime(opp.updated_at || opp.created_at),
          });
        }
      });

      communities.slice(0, 1).forEach(comm => {
        activities.push({
          id: `comm-${comm.id}`,
          type: 'community',
          title: 'Communauté active',
          message: `${comm.members_count || 0} membres dans "${comm.name}"`,
          time: formatRelativeTime(comm.updated_at || comm.created_at),
        });
      });

      setRecentActivities(activities.slice(0, 5));

      // Generate daily insight for org
      const activeOpps = opportunities.filter(o => o.status === 'OPEN').length;
      if (activeOpps > 0 || totalApplications > 0) {
        setDailyInsight(`Vous avez ${activeOpps} opportunité(s) active(s) et ${totalApplications} candidature(s) à examiner.`);
      } else {
        setDailyInsight('Créez votre première offre pour attirer des talents !');
      }
    } catch (error) {
      console.error('[Accueil] Error loading organization data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id]);

  // Load data based on space
  const loadData = useCallback(() => {
    setIsLoading(true);
    if (isOrganizationSpace && selectedOrg) {
      loadOrganizationData();
    } else {
      loadTalentData();
    }
  }, [isOrganizationSpace, selectedOrg, loadTalentData, loadOrganizationData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Helper functions for notifications/activities
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return AlertCircle;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return PASTEL_COLORS.green;
      case 'warning': return PASTEL_COLORS.orange;
      default: return PASTEL_COLORS.blue;
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'opportunity': return Briefcase;
      case 'community': return Users;
      case 'hub': return MapPin;
      case 'application': return FileText;
      default: return Bell;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'opportunity': return PASTEL_COLORS.green;
      case 'community': return PASTEL_COLORS.blue;
      case 'hub': return PASTEL_COLORS.orange;
      case 'application': return PASTEL_COLORS.purple;
      default: return PASTEL_COLORS.indigo;
    }
  };

  // Quick actions for Talent
  // Ordre: Mes compétences, Mes documents, Mes communautés, Mes réservations, Mes candidatures
  const talentQuickActions = [
    {
      id: 'skills',
      label: 'Mes compétences',
      icon: Award,
      color: PASTEL_COLORS.teal,
      count: null,
      route: '/settings/profile',
    },
    {
      id: 'documents',
      label: 'Mes documents',
      icon: FileText,
      color: PASTEL_COLORS.red,
      count: talentStats.documents,
      route: '/(tabs)/settings',
    },
    {
      id: 'communities',
      label: 'Mes communautés',
      icon: Users,
      color: PASTEL_COLORS.blue,
      count: talentStats.communities,
      route: '/settings/my-communities',
    },
    {
      id: 'reservations',
      label: 'Mes réservations',
      icon: MapPin,
      color: PASTEL_COLORS.orange,
      count: talentStats.reservations,
      route: '/(tabs)/explore',
    },
    {
      id: 'applications',
      label: 'Mes candidatures',
      icon: Briefcase,
      color: PASTEL_COLORS.green,
      count: talentStats.applications,
      route: '/settings/my-applications',
    },
    {
      id: 'explore',
      label: 'Explorer',
      icon: Compass,
      color: PASTEL_COLORS.purple,
      count: null,
      route: '/(tabs)/explore',
    },
  ];

  // Quick actions for Organization
  // Ordre: Communautés, Espaces, Opportunités, Revenus
  const orgQuickActions = [
    {
      id: 'communities',
      label: 'Communautés',
      icon: Users,
      color: PASTEL_COLORS.blue,
      count: orgStats.communities,
      route: '/gestion/communities',
    },
    {
      id: 'hubs',
      label: 'Espaces',
      icon: MapPin,
      color: PASTEL_COLORS.orange,
      count: orgStats.hubs,
      route: '/gestion/hubs',
    },
    {
      id: 'opportunities',
      label: 'Opportunités',
      icon: Briefcase,
      color: PASTEL_COLORS.green,
      count: orgStats.opportunities,
      route: '/gestion/opportunities',
    },
    {
      id: 'revenues',
      label: 'Revenus',
      icon: Banknote,
      color: PASTEL_COLORS.teal,
      count: null,
      route: '/gestion/revenues',
    },
  ];

  const quickActions = isOrganizationSpace ? orgQuickActions : talentQuickActions;

  // Render Organization Content
  const renderOrganizationContent = () => (
    <>
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
          {greeting.text}, {getDisplayName()} 👋
        </Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}
        </Text>
      </View>

      {/* AI Daily Summary */}
      <View style={[styles.insightContainer, { backgroundColor: PASTEL_COLORS.indigo.bg }]}>
        <View style={styles.insightHeader}>
          <Info size={16} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.insightLabel, { color: PASTEL_COLORS.indigo.text }]}>Résumé du jour</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>
          {dailyInsight}
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
                  <Text style={styles.quickActionBadgeText}>{formatCompactNumber(action.count || 0)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Plus size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
        <Text style={styles.actionButtonText}>Créer une offre</Text>
      </TouchableOpacity>

      {/* Recent Activity Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activité récente</Text>
          <TouchableOpacity>
            <Text style={[styles.seeMore, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listContainer, { backgroundColor: colors.surface }]}>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyState}>
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
                    styles.listItem,
                    { borderBottomColor: colors.gray100 },
                    isLast && styles.listItemLast,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.listItemIconBox, { backgroundColor: activityColor.bg }]}>
                    <ActivityIcon size={18} color={activityColor.icon} strokeWidth={ICON.strokeWidth} />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {activity.message}
                    </Text>
                  </View>
                  <Text style={[styles.listItemTime, { color: colors.gray400 }]}>
                    {activity.time}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>
    </>
  );

  // Render Talent Content
  const renderTalentContent = () => (
    <>
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
          {greeting.text}, {getDisplayName() || 'Talent'} 👋
        </Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}
        </Text>
      </View>

      {/* AI Daily Summary */}
      <View style={[styles.insightContainer, { backgroundColor: PASTEL_COLORS.indigo.bg }]}>
        <View style={styles.insightHeader}>
          {dailyInsight ? (
            <Info size={16} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
          ) : (
            <Target size={16} color={PASTEL_COLORS.indigo.icon} strokeWidth={ICON.strokeWidth} />
          )}
          <Text style={[styles.insightLabel, { color: PASTEL_COLORS.indigo.text }]}>
            {dailyInsight ? 'Résumé du jour' : 'Objectif du jour'}
          </Text>
        </View>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>
          {dailyInsight || 'Explorez les nouvelles opportunités et restez connecté avec votre communauté !'}
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
                {action.count !== null && (
                  <View style={[styles.quickActionBadge, { backgroundColor: action.color.icon }]}>
                    <Text style={styles.quickActionBadgeText}>{action.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Train Button */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push({
          pathname: '/(tabs)/assistant',
          params: { mode: 'study', focusInput: 'true' },
        })}
        activeOpacity={0.8}
      >
        <BookOpen size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
        <Text style={styles.actionButtonText}>Se former</Text>
      </TouchableOpacity>

      {/* Notifications Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
            {notifications.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: PASTEL_COLORS.red.icon }]}>
                <Text style={[styles.countBadgeText, { color: '#FFFFFF' }]}>
                  {notifications.length}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity>
            <Text style={[styles.seeMore, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
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
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.listItem,
                    { borderBottomColor: colors.gray100 },
                    isLast && styles.listItemLast,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.listItemIconBox, { backgroundColor: notifColor.bg }]}>
                    <NotifIcon size={18} color={notifColor.icon} strokeWidth={ICON.strokeWidth} />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {notification.title}
                    </Text>
                    <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {notification.message}
                    </Text>
                  </View>
                  <Text style={[styles.listItemTime, { color: colors.gray400 }]}>
                    {notification.time}
                  </Text>
                </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
              activeOpacity={0.8}
            >
              <Bell size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              {notifications.length > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: PASTEL_COLORS.red.icon }]}>
                  <Text style={styles.notificationBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            {isOrganizationSpace && (
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.8}
              >
                <Plus size={ICON.size.md} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}
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
            {isOrganizationSpace ? renderOrganizationContent() : renderTalentContent()}
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>

      {isOrganizationSpace && (
        <CreateOfferModal
          isVisible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
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
    position: 'relative',
  },

  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
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

  countBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
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
    color: '#FFFFFF',
  },

  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },

  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
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

  // Bottom Spacer
  bottomSpacer: {
    height: SPACING.xxl,
  },
});
