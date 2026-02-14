/**
 * LoadingShimmer
 * Full-page or inline loading indicator with shimmer effect
 * Default label: "Réfléchit…" when content is empty
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ShimmerPlaceholder } from './ShimmerPlaceholder';
import { SPACING, TYPOGRAPHY } from '../../constants/theme';

interface LoadingShimmerProps {
  /** 'fullPage' = centered block with bars + label, 'inline' = compact 1-2 bars */
  variant?: 'fullPage' | 'inline';
  /** Label shown below shimmer. Default: "Réfléchit…" */
  label?: string;
  style?: ViewStyle;
}

export const LoadingShimmer: React.FC<LoadingShimmerProps> = ({
  variant = 'fullPage',
  label = 'Réfléchit…',
  style,
}) => {
  const { colors } = useTheme();

  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <ShimmerPlaceholder width="70%" height={12} variant="bar" />
        <ShimmerPlaceholder width="50%" height={12} variant="bar" style={{ marginTop: SPACING.xs }} />
      </View>
    );
  }

  return (
    <View style={[styles.fullPage, style]}>
      <View style={styles.bars}>
        <ShimmerPlaceholder width={200} height={14} variant="block" />
        <ShimmerPlaceholder width={240} height={48} variant="block" />
        <ShimmerPlaceholder width={220} height={48} variant="block" />
        <ShimmerPlaceholder width={180} height={48} variant="block" />
      </View>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fullPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  bars: {
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  inline: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
});

export default LoadingShimmer;
