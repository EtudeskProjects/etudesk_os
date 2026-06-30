import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ImageBackground,
  Image,
  Modal,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Search,
  Briefcase,
  Users,
  MapPin,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  X,
  Check,
  Clock,
  Eye,
  SignalHigh,
  Tag,
} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, withOpacity, OPACITY, COMPONENT, STATIC_COLORS } from '../../../src/constants/theme';
	import { useTheme } from '../../../src/hooks/useTheme';
	import { useI18n } from '../../../src/contexts/I18nContext';
	import { Button, Header, FooterNav, IconButton, Input, RadioRow, LoadingShimmer } from '../../../src/components/ui';
	import { ShimmerPlaceholder } from '../../../src/components/ui/ShimmerPlaceholder';
import { formatRelativeTime, formatDeadline } from '../../../src/utils/date';
import { formatCompactNumber } from '../../../src/utils/number';
import type {
  Opportunity,
  Community,
} from '../../../src/types/models';
import { OpportunityCard, CommunityCard, SpaceCard } from '../../../src/components/cards';
import { opportunityService, communityService, spaceService, bookmarkService, Space } from '../../../src/services';
import type { BookmarkIdsResponse } from '../../../src/services/bookmarkService';

type Category = 'opportunities' | 'communities' | 'spaces';
type SortOption = 'relevance' | 'proximity' | 'recent' | 'popularity';

// Pagination config
const PAGE_SIZE = 20;

const isCategory = (value?: string): value is Category => (
  value === 'opportunities' || value === 'communities' || value === 'spaces'
);

// User location for proximity sorting (mock - would come from user profile)
const USER_LOCATION = {
  city: 'Remote',
  region: '',
  country: '',
};

// Placeholder images for items without images
const PLACEHOLDER_IMAGES = {
  opportunity: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&q=80',
  space: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=80',
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&q=80',
};


// Helper to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Helper to format location
const formatLocation = (item: { city?: string; country?: string; locations?: { city?: string }[] }, fallback: string): string => {
  if ('locations' in item && item.locations?.[0]?.city) {
    return item.locations[0].city;
  }
  return item.city || fallback;
};

// Proximity scoring: 0 = same city, 1 = same region, 2 = same country, 3 = global
const getProximityScore = (item: { city?: string; region?: string; country?: string; locations?: { city?: string; region?: string; country?: string }[] }): number => {
  const itemCity = 'locations' in item && item.locations?.[0]?.city ? item.locations[0].city : item.city;
  const itemRegion = 'locations' in item && item.locations?.[0]?.region ? item.locations[0].region : (item as any).region;
  const itemCountry = 'locations' in item && item.locations?.[0]?.country ? item.locations[0].country : item.country;

  if (itemCity === USER_LOCATION.city) return 0;
  if (itemRegion === USER_LOCATION.region) return 1;
  if (itemCountry === USER_LOCATION.country) return 2;
  return 3;
};

// Helper to check if a deadline has passed
const isExpired = (deadline?: string): boolean => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

// Filter out expired items (for opportunities with deadlines)
const filterExpired = <T extends { deadline?: string }>(items: T[]): T[] => {
  return items.filter(item => !isExpired(item.deadline));
};

