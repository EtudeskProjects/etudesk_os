/**
 * SkillLevelSteps — canonical 4-step mastery indicator (beginner → master).
 *
 * Used everywhere a user/catalog skill level is shown: talent dashboard, talent
 * details, talent cards, agent skill cards (personalized component), and the
 * matching "Actuel vs Target" highlight.
 *
 * - 4 segments. Filled count = current level (beginner=1 … master=4).
 * - Filled color = competency TYPE color when `type` is given (color = type,
 *   number of steps = mastery), else the level's graphite intensity.
 * - `target` enables the "Actuel vs Target" mode: steps between current and
 *   target are tinted (the gap) and the target step is outlined.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../contexts/I18nContext';
import { getSkillTypeConfig, getLevelConfig, normalizeLevel, LEVEL_SCORE, LEVELS } from '../constants/skills';
import { withOpacity, TYPOGRAPHY, SPACING } from '../constants/theme';

interface Props {
  level?: string | null;
  /** Color the filled steps by competency type (color = type, steps = mastery). */
  type?: string | null;
  /** "Actuel vs Target" mode: marks the target step and tints the gap. */
  target?: string | null;
  size?: 'xs' | 'sm' | 'md';
  /** Show the level name (and "→ target" when target > current). */
  showLabel?: boolean;
}

const DIMS = {
  xs: { h: 3, w: 10, gap: 2, font: TYPOGRAPHY.fontSize.xs },
  sm: { h: 4, w: 14, gap: 3, font: TYPOGRAPHY.fontSize.xs },
  md: { h: 6, w: 22, gap: 4, font: TYPOGRAPHY.fontSize.sm },
} as const;

export function SkillLevelSteps({ level, type, target, size = 'sm', showLabel = false }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const lvl = normalizeLevel(level);
  const current = LEVEL_SCORE[lvl]; // 1..4
  const color = type ? getSkillTypeConfig(type, colors).color : getLevelConfig(lvl, colors).color;
  const targetLvl = target ? normalizeLevel(target) : null;
  const targetStep = targetLvl ? LEVEL_SCORE[targetLvl] : null;
  const dims = DIMS[size];

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { gap: dims.gap }]} accessibilityLabel={`${lvl}${targetLvl ? ` -> ${targetLvl}` : ''}`}>
        {LEVELS.map((_, i) => {
          const step = i + 1;
          const filled = step <= current;
          const isTarget = targetStep != null && step === targetStep;
          const isGap = targetStep != null && step > current && step <= targetStep;
          let backgroundColor = withOpacity(colors.textPrimary, 0.1); // empty track
          if (filled) backgroundColor = color;
          else if (isGap) backgroundColor = withOpacity(color, 0.22);
          return (
            <View
              key={i}
              style={[
                styles.step,
                { height: dims.h, width: dims.w, borderRadius: dims.h / 2, backgroundColor },
                isTarget && !filled ? { borderWidth: 1.5, borderColor: color } : null,
              ]}
            />
          );
        })}
      </View>
      {showLabel && (
        <Text style={[styles.label, { color, fontSize: dims.font }]} numberOfLines={1}>
          {t(getLevelConfig(lvl, colors).labelKey)}
          {targetLvl && targetStep != null && targetStep > current
            ? ` → ${t(getLevelConfig(targetLvl, colors).labelKey)}`
            : ''}
        </Text>
      )}
    </View>
  );
}

export default SkillLevelSteps;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  step: {},
  label: { fontWeight: TYPOGRAPHY.fontWeight.medium },
});
