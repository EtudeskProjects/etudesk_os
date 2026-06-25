/**
 * BarChart Component — Horizontal bar chart
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';
import { getCurrentLocale } from '../../../../i18n';

interface BarChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  data: BarChartData[];
}

const CHART_PALETTE = [
  '#1D4ED8', // bleu
  '#0E7490', // cyan
  '#BE185D', // rose
  '#6D28D9', // violet
  '#047857', // émeraude
  '#D97706', // ambre
  '#52525B', // graphite
] as const;

const CHART_PALETTE_DARK = [
  '#60A5FA', // bleu clair
  '#22D3EE', // cyan clair
  '#F472B6', // rose clair
  '#A78BFA', // violet clair
  '#34D399', // émeraude clair
  '#FBBF24', // ambre clair
  '#A1A1AA', // graphite clair
] as const;

export const BarChart: React.FC<BarChartProps> = ({ title, data }) => {
  const { colors, mode } = useTheme();
  const locale = getCurrentLocale();
  // Filter out items with value 0 or non-numeric — zero bars add visual noise
  const safeData = Array.isArray(data) ? data.filter(item => item && typeof item.value === 'number' && item.value > 0) : [];
  const maxValue = safeData.length > 0 ? Math.max(...safeData.map(item => item.value), 1) : 1;
  const palette = mode === 'dark' ? CHART_PALETTE_DARK : CHART_PALETTE;

  if (safeData.length === 0) {
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

      <View style={styles.chart}>
        {safeData.map((item, index) => {
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
                  {item.value.toLocaleString(locale)}
                </Text>
              </View>
              {!isWide && (
                <Text style={[styles.outerLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.label} · {item.value.toLocaleString(locale)}
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
