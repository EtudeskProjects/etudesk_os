/**
 * StackedBarChart Component — Horizontal bars with colored segments
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';

interface Segment {
  key: string;
  label?: string;
  value: number;
  color: string;
}

interface StackedBarItem {
  label: string;
  segments: Segment[];
}

interface StackedBarChartProps {
  title: string;
  data: StackedBarItem[];
}

const FALLBACK_PALETTE = [
  '#3B2416', '#4A6741', '#A67C52', '#8B4A3C', '#5E6B52', '#6B525E', '#52656B',
] as const;

const FALLBACK_PALETTE_DARK = [
  '#C9A070', '#7CB870', '#E8B870', '#E08070', '#A8C898', '#C8A0B0', '#90B8C0',
] as const;

const resolveColor = (colors: any, colorKey: string, mode: string, fallbackIdx: number): string => {
  if (colors[colorKey]) return colors[colorKey];
  const pal = mode === 'dark' ? FALLBACK_PALETTE_DARK : FALLBACK_PALETTE;
  return pal[fallbackIdx % pal.length];
};

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ title, data }) => {
  const { colors, mode } = useTheme();
  const safeData = Array.isArray(data)
    ? data
        .map((item) => ({
          ...item,
          segments: Array.isArray(item?.segments)
            ? item.segments.filter((segment) => segment && typeof segment.value === 'number' && segment.value > 0)
            : [],
        }))
        .filter((item) => item && item.label && item.segments.length > 0)
    : [];

  if (safeData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.textTertiary }}>
          {getLabelDirect('noData')}
        </Text>
      </View>
    );
  }

  const maxTotal = Math.max(...safeData.map(item => item.segments.reduce((s, seg) => s + seg.value, 0)), 1);

  const legendKeys = new Map<string, string>();
  const legendLabels = new Map<string, string>();
  safeData.forEach(item => {
    item.segments.forEach(seg => {
      if (!legendKeys.has(seg.key)) {
        legendKeys.set(seg.key, seg.color);
        legendLabels.set(seg.key, seg.label || seg.key);
      }
    });
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.chart}>
        {safeData.map((item, index) => {
          const total = item.segments.reduce((s, seg) => s + seg.value, 0);
          return (
            <View key={index} style={styles.barRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
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
                            backgroundColor: resolveColor(colors, seg.color, mode, si),
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
                <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
                  {total.toLocaleString()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {Array.from(legendKeys.entries()).map(([key, color], idx) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: resolveColor(colors, color, mode, idx) }]} />
            <Text style={[styles.legendText, { color: colors.textTertiary }]} numberOfLines={1}>
              {legendLabels.get(key) || key}
            </Text>
          </View>
        ))}
      </View>
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
  chart: {
    gap: SPACING.sm,
  },
  barRow: {
    gap: 2,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  segmentsRow: {
    flex: 1,
    flexDirection: 'row',
    height: 22,
  },
  segment: {
    height: '100%',
  },
  totalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    minWidth: 28,
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
});

export default StackedBarChart;
