/**
 * LineChart Component — SVG line chart with dots and optional area fill
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, OPACITY, withOpacity } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';

interface LineChartDataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  title: string;
  data: LineChartDataPoint[];
}

export const LineChart: React.FC<LineChartProps> = ({ title, data }) => {
  const { colors, mode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.empty, { color: colors.textTertiary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  const lineColor = mode === 'dark' ? '#C9A070' : '#3B2416';
  const dotColor = lineColor;
  const areaColor = withOpacity(lineColor, OPACITY[10]);
  const gridColor = withOpacity(colors.textPrimary, OPACITY[8]);

  const chartWidth = Math.min(screenWidth - SPACING.lg * 2, 360);
  const chartHeight = 160;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 8;
  const paddingBottom = 24;

  const plotW = chartWidth - paddingLeft - paddingRight;
  const plotH = chartHeight - paddingTop - paddingBottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = paddingTop + plotH - ((d.value - minVal) / range) * plotH;
    return { x, y, ...d };
  });

  // Line path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area path (fill below line)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotH} L ${points[0].x} ${paddingTop + plotH} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [minVal, minVal + range / 2, maxVal].map(v => ({
    value: Math.round(v),
    y: paddingTop + plotH - ((v - minVal) / range) * plotH,
  }));

  // X-axis labels (show max 6 evenly spaced)
  const maxLabels = Math.min(6, data.length);
  const step = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));
  const xLabels = points.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <Svg width={chartWidth} height={chartHeight}>
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={paddingLeft} y1={tick.y}
            x2={chartWidth - paddingRight} y2={tick.y}
            stroke={gridColor} strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`ytick-${i}`}
            x={paddingLeft - 6} y={tick.y + 3}
            fill={colors.textTertiary}
            fontSize={9}
            fontFamily={TYPOGRAPHY.fontFamily.regular}
            textAnchor="end"
          >
            {tick.value.toLocaleString('fr-FR')}
          </SvgText>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={areaColor} />

        {/* Line */}
        <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill={dotColor} />
        ))}

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <SvgText
            key={`xlabel-${i}`}
            x={p.x} y={chartHeight - 4}
            fill={colors.textTertiary}
            fontSize={9}
            fontFamily={TYPOGRAPHY.fontFamily.regular}
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
        ))}
      </Svg>
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
    marginBottom: SPACING.xs,
  },
  empty: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default LineChart;
