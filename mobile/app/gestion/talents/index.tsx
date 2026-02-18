import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { SPACING, TYPOGRAPHY, ICON, BORDER, COMPONENT, TAG_COLOR_PALETTE, LAYOUT } from '../../../src/constants/theme';
import { Button, Chip, FooterNav, IconButton, Input, SelectCard } from '../../../src/components/ui';
import { ShimmerPlaceholder } from '../../../src/components/ui/ShimmerPlaceholder';
import { RemoteImage } from '../../../src/components/ui/RemoteImage';
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
  const [newTagColor, setNewTagColor] = useState<(typeof TAG_COLOR_PALETTE)[number]>(TAG_COLOR_PALETTE[0]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | undefined>(undefined);

  const TAG_COLORS = TAG_COLOR_PALETTE;

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
    const prompt = `Analyse de cohorte : ${cohort} (${total} talents).`;
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
    <SelectCard
      style={[styles.talentCard, { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', borderBottomWidth: BORDER.width.thin, borderBottomColor: colors.borderColor }]}
      onPress={() => router.push(`/details/talent/${item.talent_id}` as any)}
      selected={false}
      accessibilityLabel={`Ouvrir ${item.first_name} ${item.last_name}`}
    >
      <View style={[styles.avatar, { backgroundColor: colors.gray100 }]}>
        {item.avatar_url ? (
          <RemoteImage uri={item.avatar_url} style={styles.avatarImage} />
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

      <IconButton
        onPress={() => handleToggleFavorite(item)}
        icon={
          <Heart
            size={20}
            color={item.is_favorite ? colors.error : colors.gray300}
            fill={item.is_favorite ? colors.error : 'transparent'}
            strokeWidth={ICON.strokeWidth}
          />
        }
        accessibilityLabel={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        size="sm"
        variant="ghost"
      />
    </SelectCard>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.gray100 }]}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
          style={styles.backButton}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Mes Talents ({total})
        </Text>
        <IconButton
          onPress={() => setShowTagModal(true)}
          icon={<Tag size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Gérer les tags"
        />
      </View>

      {/* Search */}
      <Input
        placeholder="Rechercher un talent..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={loadTalents}
        returnKeyType="search"
        reserveHelperSpace={false}
        containerStyle={{ marginHorizontal: SPACING.lg, marginTop: SPACING.sm, marginBottom: SPACING.xs }}
        inputContainerStyle={[styles.searchContainer, { backgroundColor: colors.gray100, borderColor: 'transparent', borderWidth: 0 }]}
        inputStyle={[styles.searchInput, { color: colors.textPrimary, paddingHorizontal: SPACING.xs }]}
        leftIconContainerStyle={{ paddingLeft: SPACING.xs }}
        rightIconContainerStyle={{ paddingRight: SPACING.xs }}
        leftIcon={<Search size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
        rightIcon={search.length > 0 ? (
          <IconButton
            onPress={() => setSearch('')}
            icon={<X size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel="Effacer la recherche"
            size="sm"
            variant="ghost"
            style={{ backgroundColor: 'transparent' }}
          />
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
            <Chip
              key={f.key || 'all'}
              label={f.label}
              selected={isActive}
              onPress={() => setActiveFilter(f.key)}
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
            />
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
          <Chip
            label="Tous"
            selected={!activeTagFilter}
            onPress={() => setActiveTagFilter(undefined)}
            style={[
              styles.tagFilterChip,
              {
                backgroundColor: !activeTagFilter ? colors.primary : 'transparent',
                borderColor: !activeTagFilter ? colors.primary : colors.gray200,
              },
            ]}
            textStyle={[
              styles.tagFilterChipText,
              { color: !activeTagFilter ? colors.textOnPrimary : colors.textSecondary },
            ]}
          />
          {tags.map(tag => (
            <Chip
              key={tag.id}
              label={tag.name}
              selected={activeTagFilter === tag.id}
              onPress={() => setActiveTagFilter(activeTagFilter === tag.id ? undefined : tag.id)}
              leftIcon={
                <View
                  style={[
                    styles.tagFilterDot,
                    { backgroundColor: activeTagFilter === tag.id ? colors.textOnPrimary : tag.color },
                  ]}
                />
              }
              style={[
                styles.tagFilterChip,
                {
                  backgroundColor: activeTagFilter === tag.id ? tag.color : 'transparent',
                  borderColor: activeTagFilter === tag.id ? tag.color : tag.color + '60',
                },
              ]}
              textStyle={[
                styles.tagFilterChipText,
                { color: activeTagFilter === tag.id ? colors.textOnPrimary : tag.color },
              ]}
            />
          ))}
        </ScrollView>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.skeletonCard, { borderBottomColor: colors.borderColor }]}>
              <ShimmerPlaceholder width={44} height={44} borderRadius={22} />
              <View style={styles.skeletonContent}>
                <ShimmerPlaceholder width="55%" height={14} />
                <ShimmerPlaceholder width="70%" height={11} style={{ marginTop: 6 }} />
                <ShimmerPlaceholder width="35%" height={10} style={{ marginTop: 8 }} />
              </View>
            </View>
          ))}
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
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTagModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Gérer les tags</Text>
              <IconButton
                onPress={() => setShowTagModal(false)}
                icon={<X size={24} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel="Fermer"
                size="sm"
                variant="ghost"
              />
            </View>

            {/* Create tag */}
            <View style={styles.createTagRow}>
              <Input
                placeholder="Nom du tag"
                value={newTagName}
                onChangeText={setNewTagName}
                reserveHelperSpace={false}
                scrollOnFocus={false}
                containerStyle={{ flex: 1, alignSelf: 'center' }}
                inputContainerStyle={[styles.tagInput, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}
                inputStyle={[styles.tagInputText, { color: colors.textPrimary }]}
              />
              <IconButton
                onPress={handleCreateTag}
                icon={<Plus size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel="Créer le tag"
                variant="filled"
                size="md"
                style={[styles.createTagButton, { backgroundColor: colors.primary }]}
              />
            </View>

            {/* Color picker */}
            <View style={styles.colorRow}>
              {TAG_COLORS.map(c => (
                <SelectCard
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    newTagColor === c && [styles.colorDotSelected, { borderColor: colors.textOnPrimary }],
                  ]}
                  onPress={() => setNewTagColor(c)}
                  selected={false}
                  accessibilityLabel={`Couleur ${c}`}
                >
                  <View />
                </SelectCard>
              ))}
            </View>

            {/* Existing tags */}
            <View style={styles.tagsList}>
              {tags.map(tag => (
                <View key={tag.id} style={[styles.tagItem, { borderBottomColor: colors.gray100 }]}>
                  <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                  <Text style={[styles.tagItemName, { color: colors.textPrimary }]}>{tag.name}</Text>
                  <IconButton
                    onPress={() => handleDeleteTag(tag.id)}
                    icon={<X size={16} color={colors.gray400} strokeWidth={ICON.strokeWidth} />}
                    accessibilityLabel={`Supprimer le tag ${tag.name}`}
                    size="sm"
                    variant="ghost"
                  />
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
        <Button
          title="Analyse de cohorte"
          onPress={handleCohortAnalysis}
          fullWidth
          icon={<Radar size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
          style={[styles.cohortButton, { backgroundColor: colors.primary }]}
          textStyle={[styles.cohortButtonText, { color: colors.textOnPrimary }]}
        />
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
    paddingTop: SPACING.xs,
    paddingBottom: 0,
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
  skeletonList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },
  skeletonContent: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl * 2,
  },
  talentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 0,
    marginBottom: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    height: LAYOUT.inputHeight,
  },
  tagInputText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingHorizontal: 0,
    paddingVertical: SPACING.sm,
    textAlignVertical: 'center',
  },
  createTagButton: {
    width: LAYOUT.inputHeight,
    height: LAYOUT.inputHeight,
    borderRadius: BORDER.radius.md,
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
    paddingBottom: SPACING.xs,
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
    borderRadius: BORDER.radius.md,
  },
  cohortButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
