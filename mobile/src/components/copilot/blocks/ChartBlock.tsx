/**
 * ChartBlock Component — Router that dispatches to chart sub-components
 * Includes minimum-data gate: suppresses charts that have too few meaningful items
 */

import React from 'react';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { StackedBarChart } from './charts/StackedBarChart';
import { MetricCard } from './charts/MetricCard';
import { TableChart } from './charts/TableChart';
import { LineChart } from './charts/LineChart';

interface ChartBlockProps {
  data: {
    type: string;
    title: string;
    [key: string]: any;
  };
}

function sanitizeLabel(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text || fallback;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeSeries(data: unknown, options?: { allowNegative?: boolean; positiveOnly?: boolean }) {
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => {
      const value = toFiniteNumber(item?.value);
      if (value === null) return null;
      if (options?.positiveOnly && value <= 0) return null;
      if (!options?.allowNegative && value < 0) return null;
      return {
        label: sanitizeLabel(item?.label, `Item ${index + 1}`),
        value,
      };
    })
    .filter(Boolean);
}

function sanitizeStackedBar(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data
    .map((item, itemIndex) => {
      const segments = Array.isArray(item?.segments)
        ? item.segments
            .map((segment: any, segmentIndex: number) => {
              const value = toFiniteNumber(segment?.value);
              if (value === null || value <= 0) return null;
              return {
                key: sanitizeLabel(segment?.key || segment?.label, `segment_${segmentIndex + 1}`),
                label: sanitizeLabel(segment?.label || segment?.key, `Segment ${segmentIndex + 1}`),
                value,
                color: sanitizeLabel(segment?.color, 'primary'),
              };
            })
            .filter(Boolean)
        : [];

      if (segments.length === 0) return null;
      return {
        label: sanitizeLabel(item?.label, `Item ${itemIndex + 1}`),
        segments,
      };
    })
    .filter(Boolean);
}

function sanitizeMetric(data: ChartBlockProps['data']) {
  const value = toFiniteNumber(data.value);
  if (value === null) return null;
  const delta = toFiniteNumber(data.trend?.delta);
  const direction = data.trend?.direction === 'down' ? 'down' : data.trend?.direction === 'up' ? 'up' : null;
  return {
    ...data,
    title: sanitizeLabel(data.title, 'Metric'),
    value,
    unit: typeof data.unit === 'string' ? data.unit.trim() : undefined,
    trend: direction && delta !== null
      ? {
          direction,
          delta: Math.abs(delta),
          period: typeof data.trend?.period === 'string' ? data.trend.period.trim() : undefined,
        }
      : undefined,
  };
}

function sanitizeTable(data: ChartBlockProps['data']) {
  const columns = Array.isArray(data.columns)
    ? data.columns.map((col, index) => sanitizeLabel(col, `Col ${index + 1}`)).slice(0, 8)
    : [];
  const rows = Array.isArray(data.rows)
    ? data.rows
        .filter(Array.isArray)
        .map((row: any[]) => row.slice(0, columns.length || row.length).map((cell) => (cell == null ? null : cell)))
        .slice(0, 20)
    : [];
  return {
    ...data,
    title: sanitizeLabel(data.title, 'Table'),
    columns,
    rows,
  };
}

function sanitizeChartData(data: ChartBlockProps['data']): ChartBlockProps['data'] | null {
  const chartType = typeof data?.type === 'string' ? data.type : 'bar';

  switch (chartType) {
    case 'donut':
      return {
        ...data,
        title: sanitizeLabel(data.title, 'Chart'),
        data: sanitizeSeries(data.data, { positiveOnly: true }),
        total_label: typeof data.total_label === 'string' ? data.total_label.trim() : undefined,
      };
    case 'stacked_bar':
      return {
        ...data,
        title: sanitizeLabel(data.title, 'Chart'),
        data: sanitizeStackedBar(data.data),
      };
    case 'metric':
      return sanitizeMetric(data);
    case 'table':
      return sanitizeTable(data);
    case 'line':
      return {
        ...data,
        title: sanitizeLabel(data.title, 'Chart'),
        data: sanitizeSeries(data.data, { allowNegative: true }),
      };
    case 'bar':
    default:
      return {
        ...data,
        title: sanitizeLabel(data.title, 'Chart'),
        data: sanitizeSeries(data.data, { positiveOnly: true }),
      };
  }
}

/**
 * Count meaningful (non-zero) items in a label/value data array.
 * Returns 0 if data is not a valid array.
 */
function countMeaningfulItems(data: any): number {
  if (!Array.isArray(data)) return 0;
  return data.filter(item => item && typeof item.value === 'number' && item.value > 0).length;
}

function countFiniteItems(data: any): number {
  if (!Array.isArray(data)) return 0;
  return data.filter(item => item && typeof item.value === 'number' && Number.isFinite(item.value)).length;
}

export const ChartBlock: React.FC<ChartBlockProps> = ({ data }) => {
  const safeData = sanitizeChartData(data);
  if (!safeData) return null;

  // Minimum-data gate: bar, donut, stacked_bar, line need ≥2 meaningful items
  // A single bar/slice/point is not a chart — the agent should use text or metric instead
  const chartType = safeData.type || 'bar';
  if (['bar', 'donut'].includes(chartType)) {
    if (countMeaningfulItems(safeData.data) < 2) return null;
  }
  if (chartType === 'line') {
    if (countFiniteItems(safeData.data) < 2) return null;
  }
  if (chartType === 'stacked_bar') {
    const items = Array.isArray(safeData.data) ? safeData.data : [];
    if (items.length < 2) return null;
  }

  switch (chartType) {
    case 'donut':
      return <DonutChart title={safeData.title} data={safeData.data} total_label={safeData.total_label} />;

    case 'stacked_bar':
      return <StackedBarChart title={safeData.title} data={safeData.data} />;

    case 'metric':
      return <MetricCard title={safeData.title} value={safeData.value} unit={safeData.unit} trend={safeData.trend} />;

    case 'table':
      return <TableChart title={safeData.title} columns={safeData.columns} rows={safeData.rows} />;

    case 'line':
      return <LineChart title={safeData.title} data={safeData.data} />;

    case 'bar':
    default:
      return <BarChart title={safeData.title} data={safeData.data || []} />;
  }
};

export default ChartBlock;
