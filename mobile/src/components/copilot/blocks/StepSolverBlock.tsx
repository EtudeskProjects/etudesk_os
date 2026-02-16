/**
 * StepSolverBlock — Accordion step-by-step solver
 * Native React Native component with progressive reveal
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { buildKaTeXHTML } from './MathBlock';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Step {
  label: string;
  content: string;
  math?: string;
}

interface StepSolverBlockProps {
  data: {
    title: string;
    steps: Step[];
  };
}

const MATH_HEIGHT = 50;

/** Inline KaTeX WebView for a single math expression within a step */
const InlineMath: React.FC<{ expression: string; bgColor: string; textColor: string }> = ({
  expression,
  bgColor,
  textColor,
}) => {
  const html = useMemo(
    () => buildKaTeXHTML(expression, { backgroundColor: bgColor, textColor, displayMode: true }),
    [expression, bgColor, textColor]
  );

  return (
    <View style={{ height: MATH_HEIGHT, borderRadius: 8, overflow: 'hidden', marginTop: SPACING.xs }}>
      <WebView
        source={{ html, baseUrl: 'https://cdn.jsdelivr.net' }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
};

export const StepSolverBlock: React.FC<StepSolverBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [revealedCount, setRevealedCount] = useState(1); // First step always visible
  const totalSteps = data.steps.length;
  const allRevealed = revealedCount >= totalSteps;

  const revealNext = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRevealedCount((c) => Math.min(c + 1, totalSteps));
  }, [totalSteps]);

  const revealAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRevealedCount(totalSteps);
  }, [totalSteps]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Title */}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{data.title}</Text>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${(revealedCount / totalSteps) * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
        Étape {revealedCount} / {totalSteps}
      </Text>

      {/* Steps */}
      {data.steps.map((step, index) => {
        const isRevealed = index < revealedCount;
        const isActive = index === revealedCount - 1;

        if (!isRevealed) return null;

        return (
          <View
            key={index}
            style={[
              styles.step,
              {
                backgroundColor: isActive
                  ? withOpacity(colors.primary, OPACITY[5])
                  : colors.background,
                borderColor: isActive ? withOpacity(colors.primary, OPACITY[20]) : colors.borderColor,
              },
            ]}
          >
            {/* Step number + label */}
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, { backgroundColor: isActive ? colors.primary : withOpacity(colors.primary, OPACITY[20]) }]}>
                <Text style={[styles.stepNumberText, { color: isActive ? colors.white : colors.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>{step.label}</Text>
              {isActive ? (
                <ChevronDown size={ICON.size.sm} color={colors.textSecondary} />
              ) : (
                <ChevronRight size={ICON.size.sm} color={colors.textDisabled} />
              )}
            </View>

            {/* Content */}
            <Text style={[styles.stepContent, { color: colors.textSecondary }]}>{step.content}</Text>

            {/* Math (optional) */}
            {step.math ? (
              <InlineMath
                expression={step.math}
                bgColor={withOpacity(colors.primary, OPACITY[5])}
                textColor={colors.textPrimary}
              />
            ) : null}
          </View>
        );
      })}

      {/* Action buttons */}
      {!allRevealed && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={revealNext}
          >
            <Text style={[styles.nextButtonText, { color: colors.white }]}>Étape suivante</Text>
          </Pressable>
          <Pressable
            style={[styles.showAllButton, { borderColor: colors.borderColor }]}
            onPress={revealAll}
          >
            <Eye size={ICON.size.sm} color={colors.textSecondary} />
            <Text style={[styles.showAllText, { color: colors.textSecondary }]}>Voir tout</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.md,
  },
  step: {
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  stepLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },
  stepContent: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginLeft: 36, // align with label text
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  nextButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  showAllText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default StepSolverBlock;
