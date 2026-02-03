import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface Step {
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <View key={index} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: isCompleted || isCurrent ? colors.primary : colors.gray200,
                    borderColor: isCompleted || isCurrent ? colors.primary : colors.gray300,
                  },
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color={colors.textOnPrimary} strokeWidth={2.5} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      { color: isCurrent ? colors.textOnPrimary : colors.gray500 },
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: isCompleted ? colors.primary : colors.gray200 },
                  ]}
                />
              )}
            </View>

            <Text
              style={[
                styles.stepTitle,
                {
                  color: isCompleted || isCurrent ? colors.textPrimary : colors.gray500,
                  fontWeight: isCurrent ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.regular,
                },
              ]}
              numberOfLines={1}
            >
              {step.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumber: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: SPACING.xs,
  },

  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xxs,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});
