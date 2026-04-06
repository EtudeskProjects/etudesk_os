/**
 * TableChart Component — Scrollable data table with alternating rows
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, OPACITY, withOpacity } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';
import { getCurrentLocale } from '../../../../i18n';

interface TableChartProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export const TableChart: React.FC<TableChartProps> = ({ title, columns, rows }) => {
  const { colors } = useTheme();
  const locale = getCurrentLocale();
  const safeCols = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  const formatCell = (value: string | number | null | undefined): string => {
    if (value == null) return '—';
    if (typeof value === 'number') return value.toLocaleString(locale);
    return String(value).replace(/\s+/g, ' ').trim() || '—';
  };

  if (safeCols.length === 0 && safeRows.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.textDisabled }}>
          {getLabelDirect('noData')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {safeCols.length > 0 && (
          <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: withOpacity(colors.textPrimary, OPACITY[8]) }]}>
            {safeCols.map((col, i) => (
              <View key={i} style={[styles.cell, i === 0 && styles.firstCell]}>
                <Text style={[styles.headerCell, { color: colors.textTertiary }]} numberOfLines={1}>
                  {col}
                </Text>
              </View>
            ))}
          </View>
          )}

          {safeRows.map((row, ri) => {
            const safeRow = Array.isArray(row) ? row : [];
            // Pad row to match column count to avoid misalignment
            const colCount = safeCols.length || safeRow.length;
            const paddedRow = safeRow.length < colCount
              ? [...safeRow, ...Array(colCount - safeRow.length).fill(null)]
              : safeRow;
            return (
            <View
              key={ri}
              style={[
                styles.tableRow,
                ri % 2 === 1 && { backgroundColor: withOpacity(colors.textPrimary, OPACITY[5]) },
              ]}
            >
              {paddedRow.map((cell, ci) => (
                <View key={ci} style={[styles.cell, ci === 0 && styles.firstCell]}>
                  <Text style={[styles.cellText, { color: ci === 0 ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
                    {formatCell(cell)}
                  </Text>
                </View>
              ))}
            </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  tableRow: {
    flexDirection: 'row',
  },
  cell: {
    minWidth: 72,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    justifyContent: 'center',
  },
  firstCell: {
    minWidth: 120,
  },
  headerCell: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xxs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  cellText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default TableChart;
