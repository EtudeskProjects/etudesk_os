/**
 * StackedBarChart Component — Horizontal bars with colored segments
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Layers } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../../constants/theme';

interface Segment {
  key: string;
  value: number;
  color: string; // 'primary' | 'success' | 'warning' | 'info' | 'error' | 'primaryLight'
}

interface StackedBarItem {
  label: string;
  segments: Segment[];
}

interface StackedBarChartProps {
  title: string;
  data: StackedBarItem[];
}

const resolveColor = (colors: any, colorKey: string): string => {
  return colors[colorKey] || colors.primary;
};

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ title, data }) => {
  const { colors } = useTheme();

  const maxTotal = Math.max(...data.map(item => item.segments.reduce((s, seg) => s + seg.value, 0)), 1);

  // Collect unique segment keys for legend
  const legendKeys = new Map<string, string>();
  data.forEach(item => {
    item.segments.forEach(seg => {
      if (!legendKeys.has(seg.key)) {
        legendKeys.set(seg.key, seg.color);
      }
    });
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <Layers size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>Graphique empilé</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {data.map((item, index) => {
          const total = item.segments.reduce((s, seg) => s + seg.value, 0);
          return (
            <View key={index} style={styles.barRow}>
              <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.label}
              </Text>
              <View style={styles.barContainer}>
                <View style={styles.segmentsRow}>
                  {item.segments.map((seg, si) => {
                    const width = (seg.value / maxTotal) * 100;
                    if (width <= 0) return null;
                    return (
                      <View
                        key={si}
                        style={[
                          styles.segment,
                          {
                            width: `${width}%`,
                            backgroundColor: resolveColor(colors, seg.color),
                            borderTopLeftRadius: si === 0 ? BORDER.radius.xs : 0,
                            borderBottomLeftRadius: si === 0 ? BORDER.radius.xs : 0,
                            borderTopRightRadius: si === item.segments.length - 1 ? BORDER.radius.xs : 0,
                            borderBottomRightRadius: si === item.segments.length - 1 ? BORDER.radius.xs : 0,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={[styles.totalValue, { color: colors.textSecondary }]}>{total}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.legend, { backgroundColor: colors.backgroundSecondary, borderTopColor: withOpacity(colors.textPrimary, OPACITY[5]) }]}>
        <View style={styles.legendRow}>
          {Array.from(legendKeys.entries()).map(([key, color]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: resolveColor(colors, color) }]} />
              <Text style={[styles.legendText, { color: colors.textTertiary }]}>{key}</Text>
            </View>
          ))}
        </View>
      </View>
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
  chart: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  barRow: { gap: SPACING.xs },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  segmentsRow: {
    flex: 1,
    flexDirection: 'row',
    height: 28,
  },
  segment: {
    height: '100%',
  },
  totalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    minWidth: 30,
    textAlign: 'right',
  },
  legend: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default StackedBarChart;
