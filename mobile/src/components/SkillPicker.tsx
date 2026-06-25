/**
 * SkillPicker — catalog-constrained skill selector for entity create/edit forms
 * (opportunities, communities, spaces). Searches the referential via
 * /api/skills/catalog/search and lets the user attach catalog competencies.
 * Each chip shows the per-type icon; for opportunities a tap toggles
 * required <-> nice_to_have. Non-catalog input is impossible by design.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, COMPONENT, withOpacity, OPACITY } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../contexts/I18nContext';
import { Input } from './ui';
import { getSkillTypeConfig, skillDisplayName } from '../constants/skills';
import skillService, { type EntitySkillTag, type CatalogCompetency } from '../services/skillService';

interface Props {
  value: EntitySkillTag[];
  onChange: (next: EntitySkillTag[]) => void;
  /** Opportunities: show & toggle required / nice_to_have. */
  withRequirement?: boolean;
  label?: string;
  max?: number;
}

export function SkillPicker({ value, onChange, withRequirement = false, label, max = 20 }: Props) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogCompetency[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await skillService.searchCatalog(q);
        const chosen = new Set(value.map((v) => v.slug));
        setResults(res.filter((r) => !chosen.has(r.slug)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, value]);

  const add = (c: CatalogCompetency) => {
    if (value.length >= max) return;
    const tag: EntitySkillTag = {
      slug: c.slug,
      name: c.name,
      name_fr: c.name_fr,
      type: c.type,
      family: c.family,
      ...(withRequirement ? { requirement: 'required' as const } : { role: 'validates' as const }),
    };
    onChange([...value, tag]);
    setQuery('');
    setResults([]);
  };

  const remove = (slug: string) => onChange(value.filter((v) => v.slug !== slug));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}

      <Input
        placeholder={t('settings.skills.catalogSearchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        leftIcon={<Search size={18} color={colors.textDisabled} strokeWidth={2} />}
        rightIcon={searching ? <ActivityIndicator size="small" color={colors.textDisabled} /> : undefined}
      />

      {results.length > 0 && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {results.map((c) => {
            const cfg = getSkillTypeConfig(c.type, colors);
            return (
              <Pressable key={c.slug} style={[styles.resultRow, { borderBottomColor: colors.borderColor }]} onPress={() => add(c)}>
                <cfg.Icon size={16} color={cfg.color} strokeWidth={2} />
                <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {skillDisplayName(c, language)}
                </Text>
                <Text style={[styles.resultType, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {value.length > 0 && (
        <View style={styles.chips}>
          {value.map((s) => {
            const cfg = getSkillTypeConfig(s.type, colors);
            return (
              <View key={s.slug} style={[styles.chip, { backgroundColor: withOpacity(cfg.color, OPACITY[15]), borderColor: withOpacity(cfg.color, OPACITY[40]) }]}>
                <cfg.Icon size={13} color={cfg.color} strokeWidth={2} />
                <Text style={[styles.chipText, { color: cfg.color }]} numberOfLines={1}>{skillDisplayName(s, language)}</Text>
                <Pressable onPress={() => remove(s.slug)} hitSlop={6}>
                  <X size={13} color={cfg.color} strokeWidth={2.5} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default SkillPicker;

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium, marginBottom: SPACING.xs },
  results: { marginTop: SPACING.xs, borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.md, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: BORDER.width.thin },
  resultName: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  resultType: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
    borderWidth: BORDER.width.thin,
  },
  chipText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium, maxWidth: 140 },
  req: { fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.bold, textTransform: 'uppercase' },
  hint: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: SPACING.xs, fontStyle: 'italic' },
});
