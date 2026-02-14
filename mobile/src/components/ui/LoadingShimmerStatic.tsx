/**
 * LoadingShimmerStatic
 * Full-page loading shimmer that accepts colors as prop (no useTheme).
 * Use when ThemeProvider is not yet mounted (e.g. app bootstrap in _layout.tsx).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SPACING, TYPOGRAPHY } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';

const BIOLOGICAL_CYCLE_MS = 3500;

interface LoadingShimmerStaticProps {
  /** Theme colors (e.g. LIGHT_COLORS or DARK_COLORS) */
  colors: ThemeColors;
  /** Label shown below shimmer */
  label?: string;
}

export const LoadingShimmerStatic: React.FC<LoadingShimmerStaticProps> = ({
  colors,
  label = 'Réfléchit…',
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const baseColor = colors.gray200;

  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: BIOLOGICAL_CYCLE_MS / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: BIOLOGICAL_CYCLE_MS / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    breathing.start();
    return () => breathing.stop();
  }, [anim]);

  const barOpacities = [
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.85, 0.35] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.35, 0.75] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.45, 0.65] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 0.55, 0.55] }),
  ];
  const barConfigs = [
    { width: 200, height: 14 },
    { width: 240, height: 48 },
    { width: 220, height: 48 },
    { width: 180, height: 48 },
  ];

  return (
    <View style={styles.fullPage}>
      <View style={styles.bars}>
        {barConfigs.map((config, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                width: config.width,
                height: config.height,
                backgroundColor: baseColor,
                opacity: barOpacities[i],
              },
            ]}
          />
        ))}
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
  bar: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default LoadingShimmerStatic;
