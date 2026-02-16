/**
 * ChartBlock Component — Router that dispatches to chart sub-components
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

export const ChartBlock: React.FC<ChartBlockProps> = ({ data }) => {
  switch (data.type) {
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
