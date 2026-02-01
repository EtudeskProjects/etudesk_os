/**
 * QuizCard Component
 * Interactive quiz component for skill assessment
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BookOpen, Trophy, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { QuizOutput, QuizQuestion } from '../../services/copilotService';

interface QuizCardProps {
  quiz: QuizOutput;
  onComplete?: (score: number, total: number) => void;
  onAnswerQuestion?: (questionId: string, answer: string | number) => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  onComplete,
  onAnswerQuestion,
}) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = quiz.questions[currentIndex];
  const selectedAnswer = answers[currentQuestion?.id];
  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer;

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== undefined) return; // Already answered

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
    onAnswerQuestion?.(currentQuestion.id, optionIndex);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
      const correctCount = quiz.questions.filter(
        (q) => answers[q.id] === q.correctAnswer
      ).length;
      onComplete?.(correctCount, quiz.questions.length);
    }
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setAnswers({});
    setShowResult(false);
    setShowExplanation(false);
  };

  if (showResult) {
    const correctCount = quiz.questions.filter(
      (q) => answers[q.id] === q.correctAnswer
    ).length;
    const percentage = Math.round((correctCount / quiz.questions.length) * 100);

    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View style={styles.resultContainer}>
          <Trophy
            size={48}
            color={percentage >= 70 ? colors.success : colors.warning}
          />
          <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
            Quiz terminé !
          </Text>
          <Text style={[styles.resultScore, { color: colors.primary }]}>
            {correctCount}/{quiz.questions.length}
          </Text>
          <Text style={[styles.resultPercentage, { color: colors.textSecondary }]}>
            {percentage}% de bonnes réponses
          </Text>

          {percentage >= 70 ? (
            <Text style={[styles.resultMessage, { color: colors.success }]}>
              Excellent ! Vous maîtrisez bien {quiz.skillName || 'ce sujet'}.
            </Text>
          ) : percentage >= 50 ? (
            <Text style={[styles.resultMessage, { color: colors.warning }]}>
              Pas mal ! Continuez à vous entraîner sur {quiz.skillName || 'ce sujet'}.
            </Text>
          ) : (
            <Text style={[styles.resultMessage, { color: colors.error }]}>
              Il y a des points à revoir sur {quiz.skillName || 'ce sujet'}.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.primary }]}
            onPress={resetQuiz}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>
              Recommencer
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BookOpen size={ICON.size.sm} color={colors.primary} />
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {quiz.title}
          </Text>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.progressText, { color: colors.primary }]}>
            {currentIndex + 1}/{quiz.questions.length}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.borderColor }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${((currentIndex + 1) / quiz.questions.length) * 100}%`,
            },
          ]}
        />
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: colors.textPrimary }]}>
        {currentQuestion.question}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentQuestion.options?.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const showCorrect = showExplanation && index === currentQuestion.correctAnswer;
          const showWrong = showExplanation && isSelected && !isCorrect;

          let backgroundColor: string = colors.background;
          let borderColor: string = colors.borderColor;
          let textColor: string = colors.textPrimary;

          if (showCorrect) {
            backgroundColor = colors.success + '15';
            borderColor = colors.success;
            textColor = colors.success;
          } else if (showWrong) {
            backgroundColor = colors.error + '15';
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
              onPress={() => handleSelect(index)}
              disabled={selectedAnswer !== undefined}
            >
              <View style={styles.optionContent}>
                <View
                  style={[
                    styles.optionIndex,
                    { backgroundColor: borderColor + '30', borderColor },
                  ]}
                >
                  <Text style={[styles.optionIndexText, { color: textColor }]}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>
                  {option}
                </Text>
              </View>
              {showCorrect && (
                <CheckCircle size={20} color={colors.success} />
              )}
              {showWrong && (
                <XCircle size={20} color={colors.error} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation */}
      {showExplanation && currentQuestion.explanation && (
        <View style={[styles.explanationContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.explanationTitle, { color: colors.textPrimary }]}>
            Explication:
          </Text>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {currentQuestion.explanation}
          </Text>
        </View>
      )}

      {/* Next button */}
      {showExplanation && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex < quiz.questions.length - 1 ? 'Question suivante' : 'Voir les résultats'}
          </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: SPACING.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  question: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.lg,
    lineHeight: 24,
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
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  optionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndexText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },
  explanationContainer: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
  },
  explanationTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },
  explanationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 20,
  },
  nextButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: '#fff',
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  resultTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.lg,
  },
  resultScore: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xxxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginTop: SPACING.md,
  },
  resultPercentage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  resultMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  retryButton: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
  },
  retryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});

export default QuizCard;
