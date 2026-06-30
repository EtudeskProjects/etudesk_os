/**
 * SkillsBlock — the talent's own skills shown as cards (agent personalized
 * component). Each card shows the competency TYPE icon (color = type) and the
 * level as the canonical 4-step progression (SkillLevelSteps) with its label.
 *
 * Use this instead of a plain table whenever listing the user's skills.
 *
 * Block JSON (```skills):
 * {
 *   "title"?: string,
 *   "skills": [
 *     { "name": string, "name_fr"?: string, "type"?: "knowledge"|"hard_skill"|
 *       "soft_skill"|"tool_platform"|"language",
 *       "level": "beginner"|"intermediate"|"advanced"|"master" }
 *   ]
 * }
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, withOpacity } from '../../../constants/theme';
import { getSkillTypeConfig, skillDisplayName } from '../../../constants/skills';
import { SkillLevelSteps } from '../../SkillLevelSteps';

const PREVIEW_LIMIT = 10;

interface SkillItem {
  name: string;
  name_fr?: string | null;
  type?: string | null;
  level?: string | null;
}

interface SkillsData {
  title?: string;
  skills: SkillItem[];
  talentId?: string | null;
  talent_id?: string | null;
}

export function SkillsBlock({ data, onSkillPress }: { data: SkillsData; onSkillPress?: (name: string) => void }) {
  const { colors } = useTheme();
  const { language } = useI18n();
  const router = useRouter();

  const skills = Array.isArray(data?.skills) ? data.skills : [];
  if (skills.length === 0) return null;
  const talentId = data?.talentId || data?.talent_id;
  const hasMore = skills.length > PREVIEW_LIMIT;
  const visibleSkills = hasMore ? skills.slice(0, PREVIEW_LIMIT) : skills;
  const remaining = Math.max(0, skills.length - PREVIEW_LIMIT);
  const seeMoreLabel = language === 'fr'
    ? talentId ? 'Voir le profil du talent' : `Voir plus (${remaining})`
    : talentId ? 'View talent profile' : `See more (${remaining})`;

  const handleSeeMore = () => {
    if (talentId) {
      router.push(`/details/talent/${talentId}` as any);
      return;
    }

    router.push('/settings/skills' as any);
  };

  return (
    <View style={styles.wrap}>
      {data.title ? (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{data.title}</Text>
      ) : null}
      <View style={styles.grid}>
        {visibleSkills.map((s, i) => {
          const cfg = getSkillTypeConfig(s.type, colors);
          const label = skillDisplayName(s, language);
          return (
            <TouchableOpacity
              key={`${s.name}-${i}`}
              activeOpacity={onSkillPress ? 0.6 : 1}
              disabled={!onSkillPress}
              // Tapping a skill inserts its title into the chat input (no submit).
              onPress={onSkillPress ? () => onSkillPress(label) : undefined}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
            >
              <View style={styles.head}>
                <View style={[styles.iconWrap, { backgroundColor: withOpacity(cfg.color, 0.12) }]}>
                  <cfg.Icon size={15} color={cfg.color} strokeWidth={1.25} />
                </View>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                  {label}
                </Text>
              </View>
              <SkillLevelSteps level={s.level} type={s.type} size="sm" showLabel />
            </TouchableOpacity>
          );
        })}
      </View>
      {hasMore ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleSeeMore}
          style={[styles.moreButton, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        >
          <Text style={[styles.moreText, { color: colors.primary }]} numberOfLines={1}>
            {seeMoreLabel}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={1.75} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default SkillsBlock;

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACING.sm },
  title: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: SPACING.sm },
  grid: { gap: SPACING.sm },
  card: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconWrap: { width: 28, height: 28, borderRadius: BORDER.radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  moreButton: {
    marginTop: SPACING.sm,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  moreText: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold },
});
