import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Search,
  X,
  Tag,
  Plus,
  User,
  Radar,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, COMPONENT } from '../../../src/constants/theme';
import { FooterNav, Input } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import {
  orgTalentService,
  OrgTalent,
  OrgTalentFilters,
  OrgTagDefinition,
  SOURCE_LABELS,
} from '../../../src/services';

type SourceFilter = OrgTalentFilters['source'] | 'FAVORITES' | undefined;

export default function TalentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedOrg } = useSpace();

  const [talents, setTalents] = useState<OrgTalent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<SourceFilter>(undefined);
  const [tags, setTags] = useState<OrgTagDefinition[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B5E52');
  const [activeTagFilter, setActiveTagFilter] = useState<string | undefined>(undefined);

  const TAG_COLORS = ['#6B5E52', '#4A6741', '#8B4A3C', '#A67C52', '#5E6B52', '#6B525E', '#52656B'];

  const loadTalents = useCallback(async () => {
    if (!selectedOrg?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const filters: OrgTalentFilters = {
        search: search || undefined,
        limit: 50,
      };

      if (activeFilter === 'FAVORITES') {
        filters.isFavorite = true;
      } else if (activeFilter) {
        filters.source = activeFilter;
      }

      if (activeTagFilter) {
        filters.tagId = activeTagFilter;
      }

      const result = await orgTalentService.getTalents(selectedOrg.id, filters);
      setTalents(result.talents);
      setTotal(result.total);
    } catch (error) {
      console.error('Error loading talents:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedOrg?.id, search, activeFilter, activeTagFilter]);

  const loadTags = useCallback(async () => {
    if (!selectedOrg?.id) return;
    try {
      const result = await orgTalentService.getTags(selectedOrg.id);
      setTags(result);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    loadTalents();
    loadTags();
  }, [loadTalents, loadTags]);

  useFocusEffect(
    useCallback(() => {
      loadTalents();
    }, [loadTalents])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTalents();
  };

  const handleToggleFavorite = async (talent: OrgTalent) => {
    if (!selectedOrg?.id) return;
    try {
      if (talent.is_favorite) {
        await orgTalentService.unfavoriteTalent(selectedOrg.id, talent.talent_id);
      } else {
        await orgTalentService.favoriteTalent(selectedOrg.id, talent.talent_id);
      }
      setTalents(prev =>
        prev.map(t =>
          t.talent_id === talent.talent_id ? { ...t, is_favorite: !t.is_favorite } : t
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!selectedOrg?.id || !newTagName.trim()) return;
    try {
      await orgTalentService.createTag(selectedOrg.id, newTagName.trim(), newTagColor);
      setNewTagName('');
      loadTags();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!selectedOrg?.id) return;
    try {
      await orgTalentService.deleteTag(selectedOrg.id, tagId);
      loadTags();
      if (activeTagFilter === tagId) setActiveTagFilter(undefined);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };


  const getCohortLabel = (): string => {
    const parts: string[] = [];
    if (activeFilter === 'FAVORITES') parts.push('Favoris');
    else if (activeFilter === 'APPLICATION') parts.push('Candidatures');
    else if (activeFilter === 'COMMUNITY') parts.push('Communautés');
    else if (activeFilter === 'SPACE_BOOKING') parts.push('Réservations');
    const activeTag = tags.find(t => t.id === activeTagFilter);
    if (activeTag) parts.push(activeTag.name);
    return parts.length > 0 ? parts.join(' · ') : 'Tous les talents';
  };

  const handleCohortAnalysis = () => {
    const cohort = getCohortLabel();
    const prompt = `Analyse de cohorte : ${cohort} (${total} talents).\n`;
    router.push({
      pathname: '/(tabs)/assistant',
      params: { prompt, focusInput: 'true' },
    });
  };

  const filters: { key: SourceFilter; label: string }[] = [
    { key: undefined, label: 'Tous' },
    { key: 'APPLICATION', label: 'Candidatures' },
    { key: 'COMMUNITY', label: 'Communautés' },
    { key: 'SPACE_BOOKING', label: 'Réservations' },
    { key: 'FAVORITES', label: 'Favoris' },
  ];

  const renderTalent = ({ item }: { item: OrgTalent }) => (
    <TouchableOpacity
      style={[styles.talentCard, { backgroundColor: colors.surface }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/details/talent/${item.talent_id}` as any)}
    >
      <View style={[styles.avatar, { backgroundColor: colors.gray100 }]}>
        {item.avatar_url ? (
          <View style={styles.avatarPlaceholder}>
            <User size={20} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
          </View>
        ) : (
          <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
            {(item.first_name?.[0] || '') + (item.last_name?.[0] || '')}
          </Text>
        )}
      </View>

      <View style={styles.talentInfo}>
        <Text style={[styles.talentName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={[styles.talentEmail, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.email}
        </Text>

        <View style={styles.pillsRow}>
          {item.sources.map(source => (
            <View
              key={source}
              style={[styles.sourcePill, { backgroundColor: colors.gray100 }]}
            >
              <Text style={[styles.sourcePillText, { color: colors.textSecondary }]}>
                {SOURCE_LABELS[source] || source}
              </Text>
            </View>
          ))}
        </View>

        {item.tags && item.tags.length > 0 && (
          <View style={styles.pillsRow}>
            {item.tags.map(tag => (
              <View
                key={tag.id}
                style={[styles.tagChip, { backgroundColor: tag.color + '20' }]}
              >
                <Text style={[styles.tagChipText, { color: tag.color }]}>
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => handleToggleFavorite(item)}
        style={styles.favoriteButton}
      >
        <Heart
          size={20}
          color={item.is_favorite ? colors.error : colors.gray300}
          fill={item.is_favorite ? colors.error : 'transparent'}
          strokeWidth={ICON.strokeWidth}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.gray100 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Mes Talents ({total})
        </Text>
        <TouchableOpacity onPress={() => setShowTagModal(true)} style={styles.tagButton}>
          <Tag size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <Input
        placeholder="Rechercher un talent..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={loadTalents}
        returnKeyType="search"
        containerStyle={{ marginHorizontal: SPACING.lg, marginTop: SPACING.sm }}
        inputContainerStyle={[styles.searchContainer, { backgroundColor: colors.gray100, borderColor: 'transparent', borderWidth: 0 }]}
        inputStyle={[styles.searchInput, { color: colors.textPrimary, paddingHorizontal: 0 }]}
        leftIcon={<Search size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
        rightIcon={search.length > 0 ? (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <X size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Filters - Level 1: Source */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filtersRow}
      >
        {filters.map(f => {
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[
                styles.filterChip,
                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.gray700 },
                  isActive && { color: colors.textOnPrimary },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filters - Level 2: Tags */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.tagFiltersRow}
        >
          <Tag size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
          <TouchableOpacity
            style={[
              styles.tagFilterChip,
              {
                backgroundColor: !activeTagFilter ? colors.primary : 'transparent',
                borderColor: !activeTagFilter ? colors.primary : colors.gray200,
              },
            ]}
            onPress={() => setActiveTagFilter(undefined)}
          >
            <Text style={[
              styles.tagFilterChipText,
              { color: !activeTagFilter ? colors.textOnPrimary : colors.textSecondary },
            ]}>
              Tous
            </Text>
          </TouchableOpacity>
          {tags.map(tag => (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.tagFilterChip,
                {
                  backgroundColor: activeTagFilter === tag.id ? tag.color : 'transparent',
                  borderColor: activeTagFilter === tag.id ? tag.color : tag.color + '60',
                },
              ]}
              onPress={() => setActiveTagFilter(activeTagFilter === tag.id ? undefined : tag.id)}
            >
              <View style={[styles.tagFilterDot, { backgroundColor: activeTagFilter === tag.id ? colors.textOnPrimary : tag.color }]} />
              <Text style={[
                styles.tagFilterChipText,
                { color: activeTagFilter === tag.id ? colors.textOnPrimary : tag.color },
              ]}>
                {tag.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={talents}
          keyExtractor={item => item.talent_id}
          renderItem={renderTalent}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Heart size={40} color={colors.gray300} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucun talent trouvé
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.gray400 }]}>
                Les talents apparaîtront ici quand ils interagiront avec votre organisation
              </Text>
            </View>
          }
        />
      )}

      {/* Tag Management Modal */}
      <Modal visible={showTagModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTagModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Gérer les tags</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <X size={24} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>

            {/* Create tag */}
            <View style={styles.createTagRow}>
              <Input
                placeholder="Nom du tag"
                value={newTagName}
                onChangeText={setNewTagName}
                containerStyle={{ flex: 1 }}
                inputContainerStyle={[styles.tagInput, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
                inputStyle={{ color: colors.textPrimary, paddingHorizontal: 0 }}
              />
              <TouchableOpacity
                style={[styles.createTagButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateTag}
              >
                <Plus size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>

            {/* Color picker */}
            <View style={styles.colorRow}>
              {TAG_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    newTagColor === c && [styles.colorDotSelected, { borderColor: colors.textOnPrimary }],
                  ]}
                  onPress={() => setNewTagColor(c)}
                />
              ))}
            </View>

            {/* Existing tags */}
            <View style={styles.tagsList}>
              {tags.map(tag => (
                <View key={tag.id} style={[styles.tagItem, { borderBottomColor: colors.gray100 }]}>
                  <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                  <Text style={[styles.tagItemName, { color: colors.textPrimary }]}>{tag.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteTag(tag.id)}>
                    <X size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>
                </View>
              ))}
              {tags.length === 0 && (
                <Text style={[styles.noTagsText, { color: colors.gray400 }]}>
                  Aucun tag créé
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cohort Analysis Button */}
      <View style={[styles.cohortButtonContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.cohortButton, { backgroundColor: colors.primary }]}
          onPress={handleCohortAnalysis}
          activeOpacity={0.8}
        >
          <Radar size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.cohortButtonText, { color: colors.textOnPrimary }]}>
            Analyse de cohorte
          </Text>
        </TouchableOpacity>
      </View>

      <FooterNav activeTab="gestion" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  tagButton: { padding: SPACING.xs },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
    height: 40,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    height: 40,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.xs,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl * 2,
  },
  talentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  talentInfo: { flex: 1 },
  talentName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 2,
  },
  talentEmail: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.xs,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  sourcePill: {
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    paddingVertical: COMPONENT.pill.paddingVertical,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  sourcePillText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  tagChip: {
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    paddingVertical: COMPONENT.pill.paddingVertical,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  tagChipText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  favoriteButton: {
    padding: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: BORDER.radius.lg,
    borderTopRightRadius: BORDER.radius.lg,
    padding: SPACING.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  createTagRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    height: 40,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  createTagButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: 'transparent',
  },
  tagsList: {
    gap: 0,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  tagDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tagItemName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  noTagsText: {
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Tag filters
  tagFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  tagFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    paddingVertical: COMPONENT.pill.paddingVertical,
    borderRadius: COMPONENT.pill.borderRadius,
    borderWidth: 1,
    gap: COMPONENT.pill.gap,
  },
  tagFilterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagFilterChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  // Cohort analysis button
  cohortButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  cohortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  cohortButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
