import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
  }>;
}

export interface ChartComponentProps {
  title: string;
  data: ChartData;
  type: 'line' | 'bar' | 'pie';
  height?: number;
  showLegend?: boolean;
}

const COLORS = [
  '#2563EB', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#06B6D4', // cyan
];

export const ChartComponent: React.FC<ChartComponentProps> = ({
  title,
  data,
  type,
  height = 300,
  showLegend = true,
}) => {
  // Convert dashboard format to recharts format
  const rechartData = data.labels.map((label, index) => {
    const item: any = { name: label };
    data.datasets.forEach((dataset) => {
      item[dataset.label] = dataset.data[index];
    });
    return item;
  });

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={rechartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {showLegend && <Legend />}
              {data.datasets.map((dataset, index) => (
                <Line
                  key={`line-${index}`}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={dataset.borderColor || COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: dataset.borderColor || COLORS[index % COLORS.length], r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={rechartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {showLegend && <Legend />}
              {data.datasets.map((dataset, index) => (
                <Bar
                  key={`bar-${index}`}
                  dataKey={dataset.label}
                  fill={dataset.backgroundColor || COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={rechartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={data.datasets[0]?.label || 'value'}
              >
                {rechartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {showLegend && <Legend />}
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <div className="w-full overflow-x-auto">{renderChart()}</div>
    </div>
  );
};

export default ChartComponent;
