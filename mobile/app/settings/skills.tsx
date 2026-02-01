/**
 * Skills Screen
 * Talent skills management - listing, adding, updating, and deleting
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  Search,
  X,
  BookOpen,
  Wrench,
  Heart,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { Button, PageLayout, EmptyState } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import skillService, {
  TalentSkill,
  SkillSearchResult,
  PROFICIENCY_LABELS,
  SKILL_TYPE_LABELS,
  PROFICIENCY_LEVELS,
} from '../../src/services/skillService';

const PROFICIENCY_COLORS: Record<string, string> = {
  BEGINNER: '#94a3b8',
  INTERMEDIATE: '#3b82f6',
  EXPERT: '#f59e0b',
  MASTER: '#10b981',
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'KNOWLEDGE':
      return BookOpen;
    case 'HARD_SKILL':
      return Wrench;
    case 'SOFT_SKILL':
      return Heart;
    default:
      return Wrench;
  }
}

export default function SkillsScreen() {
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [skills, setSkills] = useState<TalentSkill[]>([]);

  // Add skill modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SkillSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProficiency, setSelectedProficiency] = useState<string>('INTERMEDIATE');
  const [selectedType, setSelectedType] = useState<string>('');
  const [customSkillName, setCustomSkillName] = useState('');

  const loadSkills = useCallback(async () => {
    try {
      const data = await skillService.getMySkills();
      setSkills(data);
    } catch (error) {
      console.error('Error loading skills:', error);
      Alert.alert('Erreur', 'Impossible de charger les compétences');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadSkills();
      setIsLoading(false);
    };
    load();
  }, [loadSkills]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSkills();
    setIsRefreshing(false);
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await skillService.searchSkills(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddFromSearch = async (result: SkillSearchResult) => {
    try {
      await skillService.addSkill({
        skillId: result.id,
        proficiencyLevel: selectedProficiency,
      });
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadSkills();
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || "Erreur lors de l'ajout");
    }
  };

  const handleAddCustom = async () => {
    if (!customSkillName.trim()) return;
    try {
      await skillService.addSkill({
        skillName: customSkillName.trim(),
        proficiencyLevel: selectedProficiency,
        type: selectedType || undefined,
      });
      setShowAddModal(false);
      setCustomSkillName('');
      setSelectedType('');
      setSearchQuery('');
      await loadSkills();
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || "Erreur lors de l'ajout");
    }
  };

  const handleDelete = (skill: TalentSkill) => {
    Alert.alert(
      'Supprimer la compétence',
      `Veux-tu vraiment supprimer "${skill.canonical_name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await skillService.deleteSkill(skill.id);
              await loadSkills();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la compétence');
            }
          },
        },
      ]
    );
  };

  const handleUpdateProficiency = async (skill: TalentSkill, newLevel: string) => {
    try {
      await skillService.updateSkill(skill.id, newLevel);
      await loadSkills();
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le niveau');
    }
  };

  const renderSkill = (skill: TalentSkill) => {
    const TypeIcon = getTypeIcon(skill.type);
    const profColor = PROFICIENCY_COLORS[skill.proficiency_level] || colors.textSecondary;

    return (
      <View
        key={skill.id}
        style={[styles.skillCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      >
        <View style={styles.skillHeader}>
          <View style={[styles.typeIconContainer, { backgroundColor: profColor + '15' }]}>
            <TypeIcon size={ICON.size.md} color={profColor} strokeWidth={ICON.strokeWidth} />
          </View>
          <View style={styles.skillInfo}>
            <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
              {skill.canonical_name}
            </Text>
            <Text style={[styles.skillType, { color: colors.textSecondary }]}>
              {SKILL_TYPE_LABELS[skill.type] || skill.type}
              {skill.domain ? ` · ${skill.domain}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.error + '10' }]}
            onPress={() => handleDelete(skill)}
          >
            <Trash2 size={16} color={colors.error} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>

        {/* Proficiency selector */}
        <View style={styles.proficiencyRow}>
          {PROFICIENCY_LEVELS.map((level) => {
            const isActive = skill.proficiency_level === level;
            const levelColor = PROFICIENCY_COLORS[level];
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.proficiencyChip,
                  {
                    backgroundColor: isActive ? levelColor + '20' : colors.gray100,
                    borderColor: isActive ? levelColor : 'transparent',
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleUpdateProficiency(skill, level)}
              >
                <Text
                  style={[
                    styles.proficiencyChipText,
                    { color: isActive ? levelColor : colors.textDisabled },
                  ]}
                >
                  {PROFICIENCY_LABELS[level]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Origin badge */}
        {skill.origin && skill.origin !== 'declared' && (
          <View style={[styles.originBadge, { backgroundColor: colors.gray100 }]}>
            <Text style={[styles.originText, { color: colors.textSecondary }]}>
              {skill.origin === 'inferred' ? 'Inférée par IA' : 'Extraite de document'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Group skills by type
  const groupedSkills = {
    HARD_SKILL: skills.filter((s) => s.type === 'HARD_SKILL'),
    KNOWLEDGE: skills.filter((s) => s.type === 'KNOWLEDGE'),
    SOFT_SKILL: skills.filter((s) => s.type === 'SOFT_SKILL'),
  };

  return (
    <>
      <PageLayout
        title="Mes compétences"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      >
        {skills.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Aucune compétence"
            subtitle="Ajoute tes compétences pour améliorer ton profil et être mieux recommandé."
            actionLabel="Ajouter une compétence"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <>
            {/* Stats */}
            <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{skills.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.gray200 }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: PROFICIENCY_COLORS.EXPERT }]}>
                    {skills.filter((s) => s.proficiency_level === 'EXPERT' || s.proficiency_level === 'MASTER').length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Expert+</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.gray200 }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {groupedSkills.HARD_SKILL.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Savoir-faire</Text>
                </View>
              </View>
            </View>

            {/* Add Button */}
            <View style={styles.addSection}>
              <Button
                title="Ajouter une compétence"
                onPress={() => setShowAddModal(true)}
                fullWidth
                icon={<Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                iconPosition="left"
              />
            </View>

            {/* Skills grouped by type */}
            {Object.entries(groupedSkills).map(([type, typeSkills]) => {
              if (typeSkills.length === 0) return null;
              return (
                <View key={type} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {SKILL_TYPE_LABELS[type] || type} ({typeSkills.length})
                  </Text>
                  {typeSkills.map(renderSkill)}
                </View>
              );
            })}
          </>
        )}
      </PageLayout>

      {/* Add Skill Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); setCustomSkillName(''); setSelectedType(''); }}>
              <X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ajouter une compétence</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Proficiency Selector */}
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Niveau</Text>
            <View style={styles.proficiencyRow}>
              {PROFICIENCY_LEVELS.map((level) => {
                const isActive = selectedProficiency === level;
                const levelColor = PROFICIENCY_COLORS[level];
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.proficiencyChip,
                      {
                        backgroundColor: isActive ? levelColor + '20' : colors.gray100,
                        borderColor: isActive ? levelColor : 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => setSelectedProficiency(level)}
                  >
                    <Text style={[styles.proficiencyChipText, { color: isActive ? levelColor : colors.textDisabled }]}>
                      {PROFICIENCY_LABELS[level]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Type Selector */}
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Type de compétence</Text>
            <View style={styles.proficiencyRow}>
              {Object.entries(SKILL_TYPE_LABELS).map(([key, label]) => {
                const isActive = selectedType === key;
                const TypeIcon = getTypeIcon(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.proficiencyChip,
                      {
                        backgroundColor: isActive ? colors.primary + '20' : colors.gray100,
                        borderColor: isActive ? colors.primary : 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => setSelectedType(isActive ? '' : key)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TypeIcon size={14} color={isActive ? colors.primary : colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.proficiencyChipText, { color: isActive ? colors.primary : colors.textDisabled }]}>
                        {label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Search */}
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>
              Rechercher une compétence
            </Text>
            <View style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              <Search size={18} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
              <TextInput
                style={[styles.searchTextInput, { color: colors.textPrimary }]}
                placeholder="Ex: React, Gestion de projet..."
                placeholderTextColor={colors.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <X size={18} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.searchResultsList} keyboardShouldPersistTaps="handled">
            {isSearching && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: SPACING.md }} />
            )}

            {searchResults.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={[styles.searchResultItem, { borderColor: colors.borderColor }]}
                onPress={() => handleAddFromSearch(result)}
              >
                <View>
                  <Text style={[styles.searchResultName, { color: colors.textPrimary }]}>
                    {result.canonical_name}
                  </Text>
                  <Text style={[styles.searchResultMeta, { color: colors.textSecondary }]}>
                    {SKILL_TYPE_LABELS[result.type] || result.type}
                    {result.domain ? ` · ${result.domain}` : ''}
                  </Text>
                </View>
                <Plus size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            ))}

            {/* Custom skill input */}
            {searchQuery.length >= 2 && !isSearching && (
              <View style={styles.customSkillSection}>
                <Text style={[styles.customSkillLabel, { color: colors.textSecondary }]}>
                  Compétence introuvable ? Ajoute-la manuellement :
                </Text>
                {!selectedType && (
                  <Text style={[styles.customSkillLabel, { color: colors.warning, marginBottom: SPACING.xs }]}>
                    Sélectionne un type de compétence ci-dessus
                  </Text>
                )}
                <View style={styles.customSkillRow}>
                  <TextInput
                    style={[styles.customSkillInput, { backgroundColor: colors.surface, borderColor: colors.borderColor, color: colors.textPrimary }]}
                    placeholder="Nom de la compétence"
                    placeholderTextColor={colors.textDisabled}
                    value={customSkillName || searchQuery}
                    onChangeText={setCustomSkillName}
                  />
                  <TouchableOpacity
                    style={[styles.customSkillButton, { backgroundColor: selectedType ? colors.primary : colors.gray300, opacity: selectedType ? 1 : 0.5 }]}
                    onPress={handleAddCustom}
                    disabled={!selectedType}
                  >
                    <Plus size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold },
  statLabel: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  statDivider: { width: 1, height: 30 },

  addSection: { marginBottom: SPACING.lg },

  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  // Skill Card
  skillCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },
  skillHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillInfo: { flex: 1, marginLeft: SPACING.sm },
  skillName: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  skillType: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER.radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },

  proficiencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  proficiencyChip: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  proficiencyChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  originBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
    marginTop: SPACING.xs,
  },
  originText: { fontSize: TYPOGRAPHY.fontSize.xs },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  modalSection: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  modalSectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.sm,
    height: 44,
    gap: SPACING.xs,
  },
  searchTextInput: { flex: 1, fontSize: TYPOGRAPHY.fontSize.md },

  searchResultsList: { flex: 1, paddingHorizontal: SPACING.lg },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  searchResultName: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  searchResultMeta: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },

  customSkillSection: { marginTop: SPACING.lg },
  customSkillLabel: { fontSize: TYPOGRAPHY.fontSize.sm, marginBottom: SPACING.xs },
  customSkillRow: { flexDirection: 'row', gap: SPACING.sm },
  customSkillInput: {
    flex: 1,
    height: 44,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  customSkillButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
