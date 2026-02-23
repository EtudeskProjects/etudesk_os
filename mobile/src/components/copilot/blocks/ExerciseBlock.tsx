/**
 * ExerciseBlock — Interactive exercises: fill_gap, matching, ordering
 * Router pattern like ChartBlock — dispatches to sub-renderers by type
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CheckCircle2, XCircle, ArrowUp, ArrowDown, Shuffle } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { useI18n } from '../../../contexts/I18nContext';

// --- Types ---

interface FillGapData {
  type: 'fill_gap';
  instruction: string;
  template: string;
  gaps: Array<{ id: string; answer: string; options: string[] }>;
  explanation?: string;
}

interface MatchingData {
  type: 'matching';
  instruction: string;
  pairs: Array<{ left: string; right: string }>;
  explanation?: string;
}

interface OrderingData {
  type: 'ordering';
  instruction: string;
  items: string[];
  correctOrder: number[];
  explanation?: string;
}

type ExerciseData = FillGapData | MatchingData | OrderingData;

interface ExerciseBlockProps {
  data: ExerciseData;
  onAnswer?: (answer: string) => void;
}

// --- Fill Gap Exercise ---

const FillGapExercise: React.FC<{ data: FillGapData; onAnswer?: (answer: string) => void }> = ({
  data,
  onAnswer,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [selections, setSelections] = useState<Record<string, string | null>>({});
  const [validated, setValidated] = useState(false);
  const [activeGapId, setActiveGapId] = useState<string | null>(null);

  const allFilled = data.gaps.length > 0 && data.gaps.every((g) => selections[g.id]);

  const handleSelectOption = useCallback(
    (gapId: string, option: string) => {
      if (validated) return;
      setSelections((prev) => ({ ...prev, [gapId]: option }));
      setActiveGapId(null);
    },
    [validated]
  );

  const handleValidate = useCallback(() => {
    setValidated(true);
    const correct = data.gaps.filter((g) => selections[g.id] === g.answer).length;
    onAnswer?.(`fill_gap: ${correct}/${data.gaps.length} correct`);
  }, [data.gaps, selections, onAnswer]);

  const isCorrect = (gapId: string) => {
    const gap = data.gaps.find((g) => g.id === gapId);
    return gap && selections[gapId] === gap.answer;
  };

  // Render template with gaps
  const renderTemplate = () => {
    const parts = data.template.split(/(\{\{\d+\}\})/);
    return (
      <Text style={[styles.templateText, { color: colors.textPrimary }]}>
        {parts.map((part, i) => {
          const gapMatch = part.match(/\{\{(\d+)\}\}/);
          if (!gapMatch) return <Text key={i}>{part}</Text>;

          const gapId = gapMatch[1];
          const selected = selections[gapId];
          const correct = validated ? isCorrect(gapId) : null;

          return (
            <Text
              key={i}
              style={[
                styles.gapText,
                {
                  backgroundColor: validated
                    ? correct
                      ? withOpacity(colors.success, OPACITY[20])
                      : withOpacity(colors.error, OPACITY[20])
                    : selected
                      ? withOpacity(colors.primary, OPACITY[15])
                      : withOpacity(colors.borderColor, OPACITY[50]),
                  borderColor: validated
                    ? correct
                      ? colors.success
                      : colors.error
                    : selected
                      ? colors.primary
                      : colors.borderColor,
                  color: selected ? colors.textPrimary : colors.textDisabled,
                },
              ]}
              onPress={() => !validated && setActiveGapId(gapId)}
            >
              {selected || '______'}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <View>
      <Text style={[styles.instruction, { color: colors.textPrimary }]}>{data.instruction}</Text>
      <View style={{ marginVertical: SPACING.sm }}>{renderTemplate()}</View>

      {/* Options for active gap */}
      {activeGapId && !validated && (
        <View style={styles.optionsGrid}>
          {data.gaps
            .find((g) => g.id === activeGapId)
            ?.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor:
                      selections[activeGapId] === opt
                        ? withOpacity(colors.primary, OPACITY[15])
                        : colors.background,
                    borderColor:
                      selections[activeGapId] === opt ? colors.primary : colors.borderColor,
                  },
                ]}
                onPress={() => handleSelectOption(activeGapId, opt)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    {
                      color:
                        selections[activeGapId] === opt ? colors.primary : colors.textPrimary,
                    },
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
        </View>
      )}

      {/* Validate button */}
      {allFilled && !validated && (
        <Pressable
          style={[styles.validateButton, { backgroundColor: colors.primary }]}
          onPress={handleValidate}
        >
          <Text style={[styles.validateText, { color: colors.white }]}>{t('common.validate')}</Text>
        </Pressable>
      )}

      {/* Explanation */}
      {validated && data.explanation && (
        <ExplanationBox
          correct={data.gaps.every((g) => selections[g.id] === g.answer)}
          explanation={data.explanation}
        />
      )}
    </View>
  );
};

