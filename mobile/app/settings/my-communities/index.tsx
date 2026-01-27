import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Bookmark,
  Calendar,
  BarChart2,
  FileText,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { FooterNav } from '../../../src/components/ui';
import { CommunityCard } from '../../../src/components/cards';
import { communityService, communityActivityService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import type { Community } from '../../../src/types/models';

type Tab = 'memberships' | 'bookmarks';

interface Membership {
  id: string;
  community_id: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  role: string;
  joined_at: string;
  community: {
    id: string;
    name: string;
    slug: string;
    cover_image_url?: string;
    images?: string[];
    members_count?: number;
    type?: string;
  };
}

interface BookmarkedActivity {
  id: string;
  type: 'POST' | 'EVENT' | 'POLL';
  title?: string;
  content: string;
  created_at: string;
  community?: {
    id: string;
    name: string;
  };
  author?: {
    display_name: string;
    avatar_url?: string;
  };
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'EVENT':
      return Calendar;
    case 'POLL':
      return BarChart2;
    default:
      return FileText;
  }
};

const getActivityLabel = (type: string) => {
  switch (type) {
    case 'EVENT':
      return 'Événement';
    case 'POLL':
      return 'Sondage';
    default:
      return 'Publication';
  }
};

export default function MyCommunitiesScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('memberships');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bookmarkedActivities, setBookmarkedActivities] = useState<BookmarkedActivity[]>([]);

  const loadMemberships = useCallback(async () => {
    try {
      const response = await communityService.getMyMemberships({ limit: 50 });
      if (response.data?.memberships) {
        setMemberships(response.data.memberships);
      }
    } catch (error) {
      console.error('Error loading memberships:', error);
    }
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const response = await communityActivityService.getMyBookmarks();
      if (response.data) {
        setBookmarkedActivities(response.data);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadMemberships(), loadBookmarks()]);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [loadMemberships, loadBookmarks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const renderMemberships = () => (
    <View style={styles.listContainer}>
      {memberships.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
          <Users size={48} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
            Aucune communauté
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
            Rejoignez des communautés pour les voir ici
          </Text>
          <TouchableOpacity
            style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={[styles.emptyStateButtonText, { color: colors.textOnPrimary }]}>Explorer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        memberships.map((membership) => {
          const community: Community = {
            id: membership.community_id,
            name: membership.community.name,
            slug: membership.community.slug,
            cover_image_url: membership.community.cover_image_url,
            images: membership.community.images,
            members_count: membership.community.members_count,
            type: membership.community.type as any,
          } as Community;

          return (
            <CommunityCard
              key={membership.id}
              community={community}
              onPress={() => router.push(`/details/community/${membership.community_id}`)}
            />
          );
        })
      )}
    </View>
  );

  const renderBookmarks = () => (
    <View style={styles.listContainer}>
      {bookmarkedActivities.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
          <Bookmark size={48} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
            Aucune sauvegarde
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
            Sauvegardez des publications, événements ou sondages pour les retrouver ici
          </Text>
        </View>
      ) : (
        bookmarkedActivities.map((activity) => {
          const ActivityIcon = getActivityIcon(activity.type);
          const authorAvatarUrl = activity.author?.avatar_url ? getFullImageUrl(activity.author.avatar_url) : null;
          const authorInitials = activity.author?.display_name
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '?';

          return (
            <TouchableOpacity
              key={activity.id}
              style={[styles.bookmarkCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              onPress={() => router.push(`/details/community/activity/${activity.id}`)}
              activeOpacity={0.7}
            >
              {/* Author avatar */}
              {authorAvatarUrl ? (
                <Image
                  source={{ uri: authorAvatarUrl }}
                  style={styles.authorAvatar}
                />
              ) : (
                <View style={[styles.authorAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.authorInitials, { color: colors.primary }]}>
                    {authorInitials}
                  </Text>
                </View>
              )}

              <View style={styles.bookmarkContent}>
                <View style={styles.bookmarkHeader}>
                  <View style={[styles.activityTypeBadge, { backgroundColor: colors.gray100 }]}>
                    <ActivityIcon size={10} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.activityTypeText, { color: colors.textSecondary }]}>
                      {getActivityLabel(activity.type)}
                    </Text>
                  </View>
                  {activity.community && (
                    <Text style={[styles.communityLabel, { color: colors.gray400 }]} numberOfLines={1}>
                      {activity.community.name}
                    </Text>
                  )}
                </View>

                {activity.title && (
                  <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {activity.title}
                  </Text>
                )}

                <Text style={[styles.activityContent, { color: colors.textSecondary }]} numberOfLines={2}>
                  {activity.content}
                </Text>

                <View style={styles.bookmarkFooter}>
                  {activity.author && (
                    <Text style={[styles.authorName, { color: colors.gray500 }]}>
                      {activity.author.display_name}
                    </Text>
                  )}
                  <Text style={[styles.activityDate, { color: colors.gray400 }]}>
                    {formatRelativeTime(activity.created_at)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mes communautés</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'memberships' && styles.tabActive]}
          onPress={() => setActiveTab('memberships')}
        >
          <Users
            size={18}
            color={activeTab === 'memberships' ? colors.primary : colors.textSecondary}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'memberships' ? colors.primary : colors.textSecondary }
          ]}>
            Adhésions
          </Text>
          {memberships.length > 0 && (
            <View style={[
              styles.tabBadge,
              { backgroundColor: activeTab === 'memberships' ? colors.primary : colors.gray300 }
            ]}>
              <Text style={[styles.tabBadgeText, { color: colors.textOnPrimary }]}>{memberships.length}</Text>
            </View>
          )}
          {activeTab === 'memberships' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Bookmark
            size={18}
            color={activeTab === 'bookmarks' ? colors.primary : colors.textSecondary}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'bookmarks' ? colors.primary : colors.textSecondary }
          ]}>
            Sauvegardes
          </Text>
          {bookmarkedActivities.length > 0 && (
            <View style={[
              styles.tabBadge,
              { backgroundColor: activeTab === 'bookmarks' ? colors.primary : colors.gray300 }
            ]}>
              <Text style={[styles.tabBadgeText, { color: colors.textOnPrimary }]}>{bookmarkedActivities.length}</Text>
            </View>
          )}
          {activeTab === 'bookmarks' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
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
            {activeTab === 'memberships' && renderMemberships()}
            {activeTab === 'bookmarks' && renderBookmarks()}
          </>
        )}
      </ScrollView>

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
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.lg,
    right: SPACING.lg,
    height: 2,
    borderRadius: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
  },
  // Bookmark Card
  bookmarkCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitials: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  bookmarkContent: {
    flex: 1,
  },
  bookmarkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  activityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER.radius.xs,
  },
  activityTypeText: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  communityLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
  activityTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: 2,
  },
  activityContent: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
    marginBottom: SPACING.xs,
  },
  bookmarkFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  authorName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activityDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    borderRadius: BORDER.radius.lg,
    marginTop: SPACING.lg,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginBottom: SPACING.lg,
  },
  emptyStateButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.sm,
  },
  emptyStateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
