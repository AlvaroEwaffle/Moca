import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ConversationAnalytics {
  totalConversations: number;
  conversationsByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  averageConversationLength: number;
  averageMessagesPerConversation: number;
  conversationsByDay: Array<{
    date: string;
    count: number;
  }>;
  peakActivityHours: Array<{
    hour: number;
    count: number;
  }>;
}

interface ConversationTrendsChartProps {
  data: ConversationAnalytics | null;
}

const ConversationTrendsChart: React.FC<ConversationTrendsChartProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <p>No conversation trends data available</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const dailyData = data.conversationsByDay.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: item.count
  }));

  const hourlyData = data.peakActivityHours.map(item => ({
    hour: `${item.hour}:00`,
    count: item.count
  }));

  const statusData = data.conversationsByStatus.map(item => ({
    status: item.status,
    count: item.count,
    percentage: item.percentage
  }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{data.totalConversations}</div>
          <div className="text-sm text-gray-600">Total Conversations</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{data.averageConversationLength.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Avg Length (messages)</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{data.averageMessagesPerConversation.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Avg Messages/Conv</div>
        </div>
      </div>

      {/* Daily Trends Chart */}
      {dailyData.length > 0 && (
        <div className="h-64">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Conversations by Day</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: any, name: string) => [value, 'Conversations']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#8B5CF6" 
                strokeWidth={2}
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Peak Activity Hours */}
      {hourlyData.length > 0 && (
        <div className="h-64">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Peak Activity Hours</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: any, name: string) => [value, 'Conversations']}
                labelFormatter={(label) => `Hour: ${label}`}
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
      )}

      {/* Conversation Status Distribution */}
      {statusData.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Conversation Status Distribution</h4>
          <div className="space-y-2">
            {statusData.map((item, index) => (
              <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{item.status}</div>
                    <div className="text-sm text-gray-600">{item.count} conversations</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{item.percentage}%</div>
                  <div className="text-sm text-gray-600">of total</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationTrendsChart;
