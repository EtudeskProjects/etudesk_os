/**
 * Skills Screen
 * Talent skills management - listing, adding, updating, and deleting
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import {
  Plus,
  Trash2,
  X,
  BookOpen,
  Wrench,
  Heart,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { Button, PageLayout, EmptyState, Input } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import skillService, {
  TalentSkill,
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

const ORIGIN_LABELS: Record<string, string> = {
  declared: 'Déclarée',
  extracted: 'Extraite',
  inferred: 'Inférée',
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
  const [selectedProficiency, setSelectedProficiency] = useState<string>('INTERMEDIATE');
  const [selectedType, setSelectedType] = useState<string>('');
  const [skillName, setSkillName] = useState('');
  const [skillContext, setSkillContext] = useState('');

  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

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

  const handleAddSkill = async () => {
    if (!skillName.trim()) return;
    if (!selectedType) {
      Alert.alert('Type requis', 'Sélectionne un type de compétence.');
      return;
    }
    try {
      await skillService.addSkill({
        skillName: skillName.trim(),
        proficiencyLevel: selectedProficiency,
        type: selectedType,
        ...(skillContext.trim() ? { context: skillContext.trim() } : {}),
      });
      closeModal();
      await loadSkills();
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || "Erreur lors de l'ajout");
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setSkillName('');
    setSelectedType('');
    setSelectedProficiency('INTERMEDIATE');
    setSkillContext('');
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

  const renderRightActions = (skill: TalentSkill) => {
    return (
      <TouchableOpacity
        style={[styles.deleteSwipeAction, { backgroundColor: colors.error }]}
        onPress={() => {
          swipeableRefs.current[skill.id]?.close();
          handleDelete(skill);
        }}
      >
        <Trash2 size={20} color="#fff" strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>
    );
  };

  const renderSkill = (skill: TalentSkill) => {
    const profColor = PROFICIENCY_COLORS[skill.proficiency_level] || colors.textSecondary;
    const originLabel = ORIGIN_LABELS[skill.origin] || skill.origin;
    const contextText = skill.context || skill.extraction_context;

    return (
      <Swipeable
        key={skill.id}
        ref={(ref) => { swipeableRefs.current[skill.id] = ref; }}
        renderRightActions={() => renderRightActions(skill)}
        overshootRight={false}
      >
        <View
          style={[styles.skillCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        >
          {/* Skill name */}
          <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
            {skill.canonical_name}
          </Text>

          {/* Type · Domain */}
          <Text style={[styles.skillType, { color: colors.textSecondary }]}>
            {SKILL_TYPE_LABELS[skill.type] || skill.type}
            {skill.domain ? ` · ${skill.domain}` : ''}
          </Text>

          {/* Tags row: proficiency + origin */}
          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: profColor + '20', borderColor: profColor }]}>
              <Text style={[styles.tagText, { color: profColor }]}>
                {PROFICIENCY_LABELS[skill.proficiency_level]}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                {originLabel}
              </Text>
            </View>
          </View>

          {/* Context */}
          {contextText ? (
            <Text style={[styles.contextText, { color: colors.textSecondary }]} numberOfLines={2}>
              {contextText}
            </Text>
          ) : null}
        </View>
      </Swipeable>
    );
  };

  // Group skills by type
  const groupedSkills = {
    HARD_SKILL: skills.filter((s) => s.type === 'HARD_SKILL'),
    KNOWLEDGE: skills.filter((s) => s.type === 'KNOWLEDGE'),
    SOFT_SKILL: skills.filter((s) => s.type === 'SOFT_SKILL'),
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              const TypeIcon = getTypeIcon(type);
              return (
                <View key={type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <TypeIcon size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      {SKILL_TYPE_LABELS[type] || type} ({typeSkills.length})
                    </Text>
                  </View>
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
            <TouchableOpacity onPress={closeModal}>
              <X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ajouter une compétence</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Skill Name */}
            <View style={styles.modalSection}>
              <Input
                label="Nom de la compétence"
                placeholder="Ex: React, Gestion de projet, Communication..."
                value={skillName}
                onChangeText={setSkillName}
                autoFocus
              />
            </View>

            {/* Type Selector */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Type de compétence *</Text>
              <View style={styles.chipRow}>
                {Object.entries(SKILL_TYPE_LABELS).map(([key, label]) => {
                  const isActive = selectedType === key;
                  const TypeIcon = getTypeIcon(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? colors.primary + '20' : colors.gray100,
                          borderColor: isActive ? colors.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedType(key)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TypeIcon size={14} color={isActive ? colors.primary : colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.chipText, { color: isActive ? colors.primary : colors.textDisabled }]}>
                          {label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Proficiency Selector */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Niveau</Text>
              <View style={styles.chipRow}>
                {PROFICIENCY_LEVELS.map((level) => {
                  const isActive = selectedProficiency === level;
                  const levelColor = PROFICIENCY_COLORS[level];
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? levelColor + '20' : colors.gray100,
                          borderColor: isActive ? levelColor : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedProficiency(level)}
                    >
                      <Text style={[styles.chipText, { color: isActive ? levelColor : colors.textDisabled }]}>
                        {PROFICIENCY_LABELS[level]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Context field */}
            <View style={styles.modalSection}>
              <Input
                label="Contexte"
                placeholder="Comment et quand avez-vous acquis cette compétence ?"
                value={skillContext}
                onChangeText={(text) => setSkillContext(text.slice(0, 200))}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm }}
              />
              <Text style={[styles.charCounter, { color: colors.textDisabled }]}>
                {skillContext.length}/200
              </Text>
            </View>

            {/* Add Button */}
            <View style={styles.modalSection}>
              <Button
                title="Ajouter"
                onPress={handleAddSkill}
                fullWidth
                disabled={!skillName.trim() || !selectedType}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  addSection: { marginBottom: SPACING.lg },

  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Skill Card
  skillCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },
  skillName: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium },
  skillType: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  tag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.full,
    borderWidth: BORDER.width.thin,
  },
  tagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  contextText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
    lineHeight: 16,
  },

  // Swipe delete
  deleteSwipeAction: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },

  // Chips (modal)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
    borderWidth: BORDER.width.thin,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  charCounter: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
    marginTop: 4,
  },

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
  modalContent: { flex: 1, paddingHorizontal: SPACING.lg },
  modalSection: { marginBottom: SPACING.lg },
  modalSectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
});
