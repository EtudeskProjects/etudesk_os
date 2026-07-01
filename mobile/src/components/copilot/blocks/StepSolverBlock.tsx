/**
 * StepSolverBlock — Accordion step-by-step solver
 * Native React Native component with progressive reveal
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { buildKaTeXHTML } from './MathBlock';
import { getLabelDirect } from '../../../utils/labels';

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

const MIN_MATH_HEIGHT = 50;
const MAX_MATH_HEIGHT = 160;

function sanitizeText(value: unknown, max = 220): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function sanitizeSteps(data: StepSolverBlockProps['data'], fallbackLabel: (index: number) => string): { title: string; steps: Step[] } {
  const title = sanitizeText(data?.title, 80) || '';
  const steps = Array.isArray(data?.steps)
    ? data.steps
        .map<Step | null>((step, index) => {
          const label = sanitizeText(step?.label, 72) || fallbackLabel(index);
          const content = sanitizeText(step?.content, 320);
          const math = sanitizeText(step?.math, 400);
          if (!content && !math) return null;
          return math ? { label, content: content || '', math } : { label, content: content || '' };
        })
        .filter((step): step is Step => step !== null)
        .slice(0, 12)
    : [];
  return { title, steps };
}

/** Inline KaTeX WebView for a single math expression within a step */
const InlineMath: React.FC<{ expression: string; bgColor: string; textColor: string }> = ({
  expression,
  bgColor,
  textColor,
}) => {
  const [height, setHeight] = useState(MIN_MATH_HEIGHT);
  const html = useMemo(
    () => buildKaTeXHTML(expression, { backgroundColor: bgColor, textColor, displayMode: true }),
    [expression, bgColor, textColor]
  );

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height') {
        setHeight(Math.max(MIN_MATH_HEIGHT, Math.min(MAX_MATH_HEIGHT, msg.value + 12)));
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <View style={{ height, borderRadius: 8, overflow: 'hidden', marginTop: SPACING.xs }}>
      <WebView
        source={{ html, baseUrl: 'https://cdn.jsdelivr.net' }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled
        onMessage={onMessage}
        originWhitelist={['*']}
      />
    </View>
  );
};

export const StepSolverBlock: React.FC<StepSolverBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const sanitized = sanitizeSteps(data, (index) => t('stepSolver.fallbackStep', { index: index + 1 }));
  const safeSteps = sanitized.steps;
  const totalSteps = safeSteps.length;
  const [revealedCount, setRevealedCount] = useState(Math.min(1, totalSteps)); // First step always visible
  const allRevealed = totalSteps === 0 || revealedCount >= totalSteps;
  const isSingleStep = totalSteps <= 1;

  if (totalSteps === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{sanitized.title || t('stepSolver.defaultTitle')}</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.textDisabled }}>
          {getLabelDirect('noSteps')}
        </Text>
      </View>
    );
  }

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
      <Text style={[styles.title, { color: colors.textPrimary }]}>{sanitized.title || t('stepSolver.defaultTitle')}</Text>

      {!isSingleStep && (
        <>
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
            {t('stepSolver.step', { current: revealedCount, total: totalSteps })}
          </Text>
        </>
      )}

      {safeSteps.map((step, index) => {
        const isRevealed = index < revealedCount;
        const isActive = index === revealedCount - 1;

        if (!isRevealed) return null;

        return (
          <View
            key={index}
            style={[
              styles.step,
              {
                backgroundColor: !isSingleStep && isActive
                  ? withOpacity(colors.primary, OPACITY[5])
                  : colors.background,
                borderColor: !isSingleStep && isActive ? withOpacity(colors.primary, OPACITY[20]) : colors.borderColor,
              },
            ]}
          >
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, { backgroundColor: isActive ? colors.primary : withOpacity(colors.primary, OPACITY[20]) }]}>
                <Text style={[styles.stepNumberText, { color: isActive ? colors.white : colors.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                {step.label}
              </Text>
              {!isSingleStep && isActive ? (
                <ChevronDown size={ICON.size.sm} color={colors.textSecondary} />
              ) : !isSingleStep ? (
                <ChevronRight size={ICON.size.sm} color={colors.textDisabled} />
              ) : null}
            </View>

            {step.content ? (
              <Text style={[styles.stepContent, { color: colors.textSecondary }]}>{step.content}</Text>
            ) : null}

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

      {!allRevealed && !isSingleStep && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={revealNext}
          >
            <Text style={[styles.nextButtonText, { color: colors.white }]}>{t('stepSolver.nextStep')}</Text>
          </Pressable>
          <Pressable
            style={[styles.showAllButton, { borderColor: colors.borderColor }]}
            onPress={revealAll}
          >
            <Eye size={ICON.size.sm} color={colors.textSecondary} />
            <Text style={[styles.showAllText, { color: colors.textSecondary }]}>{t('stepSolver.showAll')}</Text>
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
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  stepContent: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginLeft: 36,
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
