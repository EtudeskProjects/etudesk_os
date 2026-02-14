/**
 * FlashcardBlock Component
 * Flip card component with front/back sides
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';


interface FlashcardBlockProps {
  data: {
    topic: string;
    front: string;
    back: string;
    difficulty: string;
  };
}

export const FlashcardBlock: React.FC<FlashcardBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
      case 'facile':
        return colors.success;
      case 'medium':
      case 'moyen':
        return colors.warning;
      case 'hard':
      case 'difficile':
        return colors.error;
      default:
        return colors.info;
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'Facile';
      case 'medium':
        return 'Moyen';
      case 'hard':
        return 'Difficile';
      default:
        return difficulty;
    }
  };

  const difficultyColor = getDifficultyColor(data.difficulty);
  const difficultyLabel = getDifficultyLabel(data.difficulty);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.topic, { color: colors.textSecondary }]}>
          {data.topic}
        </Text>
        <View style={[styles.difficultyBadge, { backgroundColor: withOpacity(difficultyColor, OPACITY[15]) }]}>
          <Text style={[styles.difficultyText, { color: difficultyColor }]}>
            {difficultyLabel}
          </Text>
        </View>
      </View>

      {/* Card */}
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: isFlipped ? withOpacity(colors.primary, OPACITY[10]) : colors.surface,
            borderColor: isFlipped ? colors.primary : colors.borderColor,
          },
        ]}
        onPress={handleFlip}
        accessibilityRole="button"
        accessibilityLabel="Retourner la carte"
      >
        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            {isFlipped ? 'Réponse' : 'Question'}
          </Text>
          <Text style={[styles.cardText, { color: colors.textPrimary }]}>
            {isFlipped ? data.back : data.front}
          </Text>
        </View>

        {/* Flip Indicator */}
        <View style={styles.flipIndicator}>
          <RotateCw
            size={ICON.size.sm}
            color={isFlipped ? colors.primary : colors.textTertiary}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[styles.flipText, { color: isFlipped ? colors.primary : colors.textTertiary }]}>
            Toucher pour {isFlipped ? 'revenir' : 'révéler'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  topic: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  difficultyBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },
  difficultyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  card: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.xl,
    minHeight: 200,
    justifyContent: 'center',
  },
  cardContent: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wider,
  },
  cardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.normal,
  },
  flipIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  flipText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default FlashcardBlock;
