/**
 * FlashcardBlock Component
 * Flip card component with front/back sides
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';


interface FlashcardBlockProps {
  data: {
    topic: string;
    front: string;
    back: string;
    difficulty: string;
  };
}

function sanitizeText(value: unknown, max = 240): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export const FlashcardBlock: React.FC<FlashcardBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [isFlipped, setIsFlipped] = useState(false);

  const topic = sanitizeText(data.topic, 48);
  const front = sanitizeText(data.front, 260);
  const back = sanitizeText(data.back, 260);
  const canFlip = Boolean(back && back !== front);

  const handleFlip = () => {
    if (!canFlip) return;
    setIsFlipped(!isFlipped);
  };

  if (!front && !back) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  const visibleTopic = topic && topic !== front && topic !== back ? topic : undefined;
  const visibleText = isFlipped && canFlip ? back : (front || back)!;

  return (
    <View style={styles.container}>
      {visibleTopic ? (
        <View style={styles.header}>
          <Text style={[styles.topic, { color: colors.textSecondary }]} numberOfLines={1}>
            {visibleTopic}
          </Text>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: isFlipped && canFlip ? withOpacity(colors.primary, OPACITY[10]) : colors.surface,
            borderColor: isFlipped && canFlip ? colors.primary : colors.borderColor,
          },
        ]}
        onPress={handleFlip}
        disabled={!canFlip}
        accessibilityRole="button"
        accessibilityLabel={t('copilot.flashcard.flipCard')}
      >
        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            {isFlipped && canFlip ? t('copilot.flashcard.answer') : t('copilot.flashcard.question')}
          </Text>
          <Text style={[styles.cardText, { color: colors.textPrimary }]}>
            {visibleText}
          </Text>
        </View>

        {canFlip ? (
          <View style={styles.flipIndicator}>
            <RotateCw
              size={ICON.size.sm}
              color={isFlipped ? colors.primary : colors.textTertiary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={[styles.flipText, { color: isFlipped ? colors.primary : colors.textTertiary }]}>
              {isFlipped ? t('copilot.flashcard.tapToReturn') : t('copilot.flashcard.tapToReveal')}
            </Text>
          </View>
        ) : null}
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
    marginBottom: SPACING.sm,
  },
  topic: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    minHeight: 168,
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
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
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
  emptyContainer: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default FlashcardBlock;
