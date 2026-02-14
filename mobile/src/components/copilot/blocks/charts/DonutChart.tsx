/**
 * DonutChart Component — SVG ring chart with center total
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { PieChart } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../../constants/theme';

interface DonutSegment {
  label: string;
  value: number;
}

interface DonutChartProps {
  title: string;
  data: DonutSegment[];
  total_label?: string;
}

const COLOR_KEYS = ['primary', 'success', 'warning', 'info', 'error', 'primaryLight'] as const;

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
  const { colors } = useTheme();
  const segmentColors = COLOR_KEYS.map(k => (colors as any)[k]);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const cx = 60;
  const cy = 60;
  const r = 45;
  const strokeWidth = 24;

  let currentAngle = 0;
  const arcs = data.map((segment, i) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const angle = fraction * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    return { ...segment, startAngle, endAngle, color: segmentColors[i % segmentColors.length], fraction };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <PieChart size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>Graphique donut</Text>
        </View>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.svgContainer}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {arcs.map((arc, i) =>
              arc.fraction >= 1 ? (
                <Circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                />
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
            <Text style={[styles.centerValue, { color: colors.textPrimary }]}>{total}</Text>
            {total_label && (
              <Text style={[styles.centerText, { color: colors.textTertiary }]}>{total_label}</Text>
            )}
          </View>
        </View>

        <View style={styles.legendList}>
          {data.map((segment, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: segmentColors[i % segmentColors.length] }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {segment.label}
              </Text>
              <Text style={[styles.legendValue, { color: colors.textPrimary }]}>{segment.value}</Text>
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
  chartArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  svgContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  centerText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
    textTransform: 'uppercase',
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  legendValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default DonutChart;
