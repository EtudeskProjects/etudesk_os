/**
 * ExerciseBlock — Interactive exercises: fill_gap, matching, ordering
 * Router pattern like ChartBlock — dispatches to sub-renderers by type
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CheckCircle2, XCircle, ArrowUp, ArrowDown, Shuffle } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';

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
  const [selections, setSelections] = useState<Record<string, string | null>>({});
  const [validated, setValidated] = useState(false);
  const [activeGapId, setActiveGapId] = useState<string | null>(null);

  const allFilled = data.gaps.every((g) => selections[g.id]);

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
          <Text style={[styles.validateText, { color: colors.white }]}>Valider</Text>
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

const MatchingExercise: React.FC<{ data: MatchingData; onAnswer?: (answer: string) => void }> = ({
  data,
  onAnswer,
}) => {
  const { colors } = useTheme();
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

  const allMatched = Object.keys(matches).length === data.pairs.length;

  const handleLeftPress = useCallback(
    (idx: number) => {
      if (validated) return;
      setSelectedLeft(idx);
    },
    [validated]
  );

  const handleRightPress = useCallback(
    (rightShuffledIdx: number) => {
      if (validated || selectedLeft === null) return;
      const actualRightIdx = shuffledRight[rightShuffledIdx];
      setMatches((prev) => ({ ...prev, [selectedLeft]: actualRightIdx }));
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

  const getMatchColor = (leftIdx: number) => {
    if (!validated) return colors.primary;
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
          {data.pairs.map((pair, i) => (
            <Pressable
              key={i}
              style={[
                styles.matchItem,
                {
                  backgroundColor:
                    selectedLeft === i
                      ? withOpacity(colors.primary, OPACITY[15])
                      : matches[i] !== undefined
                        ? withOpacity(getMatchColor(i), OPACITY[10])
                        : colors.background,
                  borderColor:
                    selectedLeft === i
                      ? colors.primary
                      : matches[i] !== undefined
                        ? getMatchColor(i)
                        : colors.borderColor,
                },
              ]}
              onPress={() => handleLeftPress(i)}
            >
              <Text style={[styles.matchText, { color: colors.textPrimary }]}>{pair.left}</Text>
              {validated && matches[i] !== undefined && (
                matches[i] === i ? (
                  <CheckCircle2 size={14} color={colors.success} />
                ) : (
                  <XCircle size={14} color={colors.error} />
                )
              )}
            </Pressable>
          ))}
        </View>

        {/* Right column */}
        <View style={styles.matchColumn}>
          {shuffledRight.map((actualIdx, shuffledIdx) => (
            <Pressable
              key={shuffledIdx}
              style={[
                styles.matchItem,
                {
                  backgroundColor: isRightMatched(actualIdx)
                    ? withOpacity(colors.primary, OPACITY[5])
                    : colors.background,
                  borderColor: isRightMatched(actualIdx)
                    ? withOpacity(colors.primary, OPACITY[30])
                    : colors.borderColor,
                },
              ]}
              onPress={() => handleRightPress(shuffledIdx)}
              disabled={validated}
            >
              <Text style={[styles.matchText, { color: colors.textPrimary }]}>
                {data.pairs[actualIdx].right}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {allMatched && !validated && (
        <Pressable
          style={[styles.validateButton, { backgroundColor: colors.primary }]}
          onPress={handleValidate}
        >
          <Text style={[styles.validateText, { color: colors.white }]}>Valider</Text>
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
          <Text style={[styles.validateText, { color: colors.white }]}>Valider l'ordre</Text>
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
          {correct ? 'Parfait !' : 'Pas tout à fait'}
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

  const renderExercise = () => {
    switch (data.type) {
      case 'fill_gap':
        return <FillGapExercise data={data} onAnswer={onAnswer} />;
      case 'matching':
        return <MatchingExercise data={data} onAnswer={onAnswer} />;
      case 'ordering':
        return <OrderingExercise data={data} onAnswer={onAnswer} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <Shuffle size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.headerText, { color: colors.primary }]}>Exercice interactif</Text>
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
