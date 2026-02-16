/**
 * CanvasBlock — SVG geometry canvas for 2D figures
 * Uses react-native-svg for declarative rendering of points, segments, angles, circles, polygons, labels
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Polygon, Path, G } from 'react-native-svg';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../../constants/theme';

// --- Types ---

interface PointElement {
  type: 'point';
  id: string;
  x: number;
  y: number;
  label?: string;
}

interface SegmentElement {
  type: 'segment';
  from: string;
  to: string;
  dashed?: boolean;
}

interface AngleElement {
  type: 'angle';
  vertex: string;
  from: string;
  to: string;
  label?: string;
}

interface LabelElement {
  type: 'label';
  text: string;
  x: number;
  y: number;
}

interface CircleElement {
  type: 'circle';
  center: string;
  radius: number;
  fill?: boolean;
}

interface PolygonElement {
  type: 'polygon';
  points: string[];
  fill?: boolean;
}

type CanvasElement =
  | PointElement
  | SegmentElement
  | AngleElement
  | LabelElement
  | CircleElement
  | PolygonElement;

interface CanvasBlockProps {
  data: {
    type?: string;
    title?: string;
    elements: CanvasElement[];
    width?: number;
    height?: number;
  };
}

const DEFAULT_WIDTH = 350;
const DEFAULT_HEIGHT = 300;
const POINT_RADIUS = 4;
const LABEL_OFFSET = 14;

/** Look up a point by id */
function findPoint(elements: CanvasElement[], id: string): { x: number; y: number } | null {
  const pt = elements.find((e) => e.type === 'point' && (e as PointElement).id === id) as
    | PointElement
    | undefined;
  return pt ? { x: pt.x, y: pt.y } : null;
}

/** Build an arc path for an angle indicator */
function buildAngleArc(
  vertex: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number = 20
): string {
  // Calculate angles
  const angle1 = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const angle2 = Math.atan2(to.y - vertex.y, to.x - vertex.x);

  const startX = vertex.x + radius * Math.cos(angle1);
  const startY = vertex.y + radius * Math.sin(angle1);
  const endX = vertex.x + radius * Math.cos(angle2);
  const endY = vertex.y + radius * Math.sin(angle2);

  // Determine sweep direction
  let sweep = angle2 - angle1;
  if (sweep < -Math.PI) sweep += 2 * Math.PI;
  if (sweep > Math.PI) sweep -= 2 * Math.PI;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}`;
}

export const CanvasBlock: React.FC<CanvasBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const width = data.width || DEFAULT_WIDTH;
  const height = data.height || DEFAULT_HEIGHT;

  const renderElement = (element: CanvasElement, index: number) => {
    switch (element.type) {
      case 'point': {
        const pt = element as PointElement;
        return (
          <G key={`point-${index}`}>
            <Circle cx={pt.x} cy={pt.y} r={POINT_RADIUS} fill={colors.primary} />
            {pt.label && (
              <SvgText
                x={pt.x}
                y={pt.y - LABEL_OFFSET}
                textAnchor="middle"
                fill={colors.textPrimary}
                fontSize={13}
                fontWeight="600"
              >
                {pt.label}
              </SvgText>
            )}
          </G>
        );
      }

      case 'segment': {
        const seg = element as SegmentElement;
        const from = findPoint(data.elements, seg.from);
        const to = findPoint(data.elements, seg.to);
        if (!from || !to) return null;
        return (
          <Line
            key={`seg-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={colors.primary}
            strokeWidth={2}
            strokeDasharray={seg.dashed ? '6,4' : undefined}
          />
        );
      }

      case 'angle': {
        const ang = element as AngleElement;
        const vertex = findPoint(data.elements, ang.vertex);
        const from = findPoint(data.elements, ang.from);
        const to = findPoint(data.elements, ang.to);
        if (!vertex || !from || !to) return null;

        const arcPath = buildAngleArc(vertex, from, to, 20);
        const midAngle =
          (Math.atan2(from.y - vertex.y, from.x - vertex.x) +
            Math.atan2(to.y - vertex.y, to.x - vertex.x)) /
          2;
        const labelX = vertex.x + 30 * Math.cos(midAngle);
        const labelY = vertex.y + 30 * Math.sin(midAngle);

        return (
          <G key={`angle-${index}`}>
            <Path
              d={arcPath}
              stroke={withOpacity(colors.primary, OPACITY[60])}
              strokeWidth={1.5}
              fill="none"
            />
            {ang.label && (
              <SvgText
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fill={colors.textSecondary}
                fontSize={11}
              >
                {ang.label}
              </SvgText>
            )}
          </G>
        );
      }

      case 'label': {
        const lbl = element as LabelElement;
        return (
          <SvgText
            key={`label-${index}`}
            x={lbl.x}
            y={lbl.y}
            textAnchor="middle"
            fill={colors.textSecondary}
            fontSize={12}
            fontStyle="italic"
          >
            {lbl.text}
          </SvgText>
        );
      }

      case 'circle': {
        const circ = element as CircleElement;
        const center = findPoint(data.elements, circ.center);
        if (!center) return null;
        return (
          <Circle
            key={`circle-${index}`}
            cx={center.x}
            cy={center.y}
            r={circ.radius}
            stroke={colors.primary}
            strokeWidth={2}
            fill={circ.fill ? withOpacity(colors.primary, OPACITY[10]) : 'none'}
          />
        );
      }

      case 'polygon': {
        const poly = element as PolygonElement;
        const pts = poly.points
          .map((id) => findPoint(data.elements, id))
          .filter(Boolean) as { x: number; y: number }[];
        if (pts.length < 3) return null;
        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
        return (
          <Polygon
            key={`polygon-${index}`}
            points={pointsStr}
            stroke={colors.primary}
            strokeWidth={2}
            fill={poly.fill !== false ? withOpacity(colors.primary, OPACITY[10]) : 'none'}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { borderColor: colors.borderColor }]}>
      {data.title && (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{data.title}</Text>
      )}
      <View style={[styles.svgContainer, { backgroundColor: colors.surface }]}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Render segments/polygons first, then points/labels on top */}
          {data.elements
            .filter((e) => e.type === 'polygon')
            .map((e, i) => renderElement(e, i))}
          {data.elements
            .filter((e) => e.type === 'segment')
            .map((e, i) => renderElement(e, i + 100))}
          {data.elements
            .filter((e) => e.type === 'circle')
            .map((e, i) => renderElement(e, i + 200))}
          {data.elements
            .filter((e) => e.type === 'angle')
            .map((e, i) => renderElement(e, i + 300))}
          {data.elements
            .filter((e) => e.type === 'point')
            .map((e, i) => renderElement(e, i + 400))}
          {data.elements
            .filter((e) => e.type === 'label')
            .map((e, i) => renderElement(e, i + 500))}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    padding: SPACING.md,
    paddingBottom: 0,
  },
  svgContainer: {
    padding: SPACING.sm,
    alignItems: 'center',
  },
});

export default CanvasBlock;
