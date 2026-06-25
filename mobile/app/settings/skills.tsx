/**
 * Skills Screen
 * Talent skills management — catalog-constrained (digital skills referential).
 * Add via catalog autocomplete; each skill TYPE has its own icon (shared config).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Trash2, X, Gem, ChevronDown, Eye, EyeOff, Radar, Search } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, ThemeColors, COMPONENT, LAYOUT } from '../../src/constants/theme';
import { Button, Chip, EmptyState, IconButton, Input, FooterNav, LoadingShimmer } from '../../src/components/ui';
import { useTheme } from '../../src/hooks/useTheme';
import skillService, { TalentSkill, CatalogCompetency } from '../../src/services/skillService';
import {
  CATALOG_TYPES,
  LEVELS,
  getSkillTypeConfig,
  getLevelConfig,
  getOriginConfig,
  getDecayConfig,
  skillDisplayName,
  normalizeType,
  type Level,
} from '../../src/constants/skills';
import { SkillLevelSteps } from '../../src/components/SkillLevelSteps';
import { useAlert } from '../../src/contexts/AlertContext';
import { useI18n } from '../../src/contexts/I18nContext';

export default function SkillsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const alerts = useAlert();

  const formatRelativeDate = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    const diffW = Math.floor(diffD / 7);
    const diffM = Math.floor(diffD / 30);
    if (diffMin < 1) return t('date.justNow');
    if (diffMin < 60) return t('date.minutesAgo', { minutes: diffMin });
    if (diffH < 24) return t('date.hoursAgo', { hours: diffH });
    if (diffD < 7) return t('date.daysAgo', { days: diffD });
    if (diffW < 5) return t('settings.skills.timeAgo.weeks', { count: diffW });
    if (diffM < 12) return t('settings.skills.timeAgo.months', { count: diffM });
    const years = Math.floor(diffD / 365);
    return t('settings.skills.timeAgo.years', { count: years });
  };

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [skills, setSkills] = useState<TalentSkill[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Add skill modal — catalog autocomplete
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogCompetency[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CatalogCompetency | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level>('intermediate');
  const [skillContext, setSkillContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      const data = await skillService.getMySkills();
      setSkills(data);
    } catch (error) {
      if (__DEV__) console.error('Error loading skills:', error);
      void alerts.alert(t('common.error'), t('settings.skills.loadError'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadSkills();
      setIsLoading(false);
    };
    load();
  }, [loadSkills]);

  // Debounced catalog search
  useEffect(() => {
    if (selected && query === skillDisplayName(selected, language)) return; // already chosen
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await skillService.searchCatalog(q);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, selected, language]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSkills();
    setIsRefreshing(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setQuery('');
    setResults([]);
    setSelected(null);
    setSelectedLevel('intermediate');
    setSkillContext('');
  };

  const handlePickCatalog = (c: CatalogCompetency) => {
    setSelected(c);
    setQuery(skillDisplayName(c, language));
    setResults([]);
  };

  const handleAddSkill = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await skillService.addSkill({
        skillOrLabel: selected.slug,
        level: selectedLevel,
        ...(skillContext.trim() ? { context: skillContext.trim() } : {}),
      });
      closeModal();
      await loadSkills();
    } catch (error: any) {
      const suggestions = error?.data?.suggestions || error?.response?.data?.suggestions;
      const msg = suggestions?.length
        ? t('settings.skills.notInCatalogSuggestions', { names: suggestions.map((s: any) => s.name_fr || s.name).join(', ') })
        : error?.message || t('settings.skills.addError');
      void alerts.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (skill: TalentSkill) => {
    void alerts.showAlert({
      title: t('settings.skills.deleteTitle'),
      message: t('settings.skills.deleteConfirm', { name: skillDisplayName(skill, language) }),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await skillService.deleteSkill(skill.id);
              await loadSkills();
            } catch {
              void alerts.alert(t('common.error'), t('settings.skills.deleteError'));
            }
          },
        },
      ],
    });
  };

  const handleToggleVisibility = async (skill: TalentSkill) => {
    try {
      await skillService.toggleVisibility(skill.id, !skill.is_visible);
      await loadSkills();
    } catch {
      void alerts.alert(t('common.error'), t('settings.skills.visibilityError'));
    }
  };

  const renderSkill = (skill: TalentSkill) => {
    const originCfg = getOriginConfig(skill.origin, colors);
    const decayCfg = getDecayConfig(skill.decay_state, colors);
    const typeCfg = getSkillTypeConfig(skill.type, colors);
    const OriginIcon = originCfg.Icon;
    const contextText = Array.isArray(skill.context) ? skill.context.join(' · ') : skill.context || '';
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
        <View style={styles.cardActions}>
          <IconButton
            onPress={() => handleToggleVisibility(skill)}
            icon={<VisibilityIcon size={18} color={skill.is_visible ? colors.textSecondary : colors.warning} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={skill.is_visible ? t('settings.skills.hideSkill') : t('settings.skills.showSkill')}
            size="sm"
            variant="ghost"
            style={styles.actionButton}
          />
          <IconButton
            onPress={() => handleDelete(skill)}
            icon={<Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('settings.skills.deleteTitle')}
            size="sm"
            variant="ghost"
            style={styles.actionButton}
          />
        </View>

        {/* Skill name with type icon */}
        <View style={styles.skillNameRow}>
          <typeCfg.Icon size={16} color={typeCfg.color} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
            {skillDisplayName(skill, language)}
          </Text>
        </View>

        {/* Level: 4-step loader (beginner -> master) with label */}
        <View style={styles.levelRow}>
          <SkillLevelSteps level={skill.level} type={skill.type} size="md" showLabel />
        </View>

        {/* Tags row: origin (+ decay) */}
        <View style={styles.tagsRow}>
          <View style={[styles.tag, styles.originTag, { backgroundColor: withOpacity(originCfg.color, OPACITY[15]), borderColor: withOpacity(originCfg.color, OPACITY[30]) }]}>
            <OriginIcon size={11} color={originCfg.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.tagText, { color: originCfg.color }]}>{t(originCfg.labelKey)}</Text>
          </View>
          {decayCfg.show && (
            <View style={[styles.tag, { backgroundColor: withOpacity(decayCfg.color, OPACITY[15]), borderColor: decayCfg.color }]}>
              <Text style={[styles.tagText, { color: decayCfg.color }]}>{t(decayCfg.labelKey)}</Text>
            </View>
          )}
          {relativeDate && <Text style={[styles.dateText, { color: colors.textDisabled }]}>{relativeDate}</Text>}
        </View>

        {contextText ? (
          <Text style={[styles.contextText, { color: colors.textSecondary }]} numberOfLines={2}>
            {contextText}
          </Text>
        ) : null}
      </View>
    );
  };

  const sortByScore = (a: TalentSkill, b: TalentSkill) => (b.score || 0) - (a.score || 0);

  const handleAutoDiagnostic = () => {
    router.push({
      pathname: '/(tabs)/assistant',
      params: { mode: 'study', prompt: t('settings.skills.autoDiagnosticPrompt'), focusInput: 'true' },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.skills.title')}</Text>
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {skills.length === 0 ? (
            <EmptyState
              icon={Gem}
              title={t('settings.skills.emptyTitle')}
              subtitle={t('settings.skills.emptySubtitle')}
              actionLabel={t('settings.skills.addSkill')}
              onAction={() => setShowAddModal(true)}
              tip={
                <Text style={{ fontSize: TYPOGRAPHY.fontSize.xs, lineHeight: TYPOGRAPHY.fontSize.xs * 1.5, color: colors.textSecondary }}>
                  {t('settings.skills.tipPrefix')}{' '}
                  <Text
                    style={{ fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: colors.primary }}
                    onPress={() => router.push('/settings/documents')}
                  >
                    {t('settings.skills.tipDocumentsLink')}
                  </Text>
                  {' '}{t('settings.skills.tipSuffix')}
                </Text>
              }
            />
          ) : (
            <>
              <View style={styles.addSection}>
                <Button
                  title={t('settings.skills.addSkill')}
                  onPress={() => setShowAddModal(true)}
                  fullWidth
                  icon={<Plus size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                  iconPosition="left"
                />
              </View>

              {CATALOG_TYPES.map((type) => {
                const typeSkills = skills.filter((s) => normalizeType(s.type) === type).sort(sortByScore);
                const isEmpty = typeSkills.length === 0;
                const typeCfg = getSkillTypeConfig(type, colors);
                // Empty type sections default to collapsed so the 5 categories stay visible without clutter.
                const isCollapsed = collapsedSections[type] ?? isEmpty;
                return (
                  <View key={type} style={styles.section}>
                    <Pressable
                      style={styles.sectionHeader}
                      onPress={() => setCollapsedSections((prev) => ({ ...prev, [type]: !(prev[type] ?? isEmpty) }))}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.skills.toggleSection', { section: t(typeCfg.labelKey) })}
                    >
                      <typeCfg.Icon size={14} color={isEmpty ? colors.textDisabled : typeCfg.color} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.sectionTitle, { color: isEmpty ? colors.textDisabled : colors.textSecondary, flex: 1 }]}>
                        {t(typeCfg.labelKey)} ({typeSkills.length})
                      </Text>
                      <ChevronDown
                        size={16}
                        color={colors.textDisabled}
                        strokeWidth={ICON.strokeWidth}
                        style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
                      />
                    </Pressable>
                    {!isCollapsed && (isEmpty
                      ? <Text style={[styles.emptyType, { color: colors.textDisabled }]}>{t('settings.skills.emptyType')}</Text>
                      : typeSkills.map(renderSkill))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {skills.length > 0 && (
        <View style={[styles.diagnosticContainer, { backgroundColor: colors.background }]}>
          <Button
            title={t('settings.skills.autoDiagnostic')}
            onPress={handleAutoDiagnostic}
            fullWidth
            icon={<Radar size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            iconPosition="left"
            style={[styles.diagnosticButton, { backgroundColor: colors.primary }]}
            textStyle={styles.diagnosticButtonText}
          />
        </View>
      )}

      <FooterNav activeTab="home" />

      {/* Add Skill Modal — catalog autocomplete */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <IconButton
              onPress={closeModal}
              icon={<X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
              accessibilityLabel={t('common.close')}
              size="sm"
              variant="ghost"
            />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('settings.skills.modalTitle')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Catalog search */}
            <View style={styles.modalSection}>
              <Input
                label={t('settings.skills.skillName')}
                placeholder={t('settings.skills.catalogSearchPlaceholder')}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (selected) setSelected(null);
                }}
                autoFocus
                leftIcon={<Search size={ICON.size.sm} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />}
                rightIcon={searching ? <ActivityIndicator size="small" color={colors.textDisabled} /> : undefined}
              />

              {/* Results dropdown */}
              {results.length > 0 && !selected && (
                <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                  {results.map((c) => {
                    const cfg = getSkillTypeConfig(c.type, colors);
                    return (
                      <Pressable
                        key={c.slug}
                        style={[styles.resultRow, { borderBottomColor: colors.borderColor }]}
                        onPress={() => handlePickCatalog(c)}
                      >
                        <cfg.Icon size={16} color={cfg.color} strokeWidth={ICON.strokeWidth} />
                        <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {skillDisplayName(c, language)}
                        </Text>
                        <Text style={[styles.resultType, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {query.trim().length >= 2 && !searching && results.length === 0 && !selected && (
                <Text style={[styles.noResults, { color: colors.textDisabled }]}>
                  {t('settings.skills.noCatalogMatch')}
                </Text>
              )}

              {selected && (
                <View style={[styles.selectedHint, { backgroundColor: withOpacity(getSkillTypeConfig(selected.type, colors).color, OPACITY[15]) }]}>
                  <Text style={[styles.selectedHintText, { color: colors.textSecondary }]}>
                    {t('settings.skills.selectedCatalog', { type: t(getSkillTypeConfig(selected.type, colors).labelKey) })}
                  </Text>
                </View>
              )}
            </View>

            {/* Level Selector */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>{t('settings.skills.proficiency')}</Text>
              <View style={styles.chipRow}>
                {LEVELS.map((level) => {
                  const isActive = selectedLevel === level;
                  const cfg = getLevelConfig(level, colors);
                  return (
                    <Chip
                      key={level}
                      onPress={() => setSelectedLevel(level)}
                      label={t(cfg.labelKey)}
                      selected={isActive}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? withOpacity(cfg.color, OPACITY[20]) : colors.gray100,
                          borderColor: isActive ? cfg.color : 'transparent',
                        },
                      ]}
                      textStyle={[styles.chipText, { color: isActive ? cfg.color : colors.textDisabled }]}
                    />
                  );
                })}
              </View>
            </View>

            {/* Context field */}
            <View style={styles.modalSection}>
              <Input
                label={t('settings.skills.context')}
                placeholder={t('settings.skills.contextPlaceholder')}
                value={skillContext}
                onChangeText={(text) => setSkillContext(text.slice(0, 200))}
                multiline
                numberOfLines={3}
              />
              <Text style={[styles.charCounter, { color: colors.textDisabled }]}>{skillContext.length}/200</Text>
            </View>

            <View style={styles.modalSection}>
              <Button title={t('common.add')} onPress={handleAddSkill} fullWidth disabled={!selected || submitting} loading={submitting} />
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
  headerTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: LAYOUT.inputHeightSm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },

  addSection: { marginBottom: SPACING.lg },

  section: { marginBottom: SPACING.lg },
  emptyType: { fontSize: TYPOGRAPHY.fontSize.sm, fontStyle: 'italic', paddingVertical: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },

  skillCard: { padding: SPACING.md, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.md, marginBottom: SPACING.sm },
  skillNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingRight: 72 },
  skillName: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.medium, flexShrink: 1 },

  levelRow: { marginTop: SPACING.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  tag: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
    borderWidth: BORDER.width.thin,
  },
  originTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },

  contextText: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: SPACING.xs, lineHeight: 16 },
  dateText: { fontSize: TYPOGRAPHY.fontSize.xs, marginLeft: 'auto' as any },

  cardActions: { position: 'absolute', top: SPACING.xs, right: SPACING.xs, flexDirection: 'row', gap: 0, zIndex: 1 },
  actionButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Catalog search results
  results: { marginTop: SPACING.xs, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.md, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: BORDER.width.thin },
  resultName: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  resultType: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  noResults: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: SPACING.sm, fontStyle: 'italic' },
  selectedHint: { marginTop: SPACING.sm, padding: SPACING.sm, borderRadius: BORDER.radius.sm },
  selectedHintText: { fontSize: TYPOGRAPHY.fontSize.xs },

  // Chips (modal)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
    borderWidth: BORDER.width.thin,
  },
  chipText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },

  charCounter: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'right', marginTop: 4 },

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
  modalSectionLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },

  diagnosticContainer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.xs },
  diagnosticButton: { borderRadius: BORDER.radius.md },
  diagnosticButtonText: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold },
});
