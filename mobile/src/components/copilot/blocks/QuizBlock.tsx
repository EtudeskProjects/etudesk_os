/**
 * QuizBlock — Single interactive quiz question
 * Tapping an option auto-submits the answer via onAnswer callback
 * Creates a fluid back-and-forth conversational quiz experience
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';

interface QuizBlockProps {
  data: {
    topic: string;
    // New format: single question
    question?: string;
    options?: string[];
    // Backward compat: old format with questions array
    questions?: Array<{
      id?: string;
      question: string;
      options?: string[];
      correctAnswer?: number;
      explanation?: string;
    }>;
  };
  onAnswer?: (answer: string) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuizBlock: React.FC<QuizBlockProps> = ({ data, onAnswer }) => {
  const { colors } = useTheme();

  // Normalize data: support both new (single question) and old (questions array) format
  const { topic, question, options } = useMemo(() => {
    if (data.question && data.options) {
      return { topic: data.topic, question: data.question, options: data.options };
    }
    if (data.questions?.length) {
      const q = data.questions[0];
      return { topic: data.topic, question: q.question, options: q.options || [] };
    }
    return { topic: data.topic || '', question: '', options: [] as string[] };
  }, [data]);

  const handleOptionPress = (option: string, index: number) => {
    if (!onAnswer) return;
    onAnswer(`${OPTION_LETTERS[index]}) ${option}`);
  };

  if (!question) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <BookOpen size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.topic, { color: colors.primary }]} numberOfLines={1}>
          {topic}
        </Text>
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: colors.textPrimary }]}>
        {question}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              {
                borderColor: onAnswer ? colors.borderColor : withOpacity(colors.borderColor, OPACITY[50]),
                backgroundColor: colors.background,
              },
            ]}
            onPress={() => handleOptionPress(option, index)}
            disabled={!onAnswer}
            activeOpacity={0.7}
          >
            <View style={[styles.optionLetter, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.optionLetterText, { color: colors.primary }]}>
                {OPTION_LETTERS[index]}
              </Text>
            </View>
            <Text
              style={[
                styles.optionText,
                { color: onAnswer ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hint when not interactive */}
      {!onAnswer && (
        <Text style={[styles.answeredHint, { color: colors.textDisabled }]}>
          Question déjà répondue
        </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  topic: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  question: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.lg,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    gap: SPACING.md,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
  },
  answeredHint: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.sm,
  },
});

export default QuizBlock;
