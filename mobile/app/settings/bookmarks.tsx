import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookmarkX,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { PageLayout, EmptyState, Chip } from '../../src/components/ui';
import { useI18n } from '../../src/contexts/I18nContext';
import { OpportunityCard, CommunityCard, SpaceCard } from '../../src/components/cards';
import { bookmarkService, Space } from '../../src/services';
import type {
  BookmarkedOpportunity,
  BookmarkedSpace,
  BookmarkedCommunity,
} from '../../src/services/bookmarkService';
import type { Opportunity, Community } from '../../src/types/models';

type Category = 'communities' | 'spaces' | 'opportunities';

export default function BookmarksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [activeCategory, setActiveCategory] = useState<Category>('communities');
  const [opportunities, setOpportunities] = useState<BookmarkedOpportunity[]>([]);
  const [spaces, setSpaces] = useState<BookmarkedSpace[]>([]);
  const [communities, setCommunities] = useState<BookmarkedCommunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBookmarks = useCallback(async () => {
    try {
      const [oppsRes, spacesRes, communitiesRes] = await Promise.all([
        bookmarkService.getOpportunities(),
        bookmarkService.getSpaces(),
        bookmarkService.getCommunities(),
      ]);

      if (oppsRes.data) {
        const transformedOpps = oppsRes.data.map((opp: any) => ({
          ...opp,
          organization: opp.organizations?.[0] || opp.organization,
        }));
        setOpportunities(transformedOpps);
      }
      if (spacesRes.data) setSpaces(spacesRes.data);
      if (communitiesRes.data) setCommunities(communitiesRes.data);
    } catch (error) {
      if (__DEV__) console.error('Error loading bookmarks:', error);
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
        case 'spaces':
          await bookmarkService.removeSpace(id);
          setSpaces(prev => prev.filter(s => s.id !== id));
          break;
        case 'communities':
          await bookmarkService.removeCommunity(id);
          setCommunities(prev => prev.filter(c => c.id !== id));
          break;
      }
    } catch (error) {
      if (__DEV__) console.error('Error removing bookmark:', error);
    }
  };

  const navigateToDetail = (type: string, id: string) => {
    router.push(`/details/${type}/${id}` as any);
  };

  const chips: Array<{ key: Category; label: string; count: number }> = [
    { key: 'communities', label: t('explore.categories.communities'), count: communities.length },
    { key: 'spaces', label: t('explore.categories.spaces'), count: spaces.length },
    { key: 'opportunities', label: t('explore.categories.opportunities'), count: opportunities.length },
  ];

  const getActiveItems = () => {
    switch (activeCategory) {
      case 'opportunities':
        return opportunities;
      case 'spaces':
        return spaces;
      case 'communities':
        return communities;
      default:
        return [];
    }
  };

  const emptySubtitleType =
    activeCategory === 'opportunities' ? t('bookmarks.typeOpportunities') :
    activeCategory === 'spaces' ? t('bookmarks.typeSpaces') : t('bookmarks.typeCommunities');

  const activeItems = getActiveItems();

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      >
	        {chips.map((chip) => {
	          const isActive = activeCategory === chip.key;
	          return (
	            <Chip
	              key={chip.key}
	              label={`${chip.label} (${chip.count})`}
	              selected={isActive}
	              style={[
	                styles.filterChip,
	                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
	                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
	              ]}
	              textStyle={[
	                styles.filterChipText,
	                { color: colors.gray700 },
	                isActive && { color: colors.textOnPrimary },
	              ]}
	              onPress={() => setActiveCategory(chip.key)}
	            />
	          );
	        })}
	      </ScrollView>
	    </View>
	  );

  return (
    <PageLayout
      title={t('bookmarks.title')}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
    >
      {activeItems.length === 0 ? (
        <EmptyState
          icon={BookmarkX}
          title={t('bookmarks.empty')}
          subtitle={t('bookmarks.emptySubtitle', { type: emptySubtitleType })}
        />
      ) : (
        <>
          {activeCategory === 'communities' &&
            communities.map((item, index) => (
              <View key={item.id} style={styles.cardWrapper}>
                <CommunityCard
                  community={item as Community}
                  onPress={() => navigateToDetail('community', item.id)}
                  isLast={index === communities.length - 1}
                  showBookmark
                  isBookmarked
                  onBookmarkToggle={() => removeBookmark(item.id, 'communities')}
                />
              </View>
            ))}
          {activeCategory === 'spaces' &&
            spaces.map((item, index) => (
              <View key={item.id} style={styles.cardWrapper}>
                <SpaceCard
                  space={item as Space}
                  onPress={() => navigateToDetail('space', item.id)}
                  isLast={index === spaces.length - 1}
                  showBookmark
                  isBookmarked
                  onBookmarkToggle={() => removeBookmark(item.id, 'spaces')}
                />
              </View>
            ))}
          {activeCategory === 'opportunities' &&
            opportunities.map((item, index) => (
              <View key={item.id} style={styles.cardWrapper}>
                <OpportunityCard
                  opportunity={item as Opportunity}
                  onPress={() => navigateToDetail('opportunity', item.id)}
                  showBookmark
                  isBookmarked
                  onBookmarkToggle={() => removeBookmark(item.id, 'opportunities')}
                  isLast={index === opportunities.length - 1}
                />
              </View>
            ))}
        </>
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
  cardWrapper: {
    marginBottom: SPACING.md,
  },
});
