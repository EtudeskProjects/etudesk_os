/**
 * TableChart Component — Scrollable data table with alternating rows
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Table } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../../constants/theme';

interface TableChartProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export const TableChart: React.FC<TableChartProps> = ({ title, columns, rows }) => {
  const { colors } = useTheme();

  const formatCell = (value: string | number): string => {
    if (typeof value === 'number') {
      return value.toLocaleString('fr-FR');
    }
    return String(value);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <Table size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>Tableau</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header row */}
          <View style={[styles.tableRow, { backgroundColor: colors.backgroundSecondary }]}>
            {columns.map((col, i) => (
              <View key={i} style={[styles.cell, i === 0 && styles.firstCell]}>
                <Text style={[styles.headerCell, { color: colors.textTertiary }]} numberOfLines={1}>
                  {col}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {rows.map((row, ri) => (
            <View
              key={ri}
              style={[
                styles.tableRow,
                ri % 2 === 1 && { backgroundColor: withOpacity(colors.backgroundSecondary, OPACITY[30]) },
              ]}
            >
              {row.map((cell, ci) => (
                <View key={ci} style={[styles.cell, ci === 0 && styles.firstCell]}>
                  <Text style={[styles.cellText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {formatCell(cell)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.xxs,
  },
  type: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  table: {
    paddingBottom: SPACING.sm,
  },
  tableRow: {
    flexDirection: 'row',
  },
  cell: {
    minWidth: 80,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
  },
  firstCell: {
    minWidth: 140,
  },
  headerCell: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  cellText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default TableChart;
