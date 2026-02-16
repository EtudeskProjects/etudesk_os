/**
 * ShimmerPlaceholder
 * Animated loading placeholder with shimmer effect and biological rhythm
 * Design: Minimalist, visible in light and dark mode
 * Rhythm: ~3.5s breathing cycle (organic, non-mechanical)
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue, Easing } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BORDER, SPACING } from '../../constants/theme';

const BIOLOGICAL_CYCLE_MS = 3500; // ~3.5s breathing rhythm
const BAR_COUNT = 4;

interface ShimmerPlaceholderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** 'bar' = single bar, 'block' = multiple bars with wave effect */
  variant?: 'bar' | 'block';
}

export const ShimmerPlaceholder: React.FC<ShimmerPlaceholderProps> = ({
  width = '100%',
  height = 16,
  borderRadius = BORDER.radius.sm,
  style,
  variant = 'bar',
}) => {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  // Theme-aware colors: use gray400 for visible contrast in both modes
  const baseColor = colors.gray400;

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

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 1],
  });

  if (variant === 'bar') {
    return (
      <Animated.View
        style={[
          styles.shimmer,
          {
            width,
            height,
            borderRadius,
            backgroundColor: baseColor,
            opacity,
          },
          style,
        ]}
      />
    );
  }

  // Block variant: multiple bars with staggered opacity for wave effect
  const barOpacities = [
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.25, 0.85] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.35, 0.7] }),
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 0.5, 0.55] }),
  ];
  const barWidths: DimensionValue[] = ['60%', '90%', '100%', '80%'];
  const barHeight = Math.max(12, height * 0.7);

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => (
    <Animated.View
      key={i}
      style={[
        styles.bar,
        {
          width: barWidths[i],
          height: barHeight,
          borderRadius,
          backgroundColor: baseColor,
          opacity: barOpacities[i],
        },
      ]}
    />
  ));

  return (
    <View style={[styles.blockContainer, { width }, style]}>
      {bars}
    </View>
  );
};

const styles = StyleSheet.create({
  shimmer: {
    overflow: 'hidden',
  },
  blockContainer: {
    gap: SPACING.sm,
  },
  bar: {
    overflow: 'hidden',
  },
});

export default ShimmerPlaceholder;
