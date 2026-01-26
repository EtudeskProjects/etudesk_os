import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Briefcase,
  Users,
  MapPin,
  Bookmark,
  BookmarkX,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { FooterNav } from '../../src/components/ui';
import { useI18n } from '../../src/contexts/I18nContext';
import { OpportunityCard, CommunityCard, HubCard } from '../../src/components/cards';
import { bookmarkService } from '../../src/services';
import type {
  BookmarkedOpportunity,
  BookmarkedHub,
  BookmarkedCommunity,
} from '../../src/services/bookmarkService';
import type { Opportunity, Hub, Community } from '../../src/types/models';

type Category = 'opportunities' | 'communities' | 'hubs';

export default function BookmarksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [activeCategory, setActiveCategory] = useState<Category>('communities');
  const [opportunities, setOpportunities] = useState<BookmarkedOpportunity[]>([]);
  const [hubs, setHubs] = useState<BookmarkedHub[]>([]);
  const [communities, setCommunities] = useState<BookmarkedCommunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBookmarks = useCallback(async () => {
    try {
      const [oppsRes, hubsRes, communitiesRes] = await Promise.all([
        bookmarkService.getOpportunities(),
        bookmarkService.getHubs(),
        bookmarkService.getCommunities(),
      ]);

      if (oppsRes.data) {
        // Transform organizations array to organization object
        const transformedOpps = oppsRes.data.map((opp: any) => ({
          ...opp,
          organization: opp.organizations?.[0] || opp.organization,
        }));
        setOpportunities(transformedOpps);
      }
      if (hubsRes.data) setHubs(hubsRes.data);
      if (communitiesRes.data) setCommunities(communitiesRes.data);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadBookmarks();
  };

  const removeBookmark = async (id: string, category: Category) => {
    try {
      switch (category) {
        case 'opportunities':
          await bookmarkService.removeOpportunity(id);
          setOpportunities(prev => prev.filter(o => o.id !== id));
          break;
        case 'hubs':
          await bookmarkService.removeHub(id);
          setHubs(prev => prev.filter(h => h.id !== id));
          break;
        case 'communities':
          await bookmarkService.removeCommunity(id);
          setCommunities(prev => prev.filter(c => c.id !== id));
          break;
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  const navigateToDetail = (type: string, id: string) => {
    router.push(`/details/${type}/${id}` as any);
  };

  const CATEGORIES = [
    { id: 'communities' as Category, label: t('explore.categories.communities'), icon: Users, count: communities.length },
    { id: 'hubs' as Category, label: t('explore.categories.hubs'), icon: MapPin, count: hubs.length },
    { id: 'opportunities' as Category, label: t('explore.categories.opportunities'), icon: Briefcase, count: opportunities.length },
  ];

  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoriesList}
      contentContainerStyle={styles.categoriesContainer}
    >
      {CATEGORIES.map((category) => {
        const IconComponent = category.icon;
        const isActive = activeCategory === category.id;
        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryTab,
              { backgroundColor: isActive ? colors.primary : colors.gray100 },
            ]}
            onPress={() => setActiveCategory(category.id)}
            activeOpacity={0.8}
          >
            <IconComponent
              size={ICON.size.sm}
              color={isActive ? COLORS.white : colors.textSecondary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[
              styles.categoryLabel,
              { color: isActive ? COLORS.white : colors.textSecondary }
            ]}>
              {category.label}
            </Text>
            {category.count > 0 && (
              <View style={[
                styles.countBadge,
                { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.primary + '15' }
              ]}>
                <Text style={[
                  styles.countText,
                  { color: isActive ? COLORS.white : colors.primary }
                ]}>
                  {category.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <BookmarkX size={64} color={colors.gray300} strokeWidth={1.5} />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        Aucun favori
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Vous n'avez pas encore ajouté de {
          activeCategory === 'opportunities' ? 'opportunités' :
          activeCategory === 'hubs' ? 'hubs' : 'communautés'
        } en favoris
      </Text>
    </View>
  );

  const renderOpportunityItem = ({ item, index }: { item: BookmarkedOpportunity; index: number }) => (
    <OpportunityCard
      opportunity={item as Opportunity}
      onPress={() => navigateToDetail('opportunity', item.id)}
      showBookmark
      isBookmarked={true}
      onBookmarkToggle={() => removeBookmark(item.id, 'opportunities')}
      isLast={index === opportunities.length - 1}
    />
  );

  const renderHubItem = ({ item, index }: { item: BookmarkedHub; index: number }) => (
    <HubCard
      hub={item as Hub}
      onPress={() => navigateToDetail('hub', item.id)}
      isLast={index === hubs.length - 1}
      showBookmark={true}
      isBookmarked={true}
      onBookmarkToggle={() => removeBookmark(item.id, 'hubs')}
    />
  );

  const renderCommunityItem = ({ item, index }: { item: BookmarkedCommunity; index: number }) => (
    <CommunityCard
      community={item as Community}
      onPress={() => navigateToDetail('community', item.id)}
      isLast={index === communities.length - 1}
      showBookmark={true}
      isBookmarked={true}
      onBookmarkToggle={() => removeBookmark(item.id, 'communities')}
    />
  );

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    switch (activeCategory) {
      case 'opportunities':
        return opportunities.length > 0 ? (
          <FlatList
            style={styles.list}
            data={opportunities}
            keyExtractor={(item) => item.id}
            renderItem={renderOpportunityItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      case 'hubs':
        return hubs.length > 0 ? (
          <FlatList
            style={styles.list}
            data={hubs}
            keyExtractor={(item) => item.id}
            renderItem={renderHubItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      case 'communities':
        return communities.length > 0 ? (
          <FlatList
            style={styles.list}
            data={communities}
            keyExtractor={(item) => item.id}
            renderItem={renderCommunityItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      default:
        return renderEmptyState();
    }
  };

  const totalBookmarks = opportunities.length + hubs.length + communities.length;

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
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Mes favoris
          </Text>
          {totalBookmarks > 0 && (
            <View style={[styles.totalBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.totalText, { color: colors.primary }]}>
                {totalBookmarks}
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Category Tabs */}
      {renderCategoryTabs()}

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      <FooterNav activeTab="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  totalBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },

  totalText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  categoriesList: {
    flexGrow: 0,
    marginVertical: SPACING.md,
  },

  categoriesContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },

  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
    gap: SPACING.xs,
  },

  categoryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  countBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
    minWidth: 20,
    alignItems: 'center',
  },

  countText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  content: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
  },
});
