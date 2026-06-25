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
import { Check, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, withOpacity } from '../../../constants/theme';
import { getSkillTypeConfig, normalizeLevel, LEVEL_SCORE, skillDisplayName } from '../../../constants/skills';
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

  const gaugeColor = overall >= 80 ? colors.success : overall >= 50 ? colors.warning : colors.error;

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
        <View style={[styles.gauge, { borderColor: gaugeColor }]}>
          <Text style={[styles.gaugeValue, { color: gaugeColor }]}>{overall}%</Text>
          <Text style={[styles.gaugeLabel, { color: colors.textDisabled }]}>{t('copilot.skillMatch.coverage')}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotFilled, { backgroundColor: colors.textPrimary }]} />
          <Text style={[styles.legendText, { color: colors.textDisabled }]}>{t('copilot.skillMatch.current')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotTarget, { borderColor: colors.textPrimary }]} />
          <Text style={[styles.legendText, { color: colors.textDisabled }]}>{t('copilot.skillMatch.target')}</Text>
        </View>
      </View>

      {/* Skills */}
      <View style={styles.list}>
        {skills.map((s, i) => {
          const cfg = getSkillTypeConfig(s.type, colors);
          const met = isCohort && typeof s.coverage === 'number'
            ? (s.coverage ?? 0) >= 60
            : currentScore(s.current) >= currentScore(s.target);
          return (
            <View key={`${s.name}-${i}`} style={[styles.row, { borderTopColor: colors.borderColor }, i === 0 ? styles.firstRow : null]}>
              <View style={styles.rowHead}>
                <cfg.Icon size={14} color={cfg.color} strokeWidth={2} />
                <Text style={[styles.skillName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {skillDisplayName(s, language)}
                </Text>
                {isCohort && typeof s.coverage === 'number' ? (
                  <Text style={[styles.cohortPct, { color: met ? colors.success : colors.warning }]}>{Math.round(s.coverage)}%</Text>
                ) : met ? (
                  <Check size={14} color={colors.success} strokeWidth={2.5} />
                ) : (
                  <TrendingUp size={14} color={colors.warning} strokeWidth={2.5} />
                )}
              </View>
              <SkillLevelSteps level={s.current} type={s.type} target={s.target} size="sm" />
            </View>
          );
        })}
      </View>

      {/* Summary + insights */}
      {data.summary ? (
        <Text style={[styles.summary, { color: colors.textSecondary }]}>{data.summary}</Text>
      ) : null}
      {Array.isArray(data.insights) && data.insights.length > 0 && (
        <View style={styles.insights}>
          {data.insights.slice(0, 5).map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={[styles.bullet, { color: gaugeColor }]}>•</Text>
              <Text style={[styles.insightText, { color: colors.textSecondary }]}>{ins}</Text>
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
  gauge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 999, width: 56, height: 56 },
  gaugeValue: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.bold },
  gaugeLabel: { fontSize: 8, textTransform: 'uppercase' },
  legend: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDotFilled: { width: 10, height: 4, borderRadius: 2 },
  legendDotTarget: { width: 10, height: 4, borderRadius: 2, borderWidth: 1.5 },
  legendText: { fontSize: TYPOGRAPHY.fontSize.xs },
  list: { marginTop: SPACING.sm },
  row: { paddingVertical: SPACING.sm, borderTopWidth: BORDER.width.thin, gap: 6 },
  firstRow: { borderTopWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  skillName: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  cohortPct: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.bold },
  summary: { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.md, fontStyle: 'italic' },
  insights: { marginTop: SPACING.sm, gap: 4 },
  insightRow: { flexDirection: 'row', gap: SPACING.xs },
  bullet: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold },
  insightText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm },
});
