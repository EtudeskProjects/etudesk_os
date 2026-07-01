/**
 * QuizBlock — Single interactive quiz question
 * Tapping an option shows green/red feedback + explanation, then auto-submits via onAnswer
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';


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

function sanitizeText(value: unknown, max = 220): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export const QuizBlock: React.FC<QuizBlockProps> = ({ data, onAnswer }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Normalize data + shuffle options at render time (stable via useMemo)
  const { topic, question, options, correctAnswer, explanation } = useMemo(() => {
    let rawTopic = '';
    let rawQuestion = '';
    let rawOptions: string[] = [];
    let rawCorrect = -1;
    let rawExplanation = '';

    if (data.question && data.options) {
      rawTopic = data.topic;
      rawQuestion = data.question;
      rawOptions = data.options;
      rawCorrect = data.correctAnswer ?? -1;
      rawExplanation = data.explanation || '';
    } else if (data.questions?.length) {
      const q = data.questions[0];
      rawTopic = data.topic;
      rawQuestion = q.question;
      rawOptions = q.options || [];
      rawCorrect = q.correctAnswer ?? -1;
      rawExplanation = q.explanation || '';
    } else {
      return { topic: '', question: '', options: [] as string[], correctAnswer: -1, explanation: '' };
    }

    const topic = sanitizeText(rawTopic, 48);
    const question = sanitizeText(rawQuestion, 220) || '';
    const explanation = sanitizeText(rawExplanation, 260);
    const correctOptionText =
      rawCorrect >= 0 && rawCorrect < rawOptions.length ? sanitizeText(rawOptions[rawCorrect], 120) : undefined;

    const sanitizedOptions = rawOptions
      .map((option, index) => ({ text: sanitizeText(option, 120), index }))
      .filter((option): option is { text: string; index: number } => Boolean(option.text))
      .reduce<{ text: string; index: number }[]>((acc, option) => {
        if (acc.some((entry) => entry.text.toLowerCase() === option.text.toLowerCase())) return acc;
        acc.push(option);
        return acc;
      }, [])
      .slice(0, OPTION_LETTERS.length);

    const sanitizedCorrect = sanitizedOptions.findIndex((option) => option.index === rawCorrect);
    const resolvedCorrect =
      sanitizedCorrect >= 0
        ? sanitizedCorrect
        : correctOptionText
          ? sanitizedOptions.findIndex((option) => option.text.toLowerCase() === correctOptionText.toLowerCase())
          : -1;

    // Shuffle options with Fisher-Yates and remap correctAnswer
    const indices = sanitizedOptions.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const shuffledOptions = indices.map((i) => sanitizedOptions[i].text);
    const newCorrect = resolvedCorrect >= 0 ? indices.indexOf(resolvedCorrect) : -1;

    return {
      topic: topic && topic !== question ? topic : '',
      question,
      options: shuffledOptions,
      correctAnswer: newCorrect,
      explanation: explanation && explanation !== question ? explanation : '',
    };
  }, [data]);

  const answered = selectedIndex !== null;
  const hasCorrectAnswer = correctAnswer >= 0 && correctAnswer < options.length;
  const hasOptions = options.length >= 2;

  const handleOptionPress = (option: string, index: number) => {
    if (answered || !onAnswer || !hasOptions) return;
    setSelectedIndex(index);
    // Options are SHUFFLED for display, so the letter index is meaningless to the
    // agent (its original ordering differs). Submit the chosen TEXT + the verdict
    // computed here (we know the remapped correctAnswer) so the agent's feedback
    // matches the on-screen green/red result instead of re-grading from a letter.
    const submissionKey = hasCorrectAnswer
      ? index === correctAnswer
        ? 'copilot.quiz.submissionCorrect'
        : 'copilot.quiz.submissionIncorrect'
      : 'copilot.quiz.submissionRecorded';
    onAnswer(t(submissionKey, { option }));
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

  if (!question) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  const isCorrectAnswer = hasCorrectAnswer && selectedIndex === correctAnswer;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {topic ? (
        <View style={styles.header}>
          <BookOpen size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.topic, { color: colors.primary }]} numberOfLines={1}>
            {topic}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.question, { color: colors.textPrimary }]}>
        {question}
      </Text>

      {hasOptions ? (
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            const optStyle = getOptionStyle(index);
            const letterStyle = getLetterStyle(index);
            const isSelected = answered && index === selectedIndex;
            const isCorrect = answered && index === correctAnswer;

            return (
              <Pressable
                key={`${OPTION_LETTERS[index]}-${option}`}
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
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      )}

      {answered && hasCorrectAnswer && explanation ? (
        <View style={[styles.explanationContainer, { backgroundColor: isCorrectAnswer ? withOpacity(colors.success, OPACITY[5]) : withOpacity(colors.error, OPACITY[5]), borderColor: isCorrectAnswer ? withOpacity(colors.success, OPACITY[20]) : withOpacity(colors.error, OPACITY[20]) }]}>
          <View style={styles.explanationHeader}>
            {isCorrectAnswer ? (
              <CheckCircle2 size={ICON.size.sm} color={colors.success} strokeWidth={ICON.strokeWidth} />
            ) : (
              <XCircle size={ICON.size.sm} color={colors.error} strokeWidth={ICON.strokeWidth} />
            )}
            <Text style={[styles.explanationTitle, { color: isCorrectAnswer ? colors.success : colors.error }]}>
              {isCorrectAnswer ? t('copilot.quiz.correctAnswer') : t('copilot.quiz.wrongAnswer')}
            </Text>
          </View>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {explanation}
          </Text>
        </View>
      ) : null}

      {!onAnswer && !answered && hasOptions && (
        <Text style={[styles.answeredHint, { color: colors.textDisabled }]}>
          {t('copilot.quiz.alreadyAnswered')}
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
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  question: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.md,
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
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default QuizBlock;
