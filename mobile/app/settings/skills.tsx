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
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Plus,
  Trash2,
  X,
  BookOpen,
  Cog,
  Gem,
  Users,
  ChevronDown,
  Eye,
  EyeOff,
  Radar,
} from 'lucide-react-native';
	import { RefreshControl } from 'react-native';
	import { ArrowLeft } from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, ThemeColors, COMPONENT, LAYOUT } from '../../src/constants/theme';
	import { Button, Chip, EmptyState, IconButton, Input, FooterNav, LoadingShimmer } from '../../src/components/ui';
	import { useTheme } from '../../src/hooks/useTheme';
	import skillService, {
	  TalentSkill,
	  PROFICIENCY_LABELS,
	  SKILL_TYPE_LABELS,
  PROFICIENCY_LEVELS,
} from '../../src/services/skillService';
import { useAlert } from '../../src/contexts/AlertContext';

// Proficiency colors - Luxe Africain design system
const getProficiencyColors = (colors: ThemeColors): Record<string, string> => ({
  BEGINNER: colors.gray500,      // Neutral
  INTERMEDIATE: colors.info,     // Warm taupe
  EXPERT: colors.warning,        // Warm amber
  MASTER: colors.success,        // Forest green
});

const ORIGIN_LABELS: Record<string, string> = {
  declared: 'Déclarée',
  extracted: 'Extraite',
  inferred: 'Inférée',
};

function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffM = Math.floor(diffD / 30);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  if (diffW < 5) return `Il y a ${diffW} sem.`;
  if (diffM < 12) return `Il y a ${diffM} mois`;
  return `Il y a ${Math.floor(diffD / 365)} an${Math.floor(diffD / 365) > 1 ? 's' : ''}`;
}


function getTypeIcon(type: string) {
  switch (type) {
    case 'KNOWLEDGE':
      return BookOpen;
    case 'HARD_SKILL':
      return Cog;
    case 'SOFT_SKILL':
      return Users;
    default:
      return Gem;
  }
}

