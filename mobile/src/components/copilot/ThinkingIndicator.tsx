/**
 * ThinkingIndicator — Shimmer effect + "Réfléchit…"
 * Replaces ActivityIndicator in copilot/assistant contexts
 * Visible in light and dark mode with biological rhythm
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ShimmerPlaceholder } from '../ui/ShimmerPlaceholder';
import { SPACING, TYPOGRAPHY } from '../../constants/theme';

interface ThinkingIndicatorProps {
  /** Default: "Réfléchit…" */
  label?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  label = 'Réfléchit…',
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        <ShimmerPlaceholder width="80%" height={12} variant="bar" />
        <ShimmerPlaceholder width="60%" height={12} variant="bar" style={styles.bar2} />
        <ShimmerPlaceholder width="70%" height={12} variant="bar" style={styles.bar3} />
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  bars: {
    gap: SPACING.xs,
  },
  bar2: { marginLeft: SPACING.sm },
  bar3: { marginLeft: SPACING.xs },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default ThinkingIndicator;