export default function ExploreScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const [activeCategory, setActiveCategory] = useState<Category>(
    isCategory(initialCategory) ? initialCategory : 'opportunities'
  );
  const [bookmarkedItems, setBookmarkedItems] = useState<Record<string, Set<string>>>({
    opportunities: new Set(),
    spaces: new Set(),
    communities: new Set(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Data state from API
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination state for each category
  const [displayedCounts, setDisplayedCounts] = useState<Record<Category, number>>({
    opportunities: PAGE_SIZE,
    spaces: PAGE_SIZE,
    communities: PAGE_SIZE,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { colors } = useTheme();
  const { t } = useI18n();

  // Load bookmarks IDs
  const loadBookmarks = useCallback(async () => {
    try {
      const response = await bookmarkService.getAllBookmarkIds();
      if (response.data) {
        setBookmarkedItems({
          opportunities: new Set(response.data.opportunities || []),
          spaces: new Set(response.data.spaces || []),
          communities: new Set(response.data.communities || []),
        });
      }
    } catch (error) {
      // User might not be logged in, ignore
    }
  }, []);

  // Load data from API
  const loadData = useCallback(async () => {
    try {
      const [oppsRes, spacesRes, communitiesRes] = await Promise.allSettled([
        opportunityService.getAll({ status: 'OPEN', limit: 50 }),
        spaceService.getAll({ limit: 50 }),
        communityService.getAll({ status: 'ACTIVE', limit: 50 }), // Communities use ACTIVE
      ]);

      if (oppsRes.status === 'fulfilled' && oppsRes.value.data) {
        // Transform organizations array to organization object
        const transformedOpps = oppsRes.value.data.map((opp: any) => ({
          ...opp,
          organization: opp.organizations?.[0] || opp.organization,
        }));
        setOpportunities(transformedOpps);
      }
      if (spacesRes.status === 'fulfilled' && spacesRes.value.data) setSpaces(spacesRes.value.data);
      if (communitiesRes.status === 'fulfilled' && communitiesRes.value.data) setCommunities(communitiesRes.value.data);

      if (__DEV__) {
        if (oppsRes.status === 'rejected') console.error('Error loading opportunities:', oppsRes.reason);
        if (spacesRes.status === 'rejected') console.error('Error loading spaces:', spacesRes.reason);
        if (communitiesRes.status === 'rejected') console.error('Error loading communities:', communitiesRes.reason);
      }

      // Load bookmarks after data
      loadBookmarks();
    } catch (error) {
      if (__DEV__) console.error('Error loading explore data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadBookmarks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isCategory(initialCategory)) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Categories with translated labels and local images.
  const CATEGORIES_TRANSLATED = [
    { id: 'opportunities' as Category, label: t('explore.categories.opportunities'), icon: Briefcase, image: require('../../../assets/explore_opportunities.jpg') },
    { id: 'communities' as Category, label: t('explore.categories.communities'), icon: Users, image: require('../../../assets/explore_communities.jpg') },
    { id: 'spaces' as Category, label: t('explore.categories.spaces') || 'Espaces', icon: MapPin, image: require('../../../assets/explore_spaces.jpg') },
  ];

  // Sort options configuration
  const SORT_OPTIONS: { id: SortOption; icon: typeof SignalHigh }[] = [
    { id: 'relevance', icon: SignalHigh },
    { id: 'proximity', icon: MapPin },
    { id: 'recent', icon: Clock },
    { id: 'popularity', icon: Eye },
  ];

  // Search filter function
  const filterBySearch = <T extends { title?: string; name?: string; display_name?: string; description?: string; bio?: string }>(items: T[], query: string): T[] => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
      const searchableFields = [
        item.title,
        item.name,
        item.display_name,
        item.description,
        item.bio,
      ].filter(Boolean).map(f => f!.toLowerCase());
      return searchableFields.some(field => field.includes(lowerQuery));
    });
  };

  // Sort function
  const sortItems = <T extends { posted_at?: string; created_at?: string; relevance_score?: number; applications_count?: number; city?: string; region?: string; country?: string; locations?: { city?: string; region?: string; country?: string }[] }>(items: T[], option: SortOption): T[] => {
    const sorted = [...items];
    switch (option) {
      case 'relevance':
        return sorted.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      case 'proximity':
        return sorted.sort((a, b) => getProximityScore(a) - getProximityScore(b));
      case 'recent':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.posted_at || a.created_at || 0).getTime();
          const dateB = new Date(b.posted_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });
      case 'popularity':
        return sorted.sort((a, b) => (b.applications_count || 0) - (a.applications_count || 0));
      default:
        return sorted;
    }
  };

  // Filtered and sorted data (excluding expired and private)
  const allFilteredOpportunities = useMemo(() => {
    const publicOnly = opportunities.filter(opp => (opp.visibility || 'PUBLIC') === 'PUBLIC');
    const nonExpired = filterExpired(publicOnly);
    return sortItems(filterBySearch(nonExpired, searchQuery), sortOption);
  }, [opportunities, searchQuery, sortOption]);

  const allFilteredSpaces = useMemo(() => {
    // Filter out private spaces - they should not appear in explore
    const publicSpaces = spaces.filter(space => space.visibility !== 'PRIVATE');
    return sortItems(filterBySearch(publicSpaces, searchQuery), sortOption);
  }, [spaces, searchQuery, sortOption]);

  const allFilteredCommunities = useMemo(() => {
    return sortItems(filterBySearch(communities, searchQuery), sortOption);
  }, [communities, searchQuery, sortOption]);

  // Paginated data
  const filteredOpportunities = useMemo(() => {
    return allFilteredOpportunities.slice(0, displayedCounts.opportunities);
  }, [allFilteredOpportunities, displayedCounts.opportunities]);

  const filteredSpaces = useMemo(() => {
    return allFilteredSpaces.slice(0, displayedCounts.spaces);
  }, [allFilteredSpaces, displayedCounts.spaces]);

  const filteredCommunities = useMemo(() => {
    return allFilteredCommunities.slice(0, displayedCounts.communities);
  }, [allFilteredCommunities, displayedCounts.communities]);

  // Check if there's more data to load
  const hasMore = useMemo(() => ({
    opportunities: allFilteredOpportunities.length > displayedCounts.opportunities,
    spaces: allFilteredSpaces.length > displayedCounts.spaces,
    communities: allFilteredCommunities.length > displayedCounts.communities,
  }), [allFilteredOpportunities.length, allFilteredSpaces.length, allFilteredCommunities.length, displayedCounts]);

  // Load more handler
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore[activeCategory]) return;

    setIsLoadingMore(true);
    // Simulate loading delay for better UX
    setTimeout(() => {
      setDisplayedCounts(prev => ({
        ...prev,
        [activeCategory]: prev[activeCategory] + PAGE_SIZE,
      }));
      setIsLoadingMore(false);
    }, 300);
  }, [activeCategory, hasMore, isLoadingMore]);

  // Reset pagination when search or sort changes
  const resetPagination = useCallback(() => {
    setDisplayedCounts({
      opportunities: PAGE_SIZE,
      spaces: PAGE_SIZE,
      communities: PAGE_SIZE,
    });
  }, []);

  const toggleBookmark = async (id: string, category: Category) => {
    const categoryKey = category === 'opportunities' ? 'opportunities' :
                        category === 'spaces' ? 'spaces' : 'communities';

    const isCurrentlyBookmarked = bookmarkedItems[categoryKey].has(id);

    // Optimistic update
    setBookmarkedItems(prev => {
      const newSet = new Set(prev[categoryKey]);
      if (isCurrentlyBookmarked) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, [categoryKey]: newSet };
    });

    try {
      // Call API
      const entityType = category === 'opportunities' ? 'opportunities' :
                         category === 'spaces' ? 'spaces' : 'communities';

      await bookmarkService.toggle(entityType, id, isCurrentlyBookmarked);
    } catch (error) {
      // Revert on error
      if (__DEV__) console.error('Error toggling bookmark:', error);
      setBookmarkedItems(prev => {
        const newSet = new Set(prev[categoryKey]);
        if (isCurrentlyBookmarked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return { ...prev, [categoryKey]: newSet };
      });
    }
  };

  const navigateToDetail = (type: string, id: string) => {
    router.push(`/details/${type}/${id}` as any);
  };

  const handleSortSelect = (option: SortOption) => {
    setSortOption(option);
    setShowFilterModal(false);
    resetPagination();
  };

  // Handle search with pagination reset
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    resetPagination();
  };

	  const renderFilterModal = () => (
	    <Modal
	      visible={showFilterModal}
	      transparent
	      animationType="fade"
	      onRequestClose={() => setShowFilterModal(false)}
	    >
	      <Pressable
	        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
	        onPress={() => setShowFilterModal(false)}
	      >
	        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
	          <View style={[styles.modalHeader, { borderBottomColor: withOpacity(colors.black, OPACITY[10]) }]}>
	            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
	              {t('explore.sortBy')}
	            </Text>
	            <IconButton
	              onPress={() => setShowFilterModal(false)}
	              icon={<X size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	              accessibilityLabel={t('common.close')}
	              size="sm"
	              variant="ghost"
	            />
	          </View>
	
	          {SORT_OPTIONS.map((option) => {
	            const IconComponent = option.icon;
	            const isSelected = sortOption === option.id;
	            return (
	              <RadioRow
	                key={option.id}
	                onPress={() => handleSortSelect(option.id)}
	                selected={isSelected}
	                title={t(`explore.sortOptions.${option.id}`)}
	                description={t(`explore.sortOptions.${option.id}Desc`)}
	                icon={
	                  <View
	                    style={[
	                      styles.filterIconContainer,
	                      { backgroundColor: isSelected ? withOpacity(colors.primary, OPACITY[20]) : colors.gray100 },
	                    ]}
	                  >
	                    <IconComponent
	                      size={ICON.size.md}
	                      color={isSelected ? colors.primary : colors.textSecondary}
	                      strokeWidth={ICON.strokeWidth}
	                    />
	                  </View>
	                }
	                style={[
	                  styles.filterOption,
	                  { borderBottomColor: colors.borderColor },
	                  isSelected && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
	                ]}
	                titleStyle={[styles.filterOptionTitle, { color: isSelected ? colors.primary : colors.textPrimary }]}
	                descriptionStyle={[styles.filterOptionDesc, { color: colors.textSecondary }]}
	                iconContainerStyle={{ width: undefined, height: undefined, borderRadius: 0 }}
	                radioStyle={{ marginLeft: SPACING.sm }}
	              />
	            );
	          })}
	        </Pressable>
	      </Pressable>
	    </Modal>
	  );

  const renderCategoryTabs = () => (
    <View style={styles.categoriesContainer}>
      {CATEGORIES_TRANSLATED.map((category) => {
        const IconComponent = category.icon;
        const isActive = activeCategory === category.id;
        return (
          <Pressable
            key={category.id}
            style={styles.categoryTab}
            onPress={() => setActiveCategory(category.id)}
          >
            <ImageBackground
              source={category.image}
              style={styles.categoryTabBackground}
              imageStyle={styles.categoryTabImage}
            >
              <View style={[
                styles.categoryTabOverlay,
                // Dark scrim + light text, theme-independent (media card): readable on any photo.
                { backgroundColor: withOpacity(STATIC_COLORS.black, OPACITY[50]) },
                isActive && { backgroundColor: withOpacity(colors.primary, OPACITY[80]) }
              ]}>
                <IconComponent
                  size={ICON.size.md}
                  color={STATIC_COLORS.white}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={[styles.categoryLabel, { color: STATIC_COLORS.white }]}>
                  {category.label}
                </Text>
              </View>
            </ImageBackground>
          </Pressable>
        );
      })}
    </View>
  );

  const renderOpportunityItem = ({ item, index }: { item: Opportunity; index: number }) => {
    return (
      <OpportunityCard
        opportunity={item}
        onPress={() => navigateToDetail('opportunity', item.id)}
        showBookmark
        isBookmarked={bookmarkedItems.opportunities.has(item.id)}
        onBookmarkToggle={() => toggleBookmark(item.id, 'opportunities')}
        isLast={index === filteredOpportunities.length - 1}
      />
    );
  };

  const renderSpaceItem = ({ item, index }: { item: Space; index: number }) => {
    return (
      <SpaceCard
        space={item}
        onPress={() => navigateToDetail('space', item.id)}
        isLast={index === filteredSpaces.length - 1}
        showBookmark={true}
        isBookmarked={bookmarkedItems.spaces.has(item.id)}
        onBookmarkToggle={() => toggleBookmark(item.id, 'spaces')}
      />
    );
  };

  const renderCommunityItem = ({ item, index }: { item: Community; index: number }) => {
    return (
      <CommunityCard
        community={item}
        onPress={() => navigateToDetail('community', item.id)}
        isLast={index === filteredCommunities.length - 1}
        showBookmark={true}
        isBookmarked={bookmarkedItems.communities.has(item.id)}
        onBookmarkToggle={() => toggleBookmark(item.id, 'communities')}
      />
    );
  };

  const renderEmptyState = () => {
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Search size={48} color={colors.gray300} strokeWidth={1.5} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('explore.noResultsSearch', { query: searchQuery })}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('common.noResults')}</Text>
      </View>
    );
  };

  // Footer component for load more
	  const renderFooter = () => {
	    if (!hasMore[activeCategory]) return null;
	    return (
	      <View style={styles.loadMoreContainer}>
	        {isLoadingMore ? (
	          <LoadingShimmer variant="inline" />
	        ) : (
	          <Button
	            title={t('common.seeMore')}
	            onPress={loadMore}
	            variant="outline"
	            size="sm"
	            style={[styles.loadMoreButton, { borderColor: colors.borderColor }]}
	            textStyle={[styles.loadMoreText, { color: colors.primary }]}
	          />
	        )}
	      </View>
	    );
	  };

  const renderCardSkeleton = (key: number) => (
    <View key={key} style={[styles.skeletonCard, { borderBottomColor: colors.borderColor }]}>
      <ShimmerPlaceholder width={48} height={48} borderRadius={BORDER.radius.sm} />
      <View style={styles.skeletonContent}>
        <ShimmerPlaceholder width="65%" height={14} />
        <ShimmerPlaceholder width="45%" height={11} style={{ marginTop: 6 }} />
        <ShimmerPlaceholder width="30%" height={10} style={{ marginTop: 8 }} />
      </View>
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map(renderCardSkeleton)}
        </View>
      );
    }

    const refreshControl = (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    );

    switch (activeCategory) {
      case 'opportunities':
        return filteredOpportunities.length > 0 ? (
          <FlatList
            style={styles.list}
            data={filteredOpportunities}
            keyExtractor={(item) => item.id}
            renderItem={renderOpportunityItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      case 'spaces':
        return filteredSpaces.length > 0 ? (
          <FlatList
            style={styles.list}
            data={filteredSpaces}
            keyExtractor={(item) => item.id}
            renderItem={renderSpaceItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      case 'communities':
        return filteredCommunities.length > 0 ? (
          <FlatList
            style={styles.list}
            data={filteredCommunities}
            keyExtractor={(item) => item.id}
            renderItem={renderCommunityItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={refreshControl}
          />
        ) : renderEmptyState();
      default:
        return renderEmptyState();
    }
  };

  // Get current sort option icon for display
  const currentSortIcon = SORT_OPTIONS.find(o => o.id === sortOption)?.icon || SignalHigh;
  const CurrentSortIcon = currentSortIcon;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <Header
        title={t('explore.title')}
        rightContent={
          <IconButton
            onPress={() => router.push('/settings/bookmarks' as any)}
            icon={<Bookmark size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('bookmarks.title')}
          />
        }
      />

      {/* Search Bar + Filter Button */}
      <View style={styles.searchContainer}>
        <Input
          placeholder={t('common.search')}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          reserveHelperSpace={false}
          containerStyle={{ flex: 1, alignSelf: 'center' }}
          inputContainerStyle={[styles.searchBar, { backgroundColor: colors.gray100, borderColor: 'transparent', borderWidth: 0 }]}
	          inputStyle={[styles.searchInput, { color: colors.textPrimary, paddingHorizontal: 0 }]}
	          leftIcon={<Search size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	          rightIcon={searchQuery.length > 0 ? (
	            <IconButton
	              onPress={() => handleSearchChange('')}
	              icon={<X size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	              accessibilityLabel={t('common.clear')}
	              size="sm"
	              variant="ghost"
	              style={{ width: 28, height: 28 }}
	            />
	          ) : undefined}
	        />
	        <IconButton
	          onPress={() => setShowFilterModal(true)}
	          icon={
	            <CurrentSortIcon
	              size={ICON.size.md}
	              color={sortOption !== 'relevance' ? colors.primary : colors.textSecondary}
	              strokeWidth={ICON.strokeWidth}
	            />
	          }
	          accessibilityLabel={t('explore.sortBy')}
	          size="sm"
	          variant="ghost"
	          style={[
	            styles.filterButton,
	            { backgroundColor: sortOption !== 'relevance' ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100 },
	          ]}
	        />
	      </View>

      {/* Category Tabs */}
      {renderCategoryTabs()}

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Filter Modal */}
      {renderFilterModal()}

      <FooterNav activeTab="explore" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  skeletonList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },

  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },

  skeletonContent: {
    flex: 1,
  },

  // Header
  filterButton: {
    width: LAYOUT.inputHeight,
    height: LAYOUT.inputHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  headerButton: {
    // replaced by unified <IconButton />
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },

  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: LAYOUT.inputHeight,
    paddingHorizontal: SPACING.md,
    borderWidth: 0,
    borderRadius: BORDER.radius.sm,
  },

  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: SPACING.sm,
    textAlignVertical: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    borderTopLeftRadius: BORDER.radius.xl,
    borderTopRightRadius: BORDER.radius.xl,
    paddingBottom: SPACING.xxxl,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },

  filterIconContainer: {
    width: LAYOUT.inputHeightSm,
    height: LAYOUT.inputHeightSm,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterTextContainer: {
    flex: 1,
  },

  filterOptionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: 2,
  },

  filterOptionDesc: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  // Categories
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  categoryTab: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: BORDER.radius.md,
  },

  categoryTabBackground: {
    height: 180,
  },

  categoryTabImage: {
    resizeMode: 'cover',
    borderRadius: BORDER.radius.md,
  },

  categoryTabOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.xs,
  },

  categoryLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
  },

  // Content
  content: {
    flex: 1,
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },

  listItemLast: {
    borderBottomWidth: 0,
  },

  bookmarkButton: {
    padding: SPACING.xs,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },

  itemImageContainer: {
    width: 56,
    height: 56,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemImagePlaceholderText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER.radius.md,
  },

  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarPlaceholderText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  listItemContent: {
    flex: 1,
    gap: 2,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  listItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  listItemSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },

  tagSmall: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },

  tagSmallText: {
    fontSize: COMPONENT.pill.fontSize,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  listItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },

  badgeUrgent: {
    borderWidth: 1,
  },

  badgeTextUrgent: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  verifiedBadge: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },

  verifiedBadgeText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // Load More
  loadMoreContainer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },

  loadMoreButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  loadMoreText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: SPACING.lg,
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
