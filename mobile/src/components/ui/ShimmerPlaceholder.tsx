/**
 * ShimmerPlaceholder
 * Animated loading placeholder with shimmer effect
 * Design: Minimalist, harmonious with the warm earth tones theme
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BORDER } from '../../constants/theme';

interface ShimmerPlaceholderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const ShimmerPlaceholder: React.FC<ShimmerPlaceholderProps> = ({
  width = '100%',
  height = 16,
  borderRadius = BORDER.radius.sm,
  style,
}) => {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.gray200,
          opacity,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  shimmer: {
    overflow: 'hidden',
  },
});

export default ShimmerPlaceholder;
