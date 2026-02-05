/**
 * ThinkingIndicator — Brain icon + shimmer animation
 * Replaces all ActivityIndicator instances in the copilot
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Brain } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, ICON } from '../../constants/theme';

interface ThinkingIndicatorProps {
  label?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  label = 'Réflexion en cours...',
}) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.15)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Brain size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      </Animated.View>
      <Animated.Text
        style={[styles.label, { color: colors.textSecondary, opacity }]}
      >
        {label}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default ThinkingIndicator;
