/**
 * DonutChart Component — SVG ring chart with center total
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';
import { getCurrentLocale } from '../../../../i18n';

interface DonutSegment {
  label: string;
  value: number;
}

interface DonutChartProps {
  title: string;
  data: DonutSegment[];
  total_label?: string;
}

const CHART_PALETTE = [
  '#3B2416', '#4A6741', '#A67C52', '#8B4A3C', '#5E6B52', '#6B525E', '#52656B',
] as const;

const CHART_PALETTE_DARK = [
  '#C9A070', '#7CB870', '#E8B870', '#E08070', '#A8C898', '#C8A0B0', '#90B8C0',
] as const;

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export const DonutChart: React.FC<DonutChartProps> = ({ title, data, total_label }) => {
  const { colors, mode } = useTheme();
  const locale = getCurrentLocale();
  const palette = mode === 'dark' ? CHART_PALETTE_DARK : CHART_PALETTE;
  // Filter out zero-value segments — they add empty legend entries
  const safeData = Array.isArray(data) ? data.filter(d => d && typeof d.value === 'number' && d.value > 0) : [];
  const total = safeData.reduce((sum, d) => sum + d.value, 0);

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

  const cx = 56;
  const cy = 56;
  const r = 42;
  const strokeWidth = 20;

  let currentAngle = 0;
  const arcs = safeData.map((segment, i) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const angle = fraction * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    return { ...segment, startAngle, endAngle, color: palette[i % palette.length], fraction };
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.chartArea}>
        <View style={styles.svgContainer}>
          <Svg width={112} height={112} viewBox="0 0 112 112">
            {arcs.map((arc, i) =>
              arc.fraction >= 1 ? (
                <Circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color} strokeWidth={strokeWidth} />
              ) : arc.fraction > 0 ? (
                <Path
                  key={i}
                  d={describeArc(cx, cy, r, arc.startAngle, arc.endAngle)}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              ) : null
            )}
          </Svg>
          <View style={styles.centerLabel}>
            <Text style={[styles.centerValue, { color: colors.textPrimary }]}>
              {total.toLocaleString(locale)}
            </Text>
            {total_label && (
              <Text style={[styles.centerText, { color: colors.textTertiary }]}>{total_label}</Text>
            )}
          </View>
        </View>

        <View style={styles.legendList}>
          {safeData.map((segment, i) => {
            const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
            return (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette[i % palette.length] }]} />
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {segment.label}
                </Text>
                <Text style={[styles.legendValue, { color: colors.textPrimary }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
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
  chartArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  svgContainer: {
    width: 112,
    height: 112,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  centerText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
  legendList: {
    flex: 1,
    gap: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  legendValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default DonutChart;
