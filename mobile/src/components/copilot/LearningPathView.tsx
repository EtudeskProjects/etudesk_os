/**
 * LearningPathView Component
 * Displays a learning path with steps and progress
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Target,
  BookOpen,
  Code,
  CheckCircle,
  Circle,
  Clock,
  Play,
  FileText,
  Zap,
  ExternalLink,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { LearningPathOutput, LearningStep } from '../../services/copilotService';

interface LearningPathViewProps {
  data: LearningPathOutput;
  onStepPress?: (step: LearningStep) => void;
  onStartPath?: () => void;
}

export const LearningPathView: React.FC<LearningPathViewProps> = ({
  data,
  onStepPress,
  onStartPath,
}) => {
  const { colors } = useTheme();

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'lesson':
        return BookOpen;
      case 'exercise':
        return Code;
      case 'quiz':
        return Target;
      case 'project':
        return Zap;
      case 'resource':
        return FileText;
      default:
        return Circle;
    }
  };

  const getStepTypeLabel = (type: string) => {
    switch (type) {
      case 'lesson':
        return 'Leçon';
      case 'exercise':
        return 'Exercice';
      case 'quiz':
        return 'Quiz';
      case 'project':
        return 'Projet';
      case 'resource':
        return 'Ressource';
      default:
        return 'Étape';
    }
  };

  const completedCount = data.steps.filter((s) => s.completed).length;
  const progressPercentage = Math.round((completedCount / data.steps.length) * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Target size={24} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{data.title}</Text>
          {data.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {data.description}
            </Text>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { borderColor: colors.borderColor }]}>
        <View style={styles.statItem}>
          <Target size={16} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.textPrimary }]}>
            {data.targetSkill}
          </Text>
        </View>
        {data.estimatedDuration && (
          <View style={styles.statItem}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              ~{data.estimatedDuration}h
            </Text>
          </View>
        )}
        <View style={styles.statItem}>
          <CheckCircle size={16} color={colors.success} />
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {completedCount}/{data.steps.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBar, { backgroundColor: colors.borderColor }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progressPercentage}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
          {progressPercentage}% complété
        </Text>
      </View>

      {/* Prerequisites */}
      {data.prerequisites && data.prerequisites.length > 0 && (
        <View style={[styles.prerequisitesContainer, { backgroundColor: colors.warning + '10' }]}>
          <Text style={[styles.prerequisitesTitle, { color: colors.warning }]}>
            Prérequis recommandés:
          </Text>
          <Text style={[styles.prerequisitesText, { color: colors.textPrimary }]}>
            {data.prerequisites.join(', ')}
          </Text>
        </View>
      )}

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {data.steps.map((step, index) => {
          const StepIcon = step.completed ? CheckCircle : getStepIcon(step.type);
          const isLast = index === data.steps.length - 1;
          const isActive = !step.completed && (index === 0 || data.steps[index - 1]?.completed);

          return (
            <TouchableOpacity
              key={step.id}
              style={styles.stepItem}
              onPress={() => onStepPress?.(step)}
              disabled={!onStepPress}
              activeOpacity={0.7}
            >
              {/* Timeline */}
              <View style={styles.timeline}>
                <View
                  style={[
                    styles.stepIconCircle,
                    {
                      backgroundColor: step.completed
                        ? colors.success
                        : isActive
                        ? colors.primary
                        : colors.background,
                      borderColor: step.completed
                        ? colors.success
                        : isActive
                        ? colors.primary
                        : colors.borderColor,
                    },
                  ]}
                >
                  <StepIcon
                    size={16}
                    color={step.completed || isActive ? '#fff' : colors.textTertiary}
                  />
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.timelineLine,
                      {
                        backgroundColor: step.completed ? colors.success : colors.borderColor,
                      },
                    ]}
                  />
                )}
              </View>

              {/* Content */}
              <View style={[styles.stepContent, { opacity: step.completed ? 0.7 : 1 }]}>
                <View style={styles.stepHeader}>
                  <View
                    style={[
                      styles.stepTypeBadge,
                      {
                        backgroundColor: step.completed
                          ? colors.success + '15'
                          : isActive
                          ? colors.primary + '15'
                          : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepTypeText,
                        {
                          color: step.completed
                            ? colors.success
                            : isActive
                            ? colors.primary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {getStepTypeLabel(step.type)}
                    </Text>
                  </View>
                  {step.duration && (
                    <Text style={[styles.stepDuration, { color: colors.textTertiary }]}>
                      {step.duration} min
                    </Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.stepTitle,
                    {
                      color: colors.textPrimary,
                      textDecorationLine: step.completed ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {step.title}
                </Text>

                <Text
                  style={[styles.stepDescription, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {step.description}
                </Text>

                {step.resourceUrl && !step.completed && (
                  <View style={styles.resourceLink}>
                    <ExternalLink size={12} color={colors.primary} />
                    <Text style={[styles.resourceLinkText, { color: colors.primary }]}>
                      Voir la ressource
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Start Button */}
      {completedCount === 0 && onStartPath && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={onStartPath}
        >
          <Play size={18} color="#fff" />
          <Text style={styles.startButtonText}>Commencer le parcours</Text>
        </TouchableOpacity>
      )}

      {/* Continue Button */}
      {completedCount > 0 && completedCount < data.steps.length && onStartPath && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={onStartPath}
        >
          <Play size={18} color="#fff" />
          <Text style={styles.startButtonText}>Continuer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  progressSection: {
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
  },
  prerequisitesContainer: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
  },
  prerequisitesTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },
  prerequisitesText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  stepsContainer: {
    paddingLeft: SPACING.xs,
  },
  stepItem: {
    flexDirection: 'row',
  },
  timeline: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: SPACING.xs,
  },
  stepContent: {
    flex: 1,
    paddingBottom: SPACING.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  stepTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.sm,
  },
  stepTypeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  stepDuration: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
  },
  resourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  resourceLinkText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  startButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: '#fff',
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});

export default LearningPathView;