export default function SkillsScreen() {
  const router = useRouter();
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});


  const loadSkills = useCallback(async () => {
    try {
      const data = await skillService.getMySkills();
      setSkills(data);
    } catch (error) {
      console.error('Error loading skills:', error);
      void alerts.alert('Erreur', 'Impossible de charger les compétences');
    }
  }, []);
  const alerts = useAlert();

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
      void alerts.alert('Type requis', 'Sélectionne un type de compétence.');
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
      void alerts.alert('Erreur', error?.message || "Erreur lors de l'ajout");
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
    void alerts.showAlert({ title: 'Supprimer la compétence', message: `Veux-tu vraiment supprimer "${skill.canonical_name}" ?`, buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await skillService.deleteSkill(skill.id);
              await loadSkills();
            } catch {
              void alerts.alert('Erreur', 'Impossible de supprimer la compétence');
            }
          },
        },
      ] });
  };

  const proficiencyColors = getProficiencyColors(colors);

  const handleToggleVisibility = async (skill: TalentSkill) => {
    try {
      await skillService.toggleVisibility(skill.id, !skill.is_visible);
      await loadSkills();
    } catch {
      void alerts.alert('Erreur', 'Impossible de modifier la visibilité');
    }
  };

  const renderSkill = (skill: TalentSkill) => {
    const profColor = proficiencyColors[skill.proficiency_level] || colors.textSecondary;
    const originLabel = ORIGIN_LABELS[skill.origin] || skill.origin;
    const contextText = skill.context;
    const relativeDate = formatRelativeDate(skill.created_at);
    const VisibilityIcon = skill.is_visible ? Eye : EyeOff;

    return (
      <View
        key={skill.id}
        style={[
          styles.skillCard,
          { backgroundColor: colors.surface, borderColor: colors.borderColor },
          !skill.is_visible && { opacity: 0.5 },
        ]}
      >
	        {/* Action buttons */}
	        <View style={styles.cardActions}>
	          <IconButton
	            onPress={() => handleToggleVisibility(skill)}
	            icon={<VisibilityIcon size={18} color={skill.is_visible ? colors.textSecondary : colors.warning} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel={skill.is_visible ? 'Masquer la compétence' : 'Afficher la compétence'}
	            size="sm"
	            variant="ghost"
	            style={styles.actionButton}
	          />
	          <IconButton
	            onPress={() => handleDelete(skill)}
	            icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel="Supprimer la compétence"
	            size="sm"
	            variant="ghost"
	            style={styles.actionButton}
	          />
	        </View>

        {/* Skill name */}
        <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
          {skill.canonical_name}
        </Text>

        {/* Tags row: proficiency + origin */}
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: withOpacity(profColor, OPACITY[20]), borderColor: profColor }]}>
            <Text style={[styles.tagText, { color: profColor }]}>
              {PROFICIENCY_LABELS[skill.proficiency_level]}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: withOpacity(colors.textSecondary, OPACITY[15]), borderColor: withOpacity(colors.textSecondary, OPACITY[30]) }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>
              {originLabel}
            </Text>
          </View>
          {relativeDate && (
            <Text style={[styles.dateText, { color: colors.textDisabled }]}>
              {relativeDate}
            </Text>
          )}
        </View>

        {/* Context */}
        {contextText ? (
          <Text style={[styles.contextText, { color: colors.textSecondary }]} numberOfLines={2}>
            {contextText}
          </Text>
        ) : null}
      </View>
    );
  };

  // Group skills by type
  const sortByRecent = (a: TalentSkill, b: TalentSkill) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

  const groupedSkills = {
    HARD_SKILL: skills.filter((s) => s.type === 'HARD_SKILL').sort(sortByRecent),
    KNOWLEDGE: skills.filter((s) => s.type === 'KNOWLEDGE').sort(sortByRecent),
    SOFT_SKILL: skills.filter((s) => s.type === 'SOFT_SKILL').sort(sortByRecent),
  };

  const handleAutoDiagnostic = () => {
    router.push({
      pathname: '/(tabs)/assistant',
      params: {
        mode: 'study',
        prompt: 'Fais un auto-diagnostic complet de mes compétences. Analyse mes forces, identifie mes lacunes et axes d\'amélioration, et suggère un plan de développement adapté à mon profil.',
        focusInput: 'true',
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mes compétences</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {skills.length === 0 ? (
            <EmptyState
              icon={Gem}
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
	                const isCollapsed = collapsedSections[type] ?? false;
	                return (
	                  <View key={type} style={styles.section}>
	                    <Pressable
	                      style={styles.sectionHeader}
	                      onPress={() => setCollapsedSections((prev) => ({ ...prev, [type]: !prev[type] }))}
	                      accessibilityRole="button"
	                      accessibilityLabel={`Basculer section ${SKILL_TYPE_LABELS[type] || type}`}
	                    >
	                      <TypeIcon size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
	                      <Text style={[styles.sectionTitle, { color: colors.textSecondary, flex: 1 }]}>
	                        {SKILL_TYPE_LABELS[type] || type} ({typeSkills.length})
	                      </Text>
                      <ChevronDown
                        size={16}
                        color={colors.textSecondary}
                        strokeWidth={ICON.strokeWidth}
	                        style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
	                      />
	                    </Pressable>
	                    {!isCollapsed && typeSkills.map(renderSkill)}
	                  </View>
	                );
	              })}
            </>
          )}
        </ScrollView>
      )}

	      {/* Auto-diagnostic Button */}
	      <View style={[styles.diagnosticContainer, { backgroundColor: colors.background }]}>
	        <Button
	          title="Auto-diagnostic"
	          onPress={handleAutoDiagnostic}
	          fullWidth
	          icon={<Radar size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
	          iconPosition="left"
	          style={[styles.diagnosticButton, { backgroundColor: colors.primary }]}
	          textStyle={styles.diagnosticButtonText}
	        />
	      </View>

      <FooterNav activeTab="home" />

	      {/* Add Skill Modal */}
	      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
	        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	          {/* Modal Header */}
	          <View style={styles.modalHeader}>
	            <IconButton
	              onPress={closeModal}
	              icon={<X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	              accessibilityLabel="Fermer"
	              size="sm"
	              variant="ghost"
	            />
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
	                    <Chip
	                      key={key}
	                      onPress={() => setSelectedType(key)}
	                      label={label}
	                      selected={isActive}
	                      leftIcon={<TypeIcon size={14} color={isActive ? colors.primary : colors.textDisabled} strokeWidth={ICON.strokeWidth} />}
	                      style={[
	                        styles.chip,
	                        {
	                          backgroundColor: isActive ? withOpacity(colors.primary, OPACITY[20]) : colors.gray100,
	                          borderColor: isActive ? colors.primary : 'transparent',
	                        },
	                      ]}
	                      textStyle={[styles.chipText, { color: isActive ? colors.primary : colors.textDisabled }]}
	                    />
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
	                  const levelColor = proficiencyColors[level];
	                  return (
	                    <Chip
	                      key={level}
	                      onPress={() => setSelectedProficiency(level)}
	                      label={PROFICIENCY_LABELS[level]}
	                      selected={isActive}
	                      style={[
	                        styles.chip,
	                        {
	                          backgroundColor: isActive ? withOpacity(levelColor, OPACITY[20]) : colors.gray100,
	                          borderColor: isActive ? levelColor : 'transparent',
	                        },
	                      ]}
	                      textStyle={[styles.chipText, { color: isActive ? levelColor : colors.textDisabled }]}
	                    />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: { width: LAYOUT.inputHeightSm, height: LAYOUT.inputHeightSm, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: LAYOUT.inputHeightSm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },

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
  skillName: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium, paddingRight: SPACING.xl },
  skillType: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  tag: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
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
  dateText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: 'auto' as any,
  },

  cardActions: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    gap: 0,
    zIndex: 1,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips (modal)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
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

  // Auto-diagnostic (fixed bottom)
  diagnosticContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  diagnosticButton: {
    borderRadius: BORDER.radius.md,
  },
  diagnosticButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
