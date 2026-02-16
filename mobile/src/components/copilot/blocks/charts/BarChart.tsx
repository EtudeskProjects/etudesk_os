/**
 * BarChart Component — Horizontal bar chart
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../../../constants/theme';

interface BarChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  data: BarChartData[];
}

const CHART_PALETTE = [
  '#3B2416', // rich brown (primary)
  '#4A6741', // forest green
  '#A67C52', // warm amber
  '#8B4A3C', // terracotta
  '#5E6B52', // olive
  '#6B525E', // mauve-brown
  '#52656B', // blue-gray
] as const;

const CHART_PALETTE_DARK = [
  '#C9A070', // warm gold
  '#7CB870', // bright green
  '#E8B870', // bright amber
  '#E08070', // bright terracotta
  '#A8C898', // light olive
  '#C8A0B0', // light mauve
  '#90B8C0', // light blue-gray
] as const;

export const BarChart: React.FC<BarChartProps> = ({ title, data }) => {
  const { colors, mode } = useTheme();
  const maxValue = Math.max(...data.map(item => item.value), 1);
  const palette = mode === 'dark' ? CHART_PALETTE_DARK : CHART_PALETTE;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.chart}>
        {data.map((item, index) => {
          const barWidth = Math.max((item.value / maxValue) * 100, 1);
          const barColor = palette[index % palette.length];
          const isWide = barWidth > 30;
          return (
            <View key={index} style={styles.barRow}>
              <View
                style={[
                  styles.bar,
                  { width: `${barWidth}%`, backgroundColor: barColor },
                ]}
              >
                {isWide && (
                  <Text style={[styles.innerLabel, { color: mode === 'dark' ? '#1A1A1A' : '#FFFFFF' }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                )}
                <Text style={[styles.innerValue, { color: mode === 'dark' ? '#1A1A1A' : '#FFFFFF' }]}>
                  {item.value.toLocaleString('fr-FR')}
                </Text>
              </View>
              {!isWide && (
                <Text style={[styles.outerLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.label} · {item.value.toLocaleString('fr-FR')}
                </Text>
              )}
            </View>
          );
        })}
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
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  bar: {
    height: 26,
    minWidth: 2,
    borderRadius: BORDER.radius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  innerLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
    flexShrink: 1,
  },
  innerValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
  },
  outerLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
    flexShrink: 1,
  },
});

export default BarChart;
