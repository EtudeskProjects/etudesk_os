/**
 * PulsingOrb — Intense glowing ring with organic, irregular radiance
 * Asymmetric glow layers offset from center + rotation
 * create a powerful, living light effect.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface PulsingOrbProps {
  size?: number;
}

const CYCLE_MS = 3200;       // Faster breath
const ROTATION_MS = 8000;    // Faster rotation

export const PulsingOrb: React.FC<PulsingOrbProps> = ({ size = 90 }) => {
  const { colors, isDark } = useTheme();
  const orbColor = isDark ? colors.textPrimary : colors.primary;
  const breath = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const spinReverse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: CYCLE_MS * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: CYCLE_MS * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ROTATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const spinReverseLoop = Animated.loop(
      Animated.timing(spinReverse, {
        toValue: 1,
        duration: ROTATION_MS * 1.3,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    breathLoop.start();
    spinLoop.start();
    spinReverseLoop.start();

    return () => {
      breathLoop.stop();
      spinLoop.stop();
      spinReverseLoop.stop();
    };
  }, [breath, spin, spinReverse]);

  const d = size * 0.6;
  const rotateZ = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateZR = spinReverse.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  // Main ring — bold and intense
  const ringOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });
  const ringScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  const glows = [
    // Tight inner glows — intense core energy
    { bw: 4,  s0: 0.88, s1: 0.94, o0: 0.12, o1: 0.30, tx: 2,  ty: -1, rot: rotateZR },
    { bw: 6,  s0: 0.82, s1: 0.88, o0: 0.08, o1: 0.22, tx: -3, ty: 2,  rot: rotateZ },
    { bw: 3,  s0: 0.92, s1: 0.97, o0: 0.10, o1: 0.28, tx: -1, ty: -2, rot: rotateZ },
    // Mid glows — strong radiance
    { bw: 3,  s0: 1.06, s1: 1.16, o0: 0.18, o1: 0.38, tx: 1,  ty: 2,  rot: rotateZ },
    { bw: 5,  s0: 1.14, s1: 1.28, o0: 0.12, o1: 0.28, tx: -2, ty: -1, rot: rotateZR },
    { bw: 7,  s0: 1.24, s1: 1.40, o0: 0.08, o1: 0.20, tx: 3,  ty: 1,  rot: rotateZ },
    // Outer glows — wide radiance
    { bw: 9,  s0: 1.38, s1: 1.58, o0: 0.04, o1: 0.14, tx: -1, ty: 3,  rot: rotateZR },
    { bw: 12, s0: 1.52, s1: 1.76, o0: 0.02, o1: 0.09, tx: 2,  ty: -2, rot: rotateZ },
    // Outermost aura — powerful spread
    { bw: 14, s0: 1.68, s1: 1.95, o0: 0.01, o1: 0.06, tx: -2, ty: 2,  rot: rotateZR },
    { bw: 18, s0: 1.85, s1: 2.15, o0: 0.0,  o1: 0.035, tx: 1, ty: -1, rot: rotateZ },
  ];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {glows.map((g, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: g.bw,
              borderColor: orbColor,
              opacity: breath.interpolate({
                inputRange: [0, 1],
                outputRange: [g.o0, g.o1],
              }),
              transform: [
                { translateX: g.tx },
                { translateY: g.ty },
                {
                  scale: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [g.s0, g.s1],
                  }),
                },
                { rotate: g.rot },
              ],
            },
          ]}
        />
      ))}

      {/* Main ring — crisp, bold */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: 2.5,
            borderColor: orbColor,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
});

export default PulsingOrb;
