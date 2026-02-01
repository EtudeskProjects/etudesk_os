/**
 * ThinkingIndicator
 * "Le copilote réfléchit..." with animated dots
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';

interface ThinkingIndicatorProps {
  message?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  message = 'Le copilote réfléchit',
}) => {
  const { colors } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay), // Total cycle of 1200ms
        ])
      );

    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 150);
    const anim3 = createDotAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const renderDot = (anim: Animated.Value, key: number) => (
    <Animated.View
      key={key}
      style={[
        styles.dot,
        {
          backgroundColor: colors.primary,
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.2],
              }),
            },
          ],
        },
      ]}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Sparkles size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>
      <View style={styles.dotsContainer}>
        {renderDot(dot1, 1)}
        {renderDot(dot2, 2)}
        {renderDot(dot3, 3)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
    gap: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default ThinkingIndicator;
