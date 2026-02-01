/**
 * QuizBlock Component
 * Interactive quiz component showing questions one by one
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BookOpen, CheckCircle, XCircle, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
}

interface QuizBlockProps {
  data: {
    topic: string;
    questions: QuizQuestion[];
  };
}

export const QuizBlock: React.FC<QuizBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  const question = data.questions[currentQuestion];
  const isAnswered = revealedAnswers[currentQuestion];
  const selectedAnswer = selectedAnswers[currentQuestion];

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered) return;
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex });
  };

  const handleCheckAnswer = () => {
    setRevealedAnswers({ ...revealedAnswers, [currentQuestion]: true });
  };

  const handleNextQuestion = () => {
    if (currentQuestion < data.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BookOpen size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.topic, { color: colors.textPrimary }]}>
            {data.topic}
          </Text>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.progressText, { color: colors.primary }]}>
            {currentQuestion + 1}/{data.questions.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.borderColor }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${((currentQuestion + 1) / data.questions.length) * 100}%`,
            },
          ]}
        />
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: colors.textPrimary }]}>
        {question.question}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {question.options?.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const showCorrect = isAnswered && index === question.correctAnswer;
          const showWrong = isAnswered && isSelected && !isCorrect;

          let backgroundColor = colors.background;
          let borderColor = colors.borderColor;
          let textColor = colors.textPrimary;

          if (showCorrect) {
            backgroundColor = colors.successLight;
            borderColor = colors.success;
            textColor = colors.success;
          } else if (showWrong) {
            backgroundColor = colors.errorLight;
            borderColor = colors.error;
            textColor = colors.error;
          } else if (isSelected) {
            backgroundColor = colors.primary + '15';
            borderColor = colors.primary;
            textColor = colors.primary;
          }

          return (
            <TouchableOpacity
              key={index}
              style={[styles.option, { backgroundColor, borderColor }]}
              onPress={() => handleSelectOption(index)}
              disabled={isAnswered}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View
                  style={[
                    styles.radioButton,
                    { borderColor },
                    isSelected && { backgroundColor: borderColor },
                  ]}
                >
                  {isSelected && (
                    <View style={[styles.radioButtonInner, { backgroundColor: colors.white }]} />
                  )}
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>
                  {option}
                </Text>
              </View>
              {showCorrect && (
                <CheckCircle size={ICON.size.md} color={colors.success} strokeWidth={ICON.strokeWidth} />
              )}
              {showWrong && (
                <XCircle size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation */}
      {isAnswered && question.explanation && (
        <View style={[styles.explanationContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.explanationTitle, { color: colors.textPrimary }]}>
            Explication
          </Text>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {question.explanation}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!isAnswered && selectedAnswer !== undefined && (
          <TouchableOpacity
            style={[styles.checkButton, { backgroundColor: colors.primary }]}
            onPress={handleCheckAnswer}
            activeOpacity={0.8}
          >
            <Text style={[styles.checkButtonText, { color: colors.textOnPrimary }]}>
              Vérifier la réponse
            </Text>
          </TouchableOpacity>
        )}

        {isAnswered && (
          <View style={styles.navigationButtons}>
            {currentQuestion > 0 && (
              <TouchableOpacity
                style={[styles.navButton, { borderColor: colors.borderColor }]}
                onPress={handlePreviousQuestion}
                activeOpacity={0.7}
              >
                <Text style={[styles.navButtonText, { color: colors.textPrimary }]}>
                  Précédent
                </Text>
              </TouchableOpacity>
            )}
            {currentQuestion < data.questions.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton, { backgroundColor: colors.primary }]}
                onPress={handleNextQuestion}
                activeOpacity={0.8}
              >
                <Text style={[styles.navButtonText, { color: colors.textOnPrimary }]}>
                  Suivant
                </Text>
                <ChevronRight size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  topic: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },
  progressBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: BORDER.radius.xs,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER.radius.xs,
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
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: BORDER.radius.full,
    borderWidth: BORDER.width.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: BORDER.radius.full,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    flex: 1,
  },
  explanationContainer: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  explanationTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  explanationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  actions: {
    marginTop: SPACING.lg,
  },
  checkButton: {
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
  },
  checkButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    gap: SPACING.xs,
  },
  nextButton: {
    borderWidth: 0,
    flex: 1,
  },
  navButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
});

export default QuizBlock;