// --- Matching Exercise ---

// Pair colors for matching visual indicators
const PAIR_COLORS = ['#E07A5F', '#3D85C6', '#81B29A', '#F2CC8F', '#9B72AA', '#E8A87C', '#5B8C5A', '#D4A5A5'];

const MatchingExercise: React.FC<{ data: MatchingData; onAnswer?: (answer: string) => void }> = ({
  data,
  onAnswer,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({}); // leftIdx → rightIdx
  const [validated, setValidated] = useState(false);

  // Shuffle right side (stable via useMemo-like approach with useState)
  const [shuffledRight] = useState(() => {
    const indices = data.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });

  const allMatched = data.pairs.length > 0 && Object.keys(matches).length === data.pairs.length;

  // Get the pair number for a left index (1-based, in order of matching)
  const getPairNumber = (leftIdx: number): number | null => {
    if (matches[leftIdx] === undefined) return null;
    const matchedKeys = Object.keys(matches).map(Number).sort((a, b) => a - b);
    return matchedKeys.indexOf(leftIdx) + 1;
  };

  // Get the pair number for a right actual index
  const getRightPairNumber = (actualRightIdx: number): number | null => {
    const entry = Object.entries(matches).find(([, r]) => r === actualRightIdx);
    if (!entry) return null;
    return getPairNumber(Number(entry[0]));
  };

  // Get pair color by pair number
  const getPairColor = (pairNum: number): string => PAIR_COLORS[(pairNum - 1) % PAIR_COLORS.length];

  const handleLeftPress = useCallback(
    (idx: number) => {
      if (validated) return;
      // Toggle: deselect if already selected
      setSelectedLeft((prev) => (prev === idx ? null : idx));
    },
    [validated]
  );

  const handleRightPress = useCallback(
    (rightShuffledIdx: number) => {
      if (validated || selectedLeft === null) return;
      const actualRightIdx = shuffledRight[rightShuffledIdx];
      // Remove any previous match pointing to this right item
      setMatches((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === actualRightIdx) delete next[Number(k)];
        }
        next[selectedLeft] = actualRightIdx;
        return next;
      });
      setSelectedLeft(null);
    },
    [validated, selectedLeft, shuffledRight]
  );

  const handleValidate = useCallback(() => {
    setValidated(true);
    const correct = Object.entries(matches).filter(
      ([left, right]) => Number(left) === right
    ).length;
    onAnswer?.(`matching: ${correct}/${data.pairs.length} correct`);
  }, [matches, data.pairs.length, onAnswer]);

  const getValidationColor = (leftIdx: number) => {
    return leftIdx === matches[leftIdx] ? colors.success : colors.error;
  };

  // Check if a right index is already matched
  const isRightMatched = (actualRightIdx: number) =>
    Object.values(matches).includes(actualRightIdx);

  return (
    <View>
      <Text style={[styles.instruction, { color: colors.textPrimary }]}>{data.instruction}</Text>

      <View style={styles.matchingContainer}>
        {/* Left column */}
        <View style={styles.matchColumn}>
          {data.pairs.map((pair, i) => {
            const pairNum = getPairNumber(i);
            const pairColor = pairNum ? getPairColor(pairNum) : null;
            const isSelected = selectedLeft === i;
            const isMatched = matches[i] !== undefined;

            return (
              <Pressable
                key={i}
                style={[
                  styles.matchItem,
                  {
                    backgroundColor: validated && isMatched
                      ? withOpacity(getValidationColor(i), OPACITY[10])
                      : isSelected
                        ? withOpacity(colors.primary, OPACITY[15])
                        : isMatched && pairColor
                          ? withOpacity(pairColor, OPACITY[10])
                          : colors.background,
                    borderColor: validated && isMatched
                      ? getValidationColor(i)
                      : isSelected
                        ? colors.primary
                        : isMatched && pairColor
                          ? pairColor
                          : colors.borderColor,
                  },
                ]}
                onPress={() => handleLeftPress(i)}
                disabled={validated}
              >
                {isMatched && pairNum && (
                  <View style={[styles.pairBadge, { backgroundColor: validated ? getValidationColor(i) : pairColor! }]}>
                    <Text style={styles.pairBadgeText}>{pairNum}</Text>
                  </View>
                )}
                <Text style={[styles.matchText, { color: colors.textPrimary }]}>{pair.left}</Text>
                {validated && isMatched && (
                  matches[i] === i ? (
                    <CheckCircle2 size={14} color={colors.success} />
                  ) : (
                    <XCircle size={14} color={colors.error} />
                  )
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Right column */}
        <View style={styles.matchColumn}>
          {shuffledRight.map((actualIdx, shuffledIdx) => {
            const pairNum = getRightPairNumber(actualIdx);
            const pairColor = pairNum ? getPairColor(pairNum) : null;
            const matched = isRightMatched(actualIdx);
            // Find leftIdx for validation color
            const matchedLeftIdx = matched
              ? Number(Object.entries(matches).find(([, r]) => r === actualIdx)?.[0])
              : null;

            return (
              <Pressable
                key={shuffledIdx}
                style={[
                  styles.matchItem,
                  {
                    backgroundColor: validated && matched && matchedLeftIdx !== null
                      ? withOpacity(getValidationColor(matchedLeftIdx), OPACITY[10])
                      : matched && pairColor
                        ? withOpacity(pairColor, OPACITY[10])
                        : colors.background,
                    borderColor: validated && matched && matchedLeftIdx !== null
                      ? getValidationColor(matchedLeftIdx)
                      : matched && pairColor
                        ? pairColor
                        : colors.borderColor,
                  },
                ]}
                onPress={() => handleRightPress(shuffledIdx)}
                disabled={validated}
              >
                {matched && pairNum && (
                  <View style={[styles.pairBadge, { backgroundColor: validated && matchedLeftIdx !== null ? getValidationColor(matchedLeftIdx) : pairColor! }]}>
                    <Text style={styles.pairBadgeText}>{pairNum}</Text>
                  </View>
                )}
                <Text style={[styles.matchText, { color: colors.textPrimary }]}>
                  {data.pairs[actualIdx].right}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {allMatched && !validated && (
        <Pressable
          style={[styles.validateButton, { backgroundColor: colors.primary }]}
          onPress={handleValidate}
        >
          <Text style={[styles.validateText, { color: colors.white }]}>{t('common.validate')}</Text>
        </Pressable>
      )}

      {validated && data.explanation && (
        <ExplanationBox
          correct={Object.entries(matches).every(([l, r]) => Number(l) === r)}
          explanation={data.explanation}
        />
      )}
    </View>
  );
};

// --- Ordering Exercise ---

const OrderingExercise: React.FC<{ data: OrderingData; onAnswer?: (answer: string) => void }> = ({
  data,
  onAnswer,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [order, setOrder] = useState(() => {
    // Shuffle initial order
    const indices = data.items.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });
  const [validated, setValidated] = useState(false);

  const moveUp = useCallback(
    (pos: number) => {
      if (validated || pos === 0) return;
      setOrder((prev) => {
        const next = [...prev];
        [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
        return next;
      });
    },
    [validated]
  );

  const moveDown = useCallback(
    (pos: number) => {
      if (validated || pos === order.length - 1) return;
      setOrder((prev) => {
        const next = [...prev];
        [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
        return next;
      });
    },
    [validated, order.length]
  );

  const handleValidate = useCallback(() => {
    setValidated(true);
    const isAllCorrect = order.every((itemIdx, pos) => itemIdx === data.correctOrder[pos]);
    const correct = order.filter((itemIdx, pos) => itemIdx === data.correctOrder[pos]).length;
    onAnswer?.(`ordering: ${correct}/${data.items.length} correct, all_correct=${isAllCorrect}`);
  }, [order, data.correctOrder, data.items.length, onAnswer]);

  const isPositionCorrect = (pos: number) => order[pos] === data.correctOrder[pos];

  return (
    <View>
      <Text style={[styles.instruction, { color: colors.textPrimary }]}>{data.instruction}</Text>

      <View style={{ gap: SPACING.xs, marginVertical: SPACING.sm }}>
        {order.map((itemIdx, pos) => (
          <View
            key={itemIdx}
            style={[
              styles.orderItem,
              {
                backgroundColor: validated
                  ? isPositionCorrect(pos)
                    ? withOpacity(colors.success, OPACITY[10])
                    : withOpacity(colors.error, OPACITY[10])
                  : colors.background,
                borderColor: validated
                  ? isPositionCorrect(pos)
                    ? colors.success
                    : colors.error
                  : colors.borderColor,
              },
            ]}
          >
            <View style={[styles.orderNumber, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.orderNumberText, { color: colors.primary }]}>{pos + 1}</Text>
            </View>
            <Text style={[styles.orderText, { color: colors.textPrimary }]}>
              {data.items[itemIdx]}
            </Text>
            {!validated && (
              <View style={styles.orderActions}>
                <Pressable onPress={() => moveUp(pos)} disabled={pos === 0}>
                  <ArrowUp
                    size={ICON.size.sm}
                    color={pos === 0 ? colors.textDisabled : colors.textSecondary}
                  />
                </Pressable>
                <Pressable onPress={() => moveDown(pos)} disabled={pos === order.length - 1}>
                  <ArrowDown
                    size={ICON.size.sm}
                    color={pos === order.length - 1 ? colors.textDisabled : colors.textSecondary}
                  />
                </Pressable>
              </View>
            )}
            {validated && (
              isPositionCorrect(pos) ? (
                <CheckCircle2 size={ICON.size.sm} color={colors.success} />
              ) : (
                <XCircle size={ICON.size.sm} color={colors.error} />
              )
            )}
          </View>
        ))}
      </View>

      {!validated && (
        <Pressable
          style={[styles.validateButton, { backgroundColor: colors.primary }]}
          onPress={handleValidate}
        >
          <Text style={[styles.validateText, { color: colors.white }]}>{t('common.validateOrder')}</Text>
        </Pressable>
      )}

      {validated && data.explanation && (
        <ExplanationBox
          correct={order.every((itemIdx, pos) => itemIdx === data.correctOrder[pos])}
          explanation={data.explanation}
        />
      )}
    </View>
  );
};

// --- Explanation Box (shared) ---

const ExplanationBox: React.FC<{ correct: boolean; explanation: string }> = ({
  correct,
  explanation,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.explanationContainer,
        {
          backgroundColor: correct
            ? withOpacity(colors.success, OPACITY[5])
            : withOpacity(colors.error, OPACITY[5]),
          borderColor: correct
            ? withOpacity(colors.success, OPACITY[20])
            : withOpacity(colors.error, OPACITY[20]),
        },
      ]}
    >
      <View style={styles.explanationHeader}>
        {correct ? (
          <CheckCircle2 size={ICON.size.sm} color={colors.success} />
        ) : (
          <XCircle size={ICON.size.sm} color={colors.error} />
        )}
        <Text
          style={[
            styles.explanationTitle,
            { color: correct ? colors.success : colors.error },
          ]}
        >
          {correct ? t('exercise.correct') : t('exercise.incorrect')}
        </Text>
      </View>
      <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
        {explanation}
      </Text>
    </View>
  );
};

// --- Router ---

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({ data, onAnswer }) => {
  const { colors } = useTheme();
  const { t } = useI18n();

  const renderExercise = () => {
    switch (data.type) {
      case 'fill_gap':
        return <FillGapExercise data={data} onAnswer={onAnswer} />;
      case 'matching':
        return <MatchingExercise data={data} onAnswer={onAnswer} />;
      case 'ordering':
        return <OrderingExercise data={data} onAnswer={onAnswer} />;
      default:
        return (
          <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.textDisabled }}>
            {t('exercise.unsupportedType')}{String((data as any)?.type || 'inconnu')}
          </Text>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <Shuffle size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.headerText, { color: colors.primary }]}>{t('exercise.title')}</Text>
      </View>
      {renderExercise()}
    </View>
  );
};

// --- Styles ---

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
  headerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  instruction: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
    marginBottom: SPACING.sm,
  },
  // Fill gap
  templateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 2,
  },
  gapText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginVertical: SPACING.sm,
  },
  optionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  optionChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Matching
  matchingContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  matchColumn: {
    flex: 1,
    gap: SPACING.xs,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    gap: SPACING.xs,
    minHeight: 44,
  },
  matchText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  pairBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  // Ordering
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },
  orderNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  orderText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  orderActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  // Shared
  validateButton: {
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  validateText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
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
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
});

export default ExerciseBlock;
