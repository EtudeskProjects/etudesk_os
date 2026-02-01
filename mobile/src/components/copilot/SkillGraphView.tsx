/**
 * SkillGraphView Component
 * Visual representation of skill relationships and progress
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Zap, CheckCircle, Circle, ArrowRight, Target } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { SkillGraphOutput, SkillNode } from '../../services/copilotService';

interface SkillGraphViewProps {
  data: SkillGraphOutput;
  onSkillPress?: (skillId: string) => void;
}

export const SkillGraphView: React.FC<SkillGraphViewProps> = ({
  data,
  onSkillPress,
}) => {
  const { colors } = useTheme();

  // Get focus skill and organize related skills
  const focusSkill = data.nodes.find((n) => n.isTarget);
  const prerequisites = data.nodes.filter((n) =>
    data.edges.some((e) => e.to === focusSkill?.id && e.from === n.id && e.type === 'prerequisite')
  );
  const relatedSkills = data.nodes.filter((n) =>
    !n.isTarget && data.edges.some((e) =>
      (e.from === focusSkill?.id || e.to === focusSkill?.id) &&
      (e.from === n.id || e.to === n.id) &&
      e.type === 'related'
    )
  );
  const childSkills = data.nodes.filter((n) =>
    data.edges.some((e) => e.from === focusSkill?.id && e.to === n.id && e.type === 'parent')
  );

  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'beginner':
        return colors.warning;
      case 'intermediate':
        return colors.info;
      case 'advanced':
        return colors.primary;
      case 'expert':
        return colors.success;
      default:
        return colors.textTertiary;
    }
  };

  const getLevelLabel = (level?: string) => {
    switch (level) {
      case 'beginner':
        return 'Débutant';
      case 'intermediate':
        return 'Intermédiaire';
      case 'advanced':
        return 'Avancé';
      case 'expert':
        return 'Expert';
      default:
        return 'Non évalué';
    }
  };

  const renderSkillChip = (skill: SkillNode, size: 'small' | 'medium' = 'small') => {
    const levelColor = getLevelColor(skill.level);
    const isSmall = size === 'small';

    return (
      <View
        key={skill.id}
        style={[
          styles.skillChip,
          isSmall ? styles.skillChipSmall : styles.skillChipMedium,
          {
            backgroundColor: skill.isAcquired ? levelColor + '15' : colors.background,
            borderColor: skill.isAcquired ? levelColor : colors.borderColor,
          },
        ]}
      >
        {skill.isAcquired ? (
          <CheckCircle size={isSmall ? 14 : 16} color={levelColor} />
        ) : (
          <Circle size={isSmall ? 14 : 16} color={colors.textTertiary} />
        )}
        <Text
          style={[
            isSmall ? styles.skillChipTextSmall : styles.skillChipText,
            { color: skill.isAcquired ? levelColor : colors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {skill.name}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Focus Skill (Center) */}
      {focusSkill && (
        <View style={styles.focusSection}>
          <View
            style={[
              styles.focusSkillCircle,
              {
                backgroundColor: focusSkill.isAcquired ? colors.primary + '15' : colors.background,
                borderColor: focusSkill.isAcquired ? colors.primary : colors.borderColor,
              },
            ]}
          >
            {focusSkill.isTarget ? (
              <Target size={32} color={colors.primary} />
            ) : (
              <Zap size={32} color={focusSkill.isAcquired ? colors.primary : colors.textTertiary} />
            )}
          </View>
          <Text style={[styles.focusSkillName, { color: colors.textPrimary }]}>
            {focusSkill.name}
          </Text>
          {focusSkill.level && (
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: getLevelColor(focusSkill.level) + '20' },
              ]}
            >
              <Text style={[styles.levelBadgeText, { color: getLevelColor(focusSkill.level) }]}>
                {getLevelLabel(focusSkill.level)}
              </Text>
            </View>
          )}
          {focusSkill.progress !== undefined && focusSkill.progress > 0 && (
            <View style={styles.progressSection}>
              <View style={[styles.progressBar, { backgroundColor: colors.borderColor }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: getLevelColor(focusSkill.level) || colors.primary,
                      width: `${focusSkill.progress}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {focusSkill.progress}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Summary */}
      {data.summary && (
        <Text style={[styles.summary, { color: colors.textSecondary }]}>
          {data.summary}
        </Text>
      )}

      {/* Prerequisites Section */}
      {prerequisites.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ArrowRight size={16} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Prérequis
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.skillsRow}>
              {prerequisites.map((skill) => renderSkillChip(skill, 'medium'))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Child Skills Section */}
      {childSkills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap size={16} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Sous-compétences
            </Text>
          </View>
          <View style={styles.skillsGrid}>
            {childSkills.map((skill) => renderSkillChip(skill))}
          </View>
        </View>
      )}

      {/* Related Skills Section */}
      {relatedSkills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={16} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Compétences connexes
            </Text>
          </View>
          <View style={styles.skillsGrid}>
            {relatedSkills.map((skill) => renderSkillChip(skill))}
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: colors.borderColor }]}>
        <View style={styles.legendItem}>
          <CheckCircle size={14} color={colors.success} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Acquise
          </Text>
        </View>
        <View style={styles.legendItem}>
          <Circle size={14} color={colors.textTertiary} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            À acquérir
          </Text>
        </View>
      </View>
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
  focusSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  focusSkillCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusSkillName: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  levelBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },
  levelBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    width: '60%',
    gap: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    minWidth: 36,
  },
  summary: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  section: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  skillsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER.radius.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  skillChipSmall: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  skillChipMedium: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  skillChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  skillChipTextSmall: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default SkillGraphView;
