import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
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
import { PageLayout, EmptyState } from '../../../src/components/ui';
import { CommunityCard } from '../../../src/components/cards';
import { communityService, communityActivityService } from '../../../src/services';
import { formatRelativeTime } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import type { Community } from '../../../src/types/models';

const getMemberStatusConfig = (colors: any) => ({
  PENDING: { color: colors.warning, icon: Clock, bgColor: withOpacity(colors.warning, OPACITY[15]), label: 'En attente' },
  ACTIVE: { color: colors.success, icon: CheckCircle2, bgColor: withOpacity(colors.success, OPACITY[15]), label: 'Active' },
  REJECTED: { color: colors.error, icon: XCircle, bgColor: withOpacity(colors.error, OPACITY[15]), label: 'Refusée' },
  SUSPENDED: { color: colors.gray500, icon: XCircle, bgColor: withOpacity(colors.gray500, OPACITY[15]), label: 'Suspendu' },
});

type Tab = 'memberships' | 'bookmarks';
type MemberFilterStatus = 'all' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

interface Membership {
  id: string;
  community_id: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
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

  const chips = [
    { key: 'memberships' as Tab, label: 'Adhésions', count: memberships.length },
    { key: 'bookmarks' as Tab, label: 'Sauvegardes', count: bookmarkedActivities.length },
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
    { key: 'all', label: 'Toutes' },
    { key: 'PENDING', label: 'En attente' },
    { key: 'ACTIVE', label: 'Actives' },
    { key: 'REJECTED', label: 'Refusées' },
    { key: 'SUSPENDED', label: 'Suspendues' },
  ];

  const renderMemberships = () => (
    <>
      {filteredMemberships.length === 0 ? (
        <EmptyState
          icon={Users}
          title={memberFilter === 'all' ? 'Aucune communauté' : 'Aucun résultat'}
          subtitle={
            memberFilter === 'all'
              ? 'Rejoignez des communautés pour les voir ici'
              : 'Aucune adhésion avec ce statut.'
          }
          {...(memberFilter === 'all' ? {
            actionLabel: 'Explorer',
            onAction: () => router.push('/(tabs)/explore?category=communities'),
          } : {})}
        />
      ) : (
        filteredMemberships.map((membership) => {
          const community: Community = {
            id: membership.community_id,
            name: membership.community.name,
            slug: membership.community.slug,
            cover_image_url: membership.community.cover_image_url,
            images: membership.community.images,
            members_count: membership.community.members_count,
            type: membership.community.type as any,
          } as Community;

          const statusConfig = getMemberStatusConfig(colors)[membership.status] || getMemberStatusConfig(colors).PENDING;
          const StatusIcon = statusConfig.icon;

          return (
            <CommunityCard
              key={membership.id}
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
        })
      )}
    </>
  );

  const renderBookmarks = () => (
    <>
      {bookmarkedActivities.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Aucune sauvegarde"
          subtitle="Sauvegardez des publications, événements ou sondages pour les retrouver ici"
        />
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
    </>
  );

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
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                  isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setActiveTab(chip.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.gray700 },
                    isActive && { color: colors.textOnPrimary },
                  ]}
                >
                  {chip.label} ({chip.count})
                </Text>
              </TouchableOpacity>
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
                <TouchableOpacity
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                    isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setMemberFilter(chip.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.gray700 },
                      isActive && { color: colors.textOnPrimary },
                    ]}
                  >
                    {chip.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <PageLayout
      title="Mes communautés"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
    >
      {activeTab === 'memberships' && renderMemberships()}
      {activeTab === 'bookmarks' && renderBookmarks()}
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
