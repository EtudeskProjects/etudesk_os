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
import { RadarChart } from './charts/RadarChart';
import { LineChart } from './charts/LineChart';

interface ChartBlockProps {
  data: {
    type: string;
    title: string;
    [key: string]: any;
  };
}

/**
 * Count meaningful (non-zero) items in a label/value data array.
 * Returns 0 if data is not a valid array.
 */
function countMeaningfulItems(data: any): number {
  if (!Array.isArray(data)) return 0;
  return data.filter(item => item && typeof item.value === 'number' && item.value > 0).length;
}

export const ChartBlock: React.FC<ChartBlockProps> = ({ data }) => {
  // Minimum-data gate: bar, donut, stacked_bar, line need ≥2 meaningful items
  // A single bar/slice/point is not a chart — the agent should use text or metric instead
  const chartType = data.type || 'bar';
  if (['bar', 'donut', 'line'].includes(chartType)) {
    if (countMeaningfulItems(data.data) < 2) return null;
  }
  if (chartType === 'stacked_bar') {
    const items = Array.isArray(data.data) ? data.data : [];
    if (items.length < 2) return null;
  }

  switch (chartType) {
    case 'donut':
      return <DonutChart title={data.title} data={data.data} total_label={data.total_label} />;

    case 'stacked_bar':
      return <StackedBarChart title={data.title} data={data.data} />;

    case 'metric':
      return <MetricCard title={data.title} value={data.value} unit={data.unit} trend={data.trend} />;

    case 'table':
      return <TableChart title={data.title} columns={data.columns} rows={data.rows} />;

    case 'radar':
      return <RadarChart title={data.title} axes={data.axes} series={data.series} max={data.max} />;

    case 'line':
      return <LineChart title={data.title} data={data.data} />;

    case 'bar':
    default:
      return <BarChart title={data.title} data={data.data || []} />;
  }
};

export default ChartBlock;
