/**
 * CanvasBlock — SVG geometry canvas for 2D figures
 * Uses react-native-svg for declarative rendering of points, segments, angles, circles, polygons, labels
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Polygon, Path, G } from 'react-native-svg';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';

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

function sanitizeText(value: unknown, max = 48): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeCanvasData(data: CanvasBlockProps['data']) {
  const width = clamp(isFiniteNumber(data?.width) ? data.width : DEFAULT_WIDTH, 180, 640);
  const height = clamp(isFiniteNumber(data?.height) ? data.height : DEFAULT_HEIGHT, 180, 480);
  const title = sanitizeText(data?.title, 72);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const points = new Map<string, PointElement>();
  const renderable: CanvasElement[] = [];

  elements.forEach((element) => {
    if (renderable.length >= 80) return;

    if (element?.type === 'point') {
      const id = sanitizeText((element as PointElement).id, 24);
      if (!id || points.has(id) || !isFiniteNumber((element as PointElement).x) || !isFiniteNumber((element as PointElement).y)) return;
      const point: PointElement = {
        type: 'point',
        id,
        x: clamp((element as PointElement).x, 0, width),
        y: clamp((element as PointElement).y, 0, height),
        label: sanitizeText((element as PointElement).label, 12),
      };
      points.set(id, point);
      renderable.push(point);
    }
  });

  elements.forEach((element) => {
    if (!element || renderable.length >= 80) return;

    switch (element.type) {
      case 'segment': {
        const from = sanitizeText((element as SegmentElement).from, 24);
        const to = sanitizeText((element as SegmentElement).to, 24);
        if (!from || !to || from === to || !points.has(from) || !points.has(to)) return;
        renderable.push({ type: 'segment', from, to, dashed: Boolean((element as SegmentElement).dashed) });
        return;
      }
      case 'angle': {
        const vertex = sanitizeText((element as AngleElement).vertex, 24);
        const from = sanitizeText((element as AngleElement).from, 24);
        const to = sanitizeText((element as AngleElement).to, 24);
        if (!vertex || !from || !to || !points.has(vertex) || !points.has(from) || !points.has(to)) return;
        if (new Set([vertex, from, to]).size < 3) return;
        renderable.push({
          type: 'angle',
          vertex,
          from,
          to,
          label: sanitizeText((element as AngleElement).label, 18),
        });
        return;
      }
      case 'label': {
        const text = sanitizeText((element as LabelElement).text, 32);
        if (!text || !isFiniteNumber((element as LabelElement).x) || !isFiniteNumber((element as LabelElement).y)) return;
        renderable.push({
          type: 'label',
          text,
          x: clamp((element as LabelElement).x, 0, width),
          y: clamp((element as LabelElement).y, 0, height),
        });
        return;
      }
      case 'circle': {
        const center = sanitizeText((element as CircleElement).center, 24);
        const radius = isFiniteNumber((element as CircleElement).radius) ? (element as CircleElement).radius : NaN;
        if (!center || !points.has(center) || !Number.isFinite(radius) || radius <= 0) return;
        renderable.push({
          type: 'circle',
          center,
          radius: clamp(radius, 4, Math.min(width, height)),
          fill: Boolean((element as CircleElement).fill),
        });
        return;
      }
      case 'polygon': {
        const rawPoints = Array.isArray((element as PolygonElement).points) ? (element as PolygonElement).points : [];
        const polygonPoints = rawPoints
          .map((id) => sanitizeText(id, 24))
          .filter((id): id is string => Boolean(id && points.has(id)))
          .filter((id, index, arr) => arr.indexOf(id) === index);
        if (polygonPoints.length < 3) return;
        renderable.push({
          type: 'polygon',
          points: polygonPoints,
          fill: (element as PolygonElement).fill !== false,
        });
        return;
      }
      default:
        return;
    }
  });

  return { title, width, height, elements: renderable };
}

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
  const sanitized = sanitizeCanvasData(data);
  const { width, height } = sanitized;

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
        const from = findPoint(sanitized.elements, seg.from);
        const to = findPoint(sanitized.elements, seg.to);
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
        const vertex = findPoint(sanitized.elements, ang.vertex);
        const from = findPoint(sanitized.elements, ang.from);
        const to = findPoint(sanitized.elements, ang.to);
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
        const center = findPoint(sanitized.elements, circ.center);
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
          .map((id) => findPoint(sanitized.elements, id))
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

  if (!sanitized.elements.length) {
    return (
      <View style={[styles.container, { borderColor: colors.borderColor }]}>
        {sanitized.title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]}>{sanitized.title}</Text>
        ) : null}
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: colors.borderColor }]}>
      {sanitized.title && (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{sanitized.title}</Text>
      )}
      <View style={[styles.svgContainer, { backgroundColor: colors.surface }]}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Render segments/polygons first, then points/labels on top */}
          {sanitized.elements
            .filter((e) => e.type === 'polygon')
            .map((e, i) => renderElement(e, i))}
          {sanitized.elements
            .filter((e) => e.type === 'segment')
            .map((e, i) => renderElement(e, i + 100))}
          {sanitized.elements
            .filter((e) => e.type === 'circle')
            .map((e, i) => renderElement(e, i + 200))}
          {sanitized.elements
            .filter((e) => e.type === 'angle')
            .map((e, i) => renderElement(e, i + 300))}
          {sanitized.elements
            .filter((e) => e.type === 'point')
            .map((e, i) => renderElement(e, i + 400))}
          {sanitized.elements
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
    fontSize: TYPOGRAPHY.fontSize.xs,
    padding: SPACING.md,
    paddingBottom: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  svgContainer: {
    padding: SPACING.sm,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    padding: SPACING.md,
  },
});

export default CanvasBlock;
