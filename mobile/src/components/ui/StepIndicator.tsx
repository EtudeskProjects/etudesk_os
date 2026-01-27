import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface Step {
    id: string;
    label: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStepId: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStepId }) => {
    const { colors } = useTheme();

    const currentStepIndex = steps.findIndex(s => s.id === currentStepId);

    return (
        <View style={styles.container}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <View key={step.id} style={styles.stepItem}>
                        <View
                            style={[
                                styles.stepDot,
                                { backgroundColor: colors.gray200 },
                                (isCurrent || isCompleted) && { backgroundColor: colors.primary },
                            ]}
                        >
                            {isCompleted ? (
                                <Check size={12} color={COLORS.white} strokeWidth={ICON.strokeWidth + 0.5} />
                            ) : (
                                <Text style={[styles.stepNumber, isCurrent && { color: COLORS.white }]}>
                                    {index + 1}
                                </Text>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.stepLabel,
                                { color: colors.gray500 },
                                isCurrent && { color: colors.primary, fontWeight: TYPOGRAPHY.fontWeight.semibold },
                            ]}
                        >
                            {step.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.lg, // increased gap for better spacing
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.md,
    },
    stepItem: {
        alignItems: 'center',
        gap: SPACING.xs,
    },
    stepDot: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER.radius.full,
    },
    stepNumber: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        color: COLORS.gray600,
    },
    stepLabel: {
        fontSize: TYPOGRAPHY.fontSize.xs,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
});
