/**
 * ThinkingIndicator — Brain icon with shimmer + "Réfléchit…"
 * Replaces skeleton bars with a compact brain icon + label row
 * The brain icon pulses with a breathing shimmer effect
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Brain } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, ICON } from '../../constants/theme';

const CYCLE_MS = 2800; // Breathing rhythm

interface ThinkingIndicatorProps {
  /** Default: "Réfléchit…" */
  label?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  label = 'Réfléchit…',
}) => {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: CYCLE_MS / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: CYCLE_MS / 2,
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
    outputRange: [0.35, 1],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Brain size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
      </Animated.View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default ThinkingIndicator;
