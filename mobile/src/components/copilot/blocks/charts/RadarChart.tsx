/**
 * RadarChart Component — Skills radar chart
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { G, Polygon, Line, Circle, Text as SvgText, TSpan } from 'react-native-svg';
import { useTheme } from '../../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, OPACITY, withOpacity } from '../../../../constants/theme';
import { getLabelDirect } from '../../../../utils/labels';

type RadarSeries = {
  name: string;
  values: number[];
  color?: string;
};

interface RadarChartProps {
  title: string;
  axes: string[];
  series: RadarSeries[];
  max?: number;
}

const CHART_PALETTE = [
  '#3B2416', '#4A6741', '#A67C52', '#8B4A3C', '#5E6B52',
] as const;

const CHART_PALETTE_DARK = [
  '#C9A070', '#7CB870', '#E8B870', '#E08070', '#A8C898',
] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Split a label into lines of up to `maxChars` characters, breaking on spaces. */
function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && (current.length + 1 + word.length) > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function toPoints(values: number[], max: number, cx: number, cy: number, r: number): string {
  const n = values.length;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = clamp(values[i] ?? 0, 0, max);
    const rr = (v / max) * r;
    pts.push(`${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export const RadarChart: React.FC<RadarChartProps> = ({ title, axes, series, max }) => {
  const { colors, mode } = useTheme();
  const { width } = useWindowDimensions();

  const safeAxes = Array.isArray(axes) ? axes.filter(Boolean) : [];
  const safeSeries = Array.isArray(series)
    ? series.filter((item) => item && typeof item.name === 'string' && Array.isArray(item.values) && item.values.length > 0)
    : [];
  const n = safeAxes.length;
  const maxValue = typeof max === 'number' && isFinite(max) && max > 0 ? max : 5;

  const palette = useMemo(
    () => (mode === 'dark' ? CHART_PALETTE_DARK : CHART_PALETTE),
    [mode]
  );

  const labelPad = 72; // extra space for labels around the radar
  const radarSize = Math.min(240, Math.max(180, Math.floor(width - SPACING.lg * 2 - labelPad * 2)));
  const size = radarSize + labelPad * 2; // total SVG size including label space
  const cx = size / 2;
  const cy = size / 2;
  const radius = radarSize / 2;
  const rings = 4;

  if (n < 3) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {getLabelDirect('noData')}
        </Text>
      </View>
    );
  }

  const gridPolygons = Array.from({ length: rings }, (_, i) => {
    const k = (i + 1) / rings;
    return toPoints(new Array(n).fill(maxValue * k), maxValue, cx, cy, radius);
  });

  const axisLines = safeAxes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  const LABEL_FONT_SIZE = 10;
  const LABEL_LINE_HEIGHT = 13;
  const LABEL_MAX_CHARS = 14;

  const labelPoints = safeAxes.map((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rr = radius + 18;
    const x = cx + rr * cosA;
    const y = cy + rr * sinA;
    const anchor = cosA > 0.35 ? 'start' : cosA < -0.35 ? 'end' : 'middle';
    const lines = wrapLabel(label, LABEL_MAX_CHARS);
    // Vertical offset: center the multi-line block around the point
    const dyStart = -((lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
    return { lines, x, y, anchor, dyStart };
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.chartWrapper}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {gridPolygons.map((points, idx) => (
            <Polygon
              key={`g-${idx}`}
              points={points}
              fill="transparent"
              stroke={withOpacity(colors.textPrimary, OPACITY[8])}
              strokeWidth={1}
            />
          ))}

          {axisLines.map((p, idx) => (
            <Line
              key={`a-${idx}`}
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={withOpacity(colors.textPrimary, OPACITY[8])}
              strokeWidth={1}
            />
          ))}

          {safeSeries.map((s, idx) => {
            const color = (s.color && (colors as any)[s.color]) || s.color || palette[idx % palette.length];
            const points = toPoints(s.values || [], maxValue, cx, cy, radius);
            return (
              <G key={`s-${idx}`}>
                <Polygon points={points} fill={withOpacity(color, OPACITY[15])} stroke={color} strokeWidth={2} />
                {(s.values || []).slice(0, n).map((v, i) => {
                  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                  const vv = clamp(v ?? 0, 0, maxValue);
                  const rr = (vv / maxValue) * radius;
                  return <Circle key={`p-${idx}-${i}`} cx={cx + rr * Math.cos(angle)} cy={cy + rr * Math.sin(angle)} r={3} fill={color} />;
                })}
              </G>
            );
          })}

          {labelPoints.map((p, idx) => (
            <SvgText
              key={`l-${idx}`}
              x={p.x}
              y={p.y + p.dyStart}
              fill={colors.textSecondary}
              fontSize={LABEL_FONT_SIZE}
              fontFamily={TYPOGRAPHY.fontFamily.regular}
              textAnchor={p.anchor as any}
              alignmentBaseline="middle"
            >
              {p.lines.map((line, li) => (
                <TSpan
                  key={li}
                  x={p.x}
                  dy={li === 0 ? 0 : LABEL_LINE_HEIGHT}
                >
                  {line}
                </TSpan>
              ))}
            </SvgText>
          ))}
        </G>
      </Svg>
      </View>

      {safeSeries.length > 1 && (
        <View style={styles.legend}>
          {safeSeries.slice(0, 3).map((s, idx) => {
            const color = (s.color && (colors as any)[s.color]) || s.color || palette[idx % palette.length];
            return (
              <View key={`lg-${idx}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendText, { color: colors.textTertiary }]} numberOfLines={1}>{s.name}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
    alignItems: 'center',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
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
  note: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default RadarChart;
