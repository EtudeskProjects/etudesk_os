import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  Bookmark,
  Calendar,
  BarChart2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { Chip, PageLayout, EmptyState, SelectCard } from '../../../src/components/ui';
import { CommunityCard } from '../../../src/components/cards';
import { communityService, communityActivityService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import { toNumberOrNull } from '../../../src/utils/number';
import type { Community } from '../../../src/types/models';

const getMemberStatusConfig = (colors: any, t: (key: string) => string) => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: t('myCommunities.status.pending') },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: t('myCommunities.status.active') },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: t('myCommunities.status.rejected') },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: withOpacity(colors.gray500, OPACITY[15]), label: t('myCommunities.status.suspended') },
});

type Tab = 'memberships' | 'bookmarks';
type MemberFilterStatus = 'all' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

interface Membership {
  id: string;
  community_id?: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
  role: 'ADMIN' | 'MEMBER';
  joined_at: string;
  community: {
    id: string;
    name: string;
    slug: string;
    cover_image_url?: string;
    images?: string[];
    members_count?: number | string;
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

const getActivityLabel = (type: string, t: (key: string) => string) => {
  switch (type) {
    case 'EVENT':
      return t('myCommunities.activityTypes.event');
    case 'POLL':
      return t('myCommunities.activityTypes.poll');
    default:
      return t('myCommunities.activityTypes.post');
  }
};

export default function MyCommunitiesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<Tab>('memberships');
  const [memberFilter, setMemberFilter] = useState<MemberFilterStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bookmarkedActivities, setBookmarkedActivities] = useState<BookmarkedActivity[]>([]);

