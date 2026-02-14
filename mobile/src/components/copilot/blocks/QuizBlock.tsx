/**
 * QuizBlock — Single interactive quiz question
 * Tapping an option shows green/red feedback + explanation, then auto-submits via onAnswer
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';


interface QuizBlockProps {
  data: {
    topic: string;
    question?: string;
    options?: string[];
    correctAnswer?: number;
    explanation?: string;
    // Backward compat: old format
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Normalize data: support both new and old format
  const { topic, question, options, correctAnswer, explanation } = useMemo(() => {
    if (data.question && data.options) {
      return {
        topic: data.topic,
        question: data.question,
        options: data.options,
        correctAnswer: data.correctAnswer ?? -1,
        explanation: data.explanation || '',
      };
    }
    if (data.questions?.length) {
      const q = data.questions[0];
      return {
        topic: data.topic,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer ?? -1,
        explanation: q.explanation || '',
      };
    }
    return { topic: data.topic || '', question: '', options: [] as string[], correctAnswer: -1, explanation: '' };
  }, [data]);

  const answered = selectedIndex !== null;
  const hasCorrectAnswer = correctAnswer >= 0 && correctAnswer < options.length;

  const handleOptionPress = (option: string, index: number) => {
    if (answered || !onAnswer) return;
    setSelectedIndex(index);
    onAnswer(`${OPTION_LETTERS[index]}) ${option}`);
  };

  const getOptionStyle = (index: number) => {
    if (!answered) {
      return {
        borderColor: onAnswer ? colors.borderColor : withOpacity(colors.borderColor, OPACITY[50]),
        backgroundColor: colors.background,
      };
    }

    const isSelected = index === selectedIndex;
    const isCorrect = index === correctAnswer;

    if (hasCorrectAnswer) {
      if (isCorrect) {
        return {
          borderColor: colors.success,
          backgroundColor: withOpacity(colors.success, OPACITY[10]),
        };
      }
      if (isSelected && !isCorrect) {
        return {
          borderColor: colors.error,
          backgroundColor: withOpacity(colors.error, OPACITY[10]),
        };
      }
    } else if (isSelected) {
      // No correctAnswer provided — just highlight selection neutrally
      return {
        borderColor: colors.primary,
        backgroundColor: withOpacity(colors.primary, OPACITY[10]),
      };
    }

    return {
      borderColor: withOpacity(colors.borderColor, OPACITY[30]),
      backgroundColor: colors.background,
    };
  };

  const getLetterStyle = (index: number) => {
    if (!answered) {
      return {
        bg: withOpacity(colors.primary, OPACITY[10]),
        text: colors.primary,
      };
    }

    const isSelected = index === selectedIndex;
    const isCorrect = index === correctAnswer;

    if (hasCorrectAnswer) {
      if (isCorrect) return { bg: colors.success, text: colors.white };
      if (isSelected && !isCorrect) return { bg: colors.error, text: colors.white };
    } else if (isSelected) {
      return { bg: colors.primary, text: colors.white };
    }

    return {
      bg: withOpacity(colors.gray400, OPACITY[20]),
      text: colors.textDisabled,
    };
  };

  if (!question) return null;

  const isCorrectAnswer = hasCorrectAnswer && selectedIndex === correctAnswer;

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
        {options.map((option, index) => {
          const optStyle = getOptionStyle(index);
          const letterStyle = getLetterStyle(index);
          const isSelected = answered && index === selectedIndex;
          const isCorrect = answered && index === correctAnswer;

          return (
            <Pressable
              key={index}
              style={[styles.option, optStyle]}
              onPress={() => handleOptionPress(option, index)}
              disabled={answered || !onAnswer}
              accessibilityRole="button"
              accessibilityLabel={`Option ${OPTION_LETTERS[index]}: ${option}`}
            >
              <View style={[styles.optionLetter, { backgroundColor: letterStyle.bg }]}>
                <Text style={[styles.optionLetterText, { color: letterStyle.text }]}>
                  {OPTION_LETTERS[index]}
                </Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    color: answered && !isSelected && !isCorrect ? colors.textDisabled : colors.textPrimary,
                    fontFamily: isSelected || isCorrect ? TYPOGRAPHY.fontFamily.medium : TYPOGRAPHY.fontFamily.regular,
                  },
                ]}
              >
                {option}
              </Text>
              {answered && hasCorrectAnswer && isCorrect && (
                <CheckCircle2 size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
              )}
              {answered && hasCorrectAnswer && isSelected && !isCorrect && (
                <XCircle size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Explanation */}
      {answered && hasCorrectAnswer && explanation ? (
        <View style={[styles.explanationContainer, { backgroundColor: isCorrectAnswer ? withOpacity(colors.success, OPACITY[5]) : withOpacity(colors.error, OPACITY[5]), borderColor: isCorrectAnswer ? withOpacity(colors.success, OPACITY[20]) : withOpacity(colors.error, OPACITY[20]) }]}>
          <View style={styles.explanationHeader}>
            {isCorrectAnswer ? (
              <CheckCircle2 size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
            ) : (
              <XCircle size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />
            )}
            <Text style={[styles.explanationTitle, { color: isCorrectAnswer ? colors.success : colors.error }]}>
              {isCorrectAnswer ? 'Bonne réponse !' : 'Mauvaise réponse'}
            </Text>
          </View>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {explanation}
          </Text>
        </View>
      ) : null}

      {/* Hint when not interactive and not answered locally */}
      {!onAnswer && !answered && (
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
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
  },
  explanationContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  explanationTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  explanationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  answeredHint: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.sm,
  },
});

export default QuizBlock;
