/**
 * SkillMatchBlock — "Actuel vs Target" skill coverage card (agent personalized
 * component). Two scopes:
 *  - talent: the user's current level vs the level a job/role requires.
 *  - cohort: an organization cohort's aggregate level + coverage % vs a target.
 *
 * Each skill renders the canonical 4-step loader (SkillLevelSteps) with the
 * gap tinted and the target outlined, plus an overall coverage gauge and
 * agent insights.
 *
 * Block JSON (```skill_match):
 * {
 *   "title"?: string, "subject"?: string, "scope"?: "talent"|"cohort",
 *   "coverage"?: number,                       // 0-100, computed if absent
 *   "skills": [
 *     { "name": string, "name_fr"?: string, "type"?: string,
 *       "current"?: "beginner"|"intermediate"|"advanced"|"master"|null,
 *       "target": "beginner"|"intermediate"|"advanced"|"master",
 *       "coverage"?: number }                  // cohort: % at/above target
 *   ],
 *   "summary"?: string, "insights"?: string[]
 * }
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Target } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, withOpacity } from '../../../constants/theme';
import { getLevelConfig, getSkillTypeConfig, normalizeLevel, LEVEL_SCORE, skillDisplayName } from '../../../constants/skills';
import { SkillLevelSteps } from '../../SkillLevelSteps';

interface SkillMatchItem {
  name: string;
  name_fr?: string | null;
  type?: string | null;
  current?: string | null;
  target: string;
  coverage?: number | null;
}

interface SkillMatchData {
  title?: string;
  subject?: string;
  scope?: 'talent' | 'cohort';
  coverage?: number | null;
  skills: SkillMatchItem[];
  summary?: string;
  insights?: string[];
}

const currentScore = (lvl?: string | null) => (lvl ? LEVEL_SCORE[normalizeLevel(lvl)] : 0);

export function SkillMatchBlock({ data }: { data: SkillMatchData }) {
  const { colors } = useTheme();
  const { t, language } = useI18n();

  const skills = Array.isArray(data?.skills) ? data.skills : [];
  if (skills.length === 0) return null;

  const isCohort = data.scope === 'cohort';

  // Per-skill "met" = current at/above target (talent) ; cohort uses coverage>=60.
  const metCount = skills.filter((s) =>
    isCohort && typeof s.coverage === 'number'
      ? (s.coverage ?? 0) >= 60
      : currentScore(s.current) >= currentScore(s.target)
  ).length;

  const overall =
    typeof data.coverage === 'number'
      ? Math.round(data.coverage)
      : isCohort && skills.some((s) => typeof s.coverage === 'number')
      ? Math.round(skills.reduce((a, s) => a + (s.coverage ?? 0), 0) / skills.length)
      : Math.round((metCount / skills.length) * 100);

  const insightColor = overall >= 80 ? colors.success : overall >= 50 ? colors.warning : colors.error;
  const gapCount = skills.length - metCount;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {data.title || t('copilot.skillMatch.title')}
          </Text>
          {data.subject ? (
            <Text style={[styles.subject, { color: colors.textSecondary }]} numberOfLines={1}>
              {isCohort ? t('copilot.skillMatch.cohortVs', { subject: data.subject }) : t('copilot.skillMatch.talentVs', { subject: data.subject })}
            </Text>
          ) : null}
        </View>
        <View style={[styles.coverageBadge, { backgroundColor: withOpacity(insightColor, 0.12) }]}>
          <Text style={[styles.coverageValue, { color: insightColor }]}>{overall}%</Text>
          <Text style={[styles.coverageLabel, { color: colors.textSecondary }]}>{t('copilot.skillMatch.coverage')}</Text>
        </View>
      </View>

      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        {isCohort
          ? `${metCount}/${skills.length} ${t('copilot.skillMatch.target').toLowerCase()}`
          : gapCount === 0
            ? t('copilot.skillMatch.allMet')
            : t('copilot.skillMatch.gapsRemaining', { count: gapCount })}
      </Text>

      {/* Skills */}
      <View style={styles.list}>
        {skills.map((s, i) => {
          const cfg = getSkillTypeConfig(s.type, colors);
          const met = isCohort && typeof s.coverage === 'number'
            ? (s.coverage ?? 0) >= 60
            : currentScore(s.current) >= currentScore(s.target);
          const currentLevel = getLevelConfig(s.current, colors);
          const targetLevel = getLevelConfig(s.target, colors);
          return (
            <View key={`${s.name}-${i}`} style={[styles.row, { borderTopColor: colors.borderColor }, i === 0 ? styles.firstRow : null]}>
              <View style={styles.rowHead}>
                <cfg.Icon size={14} color={cfg.color} strokeWidth={2} />
                <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {skillDisplayName(s, language)}
                </Text>
                {isCohort && typeof s.coverage === 'number' ? (
                  <Text style={[styles.status, { color: met ? colors.success : colors.warning }]}>{Math.round(s.coverage)}%</Text>
                ) : met ? (
                  <View style={[styles.metBadge, { backgroundColor: withOpacity(colors.success, 0.12) }]}>
                    <Check size={12} color={colors.success} strokeWidth={2.5} />
                    <Text style={[styles.status, { color: colors.success }]}>{t('copilot.skillMatch.met')}</Text>
                  </View>
                ) : (
                  <View style={[styles.gapBadge, { backgroundColor: withOpacity(colors.warning, 0.14) }]}>
                    <Target size={12} color={colors.warning} strokeWidth={2.5} />
                    <Text style={[styles.status, { color: colors.warning }]}>{t('copilot.skillMatch.gap')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.levelLine}>
                <Text style={[styles.levelText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('copilot.skillMatch.current')} · {t(currentLevel.labelKey)}
                </Text>
                <Text style={[styles.levelText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('copilot.skillMatch.target')} · {t(targetLevel.labelKey)}
                </Text>
              </View>
              <SkillLevelSteps level={s.current} type={s.type} target={s.target} size="sm" />
            </View>
          );
        })}
      </View>

      {/* Summary + insights */}
      {data.summary ? (
        <View style={[styles.summaryBox, { backgroundColor: withOpacity(colors.primary, 0.07) }]}>
          <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={3}>{data.summary}</Text>
        </View>
      ) : null}
      {Array.isArray(data.insights) && data.insights.length > 0 && (
        <View style={styles.insights}>
          {data.insights.slice(0, 3).map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={[styles.bullet, { color: insightColor }]}>•</Text>
              <Text style={[styles.insightText, { color: colors.textSecondary }]} numberOfLines={2}>{ins}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default SkillMatchBlock;

const styles = StyleSheet.create({
  card: { borderWidth: BORDER.width.thin, borderRadius: BORDER.radius.lg, padding: SPACING.md, marginVertical: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  headerText: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  subject: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: 2 },
  coverageBadge: { minWidth: 54, alignItems: 'center', borderRadius: BORDER.radius.md, paddingHorizontal: SPACING.xs, paddingVertical: 5 },
  coverageValue: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.bold },
  coverageLabel: { fontSize: 10, marginTop: 1 },
  helper: { fontSize: TYPOGRAPHY.fontSize.xs, marginTop: SPACING.sm },
  list: { marginTop: SPACING.sm },
  row: { paddingVertical: SPACING.sm, borderTopWidth: BORDER.width.thin, gap: 5 },
  firstRow: { borderTopWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  skillName: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  metBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: BORDER.radius.sm, paddingHorizontal: 5, paddingVertical: 3 },
  gapBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: BORDER.radius.sm, paddingHorizontal: 5, paddingVertical: 3 },
  status: { fontSize: 10, fontWeight: TYPOGRAPHY.fontWeight.bold },
  levelLine: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.xs },
  levelText: { flex: 1, fontSize: 10 },
  summaryBox: { marginTop: SPACING.md, borderRadius: BORDER.radius.md, padding: SPACING.sm },
  summary: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 19 },
  insights: { marginTop: SPACING.sm, gap: 4 },
  insightRow: { flexDirection: 'row', gap: SPACING.xs },
  bullet: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold },
  insightText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm },
});