  const loadMemberships = useCallback(async () => {
    try {
      const response = await communityService.getMyMemberships({ limit: 50 });
      if (response.data?.memberships) {
        setMemberships(response.data.memberships);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading memberships:', error);
    }
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const response = await communityActivityService.getMyBookmarks();
      if (response.data) {
        setBookmarkedActivities(response.data);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading bookmarks:', error);
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

  const chips = [
    { key: 'memberships' as Tab, label: memberships.length <= 1 ? t('myCommunities.tabs.memberships') : t('myCommunities.tabs.membershipsPlural'), count: memberships.length },
    { key: 'bookmarks' as Tab, label: bookmarkedActivities.length <= 1 ? t('myCommunities.tabs.bookmarks') : t('myCommunities.tabs.bookmarksPlural'), count: bookmarkedActivities.length },
  ];

  const filteredMemberships = memberships.filter((m) => {
    if (memberFilter === 'all') return true;
    return m.status === memberFilter;
  });

  const getMemberStatusCounts = () => {
    const counts: Record<string, number> = { all: memberships.length };
    memberships.forEach((m) => {
      counts[m.status] = (counts[m.status] || 0) + 1;
    });
    return counts;
  };
  const memberStatusCounts = getMemberStatusCounts();

  const memberFilterChips: { key: MemberFilterStatus; label: string }[] = [
    { key: 'all', label: t('myCommunities.filters.all') },
    { key: 'PENDING', label: t('myCommunities.filters.pending') },
    { key: 'ACTIVE', label: t('myCommunities.filters.active') },
    { key: 'REJECTED', label: t('myCommunities.filters.rejected') },
    { key: 'SUSPENDED', label: t('myCommunities.filters.suspended') },
  ];

  const renderMembershipItem = (membership: Membership) => {
    const parsedMembersCount = toNumberOrNull(membership.community.members_count);
    const normalizedMembersCount = parsedMembersCount ?? (membership.status === 'ACTIVE' ? 1 : 0);

    const community: Community = {
      id: membership.community_id,
      name: membership.community.name,
      slug: membership.community.slug,
      cover_image_url: membership.community.cover_image_url,
      images: membership.community.images,
      members_count: normalizedMembersCount,
      type: membership.community.type as any,
    } as Community;

    const statusConfig = getMemberStatusConfig(colors, t)[membership.status] || getMemberStatusConfig(colors, t).PENDING;
    const StatusIcon = statusConfig.icon;

    return (
      <CommunityCard
        community={community}
        onPress={() => router.push(`/settings/my-communities/${membership.id}`)}
        statusOverlay={{
          label: statusConfig.label,
          color: statusConfig.color,
          bgColor: statusConfig.bgColor,
          icon: <StatusIcon size={12} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />,
        }}
      />
    );
  };

  const renderBookmarkItem = (activity: BookmarkedActivity) => {
    const ActivityIcon = getActivityIcon(activity.type);
    const authorAvatarUrl = activity.author?.avatar_url ? getFullImageUrl(activity.author.avatar_url) : null;
    const authorInitials = activity.author?.display_name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

    return (
      <SelectCard
        style={[styles.bookmarkCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        onPress={() => router.push(`/details/community/activity/${activity.id}`)}
        selected={false}
        accessibilityLabel={activity.title || t('myCommunities.openPublication')}
      >
        {authorAvatarUrl ? (
          <Image
            source={{ uri: authorAvatarUrl }}
            style={styles.authorAvatar}
          />
        ) : (
          <View style={[styles.authorAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
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
                {getActivityLabel(activity.type, t)}
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
      </SelectCard>
    );
  };

  const headerContent = (
    <View>
      <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
            {chips.map((chip) => {
              const isActive = activeTab === chip.key;
              return (
                <Chip
                  key={chip.key}
                  onPress={() => setActiveTab(chip.key)}
                  selected={isActive}
                  style={[styles.filterChip, { backgroundColor: isActive ? colors.primary : colors.gray100, borderColor: isActive ? colors.primary : colors.gray200 }]}
                  textStyle={[styles.filterChipText, { color: isActive ? colors.textOnPrimary : colors.gray700 }]}
                  label={`${chip.label} (${chip.count})`}
                />
              );
            })}
          </ScrollView>
      </View>
      {activeTab === 'memberships' && (
        <View style={styles.memberFiltersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {memberFilterChips.map((chip) => {
              const isActive = memberFilter === chip.key;
              const count = memberStatusCounts[chip.key] || 0;
              return (
                <Chip
                  key={chip.key}
                  onPress={() => setMemberFilter(chip.key)}
                  selected={isActive}
                  style={[styles.filterChip, { backgroundColor: isActive ? colors.primary : colors.gray100, borderColor: isActive ? colors.primary : colors.gray200 }]}
                  textStyle={[styles.filterChipText, { color: isActive ? colors.textOnPrimary : colors.gray700 }]}
                  label={`${chip.label} (${count})`}
                />
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <PageLayout
      title={t('myCommunities.title')}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
      useScrollView={false}
    >
      {activeTab === 'memberships' ? (
        <FlatList
          data={filteredMemberships}
          keyExtractor={(m) => m.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => renderMembershipItem(item)}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={memberFilter === 'all' ? t('myCommunities.empty.membershipsTitle') : t('myCommunities.empty.membershipsFilteredTitle')}
              subtitle={
                memberFilter === 'all'
                  ? t('myCommunities.empty.membershipsSubtitle')
                  : t('myCommunities.empty.membershipsFilteredSubtitle')
              }
              {...(memberFilter === 'all' ? {
                actionLabel: t('myCommunities.explore'),
                onAction: () => router.push('/(tabs)/explore?category=communities'),
              } : {})}
            />
          }
        />
      ) : (
        <FlatList
          data={bookmarkedActivities}
          keyExtractor={(a) => a.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => renderBookmarkItem(item)}
          ListEmptyComponent={
            <EmptyState
              icon={Bookmark}
              title={t('myCommunities.empty.bookmarksTitle')}
              subtitle={t('myCommunities.empty.bookmarksSubtitle')}
            />
          }
        />
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
  memberFiltersRow: {
    paddingVertical: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
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
  bookmarkContent: { flex: 1 },
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
  activityDate: { fontSize: TYPOGRAPHY.fontSize.xs },
});
