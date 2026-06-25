/**
 * EntitySkillTags — renders an entity's catalog skill tags (opportunity /
 * community / space) as chips, each with its TYPE-specific icon and color, plus
 * a requirement (required / nice_to_have) or role badge.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER, COMPONENT, withOpacity, OPACITY } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../contexts/I18nContext';
import { getSkillTypeConfig, getRequirementConfig, skillDisplayName } from '../constants/skills';
import type { EntitySkillTag } from '../services/skillService';

interface Props {
  skills?: EntitySkillTag[] | null;
  /** Section title (defaults to a generic "Skills" label). */
  title?: string;
  /** Show the required/nice_to_have badge (opportunities). */
  showRequirement?: boolean;
}

export function EntitySkillTags({ skills, title, showRequirement = true }: Props) {
  const { colors } = useTheme();
  const { t, language } = useI18n();

  if (!skills || skills.length === 0) return null;

  // Required skills first, then nice_to_have / others.
  const ordered = [...skills].sort((a, b) => {
    const ra = a.requirement === 'nice_to_have' ? 1 : 0;
    const rb = b.requirement === 'nice_to_have' ? 1 : 0;
    return ra - rb;
  });

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title || t('labels.skillsSection')}
      </Text>
      <View style={styles.chips}>
        {ordered.map((s) => {
          const typeCfg = getSkillTypeConfig(s.type, colors);
          const Icon = typeCfg.Icon;
          const isNice = s.requirement === 'nice_to_have';
          return (
            <View
              key={s.slug}
              style={[
                styles.chip,
                {
                  backgroundColor: withOpacity(typeCfg.color, OPACITY[15]),
                  borderColor: withOpacity(typeCfg.color, isNice ? OPACITY[20] : OPACITY[40]),
                  borderStyle: isNice ? 'dashed' : 'solid',
                },
              ]}
            >
              <Icon size={COMPONENT.pill.iconSize} color={typeCfg.color} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
              <Text style={[styles.chipText, { color: typeCfg.color }]} numberOfLines={1}>
                {skillDisplayName(s, language)}
              </Text>
              {showRequirement && s.requirement && (
                <Text style={[styles.req, { color: getRequirementConfig(s.requirement, colors).color }]}>
                  {isNice ? t('labels.skillRequirement.nice_to_have') : t('labels.skillRequirement.required')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default EntitySkillTags;

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
    borderWidth: BORDER.width.thin,
  },
  chipText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.medium },
  req: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    marginLeft: 2,
  },
});
