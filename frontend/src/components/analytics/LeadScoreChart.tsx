import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface LeadScoringAnalytics {
  scoreDistribution: Array<{
    score: number;
    count: number;
    percentage: number;
    stepName: string;
  }>;
  averageScore: number;
  progressionRate: number;
  topPerformingScores: Array<{
    score: number;
    stepName: string;
    count: number;
  }>;
}

interface LeadScoreChartProps {
  data: LeadScoringAnalytics | null;
}

const COLORS = [
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#C084FC', // Light Purple
  '#DDD6FE', // Very Light Purple
  '#F3E8FF', // Ultra Light Purple
  '#FDF4FF', // Pink
  '#FCE7F3'  // Light Pink
];

const LeadScoreChart: React.FC<LeadScoreChartProps> = ({ data }) => {
  if (!data || !data.scoreDistribution || data.scoreDistribution.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No lead scoring data available</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const barChartData = data.scoreDistribution.map(item => ({
    score: item.score,
    stepName: item.stepName,
    count: item.count,
    percentage: item.percentage
  }));

  const pieChartData = data.scoreDistribution.map(item => ({
    name: item.stepName,
    value: item.count,
    percentage: item.percentage
  }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-violet-50 rounded-lg">
          <div className="text-2xl font-bold text-violet-600">{data.averageScore.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Average Score</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{data.progressionRate}%</div>
          <div className="text-sm text-gray-600">Progression Rate</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{data.scoreDistribution.length}</div>
          <div className="text-sm text-gray-600">Score Levels</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-64">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Lead Score Distribution</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="score" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `Score ${value}`}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              formatter={(value: any, name: string) => [value, 'Conversations']}
              labelFormatter={(label) => `Score ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Bar 
              dataKey="count" 
              fill="#8B5CF6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart */}
      <div className="h-64">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution by Percentage</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any, name: string) => [value, 'Conversations']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performing Scores */}
      {data.topPerformingScores && data.topPerformingScores.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Scores</h4>
          <div className="space-y-2">
            {data.topPerformingScores.map((item, index) => (
              <div key={item.score} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{item.stepName}</div>
                    <div className="text-sm text-gray-600">Score {item.score}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{item.count}</div>
                  <div className="text-sm text-gray-600">conversations</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadScoreChart;
