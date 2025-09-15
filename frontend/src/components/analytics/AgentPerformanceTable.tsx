import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  MessageSquare, 
  Target,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface AgentPerformance {
  accountId: string;
  accountName: string;
  totalConversations: number;
  averageLeadScore: number;
  responseCount: number;
  errorCount: number;
  averageResponseTime: number;
  successRate: number;
  agentDisabledCount: number;
  milestoneAchievedCount: number;
}

interface AgentPerformanceTableProps {
  data: AgentPerformance[];
}

const AgentPerformanceTable: React.FC<AgentPerformanceTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No agent performance data available</p>
        </div>
      </div>
    );
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 bg-green-100';
    if (rate >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getLeadScoreColor = (score: number) => {
    if (score >= 5) return 'text-green-600 bg-green-100';
    if (score >= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 2) return 'text-green-600 bg-green-100';
    if (time <= 5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Account
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversations
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lead Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Responses
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Success Rate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Response Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Milestones
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((agent, index) => (
            <tr key={agent.accountId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {agent.accountName}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {agent.accountId}
                    </div>
                  </div>
                </div>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <MessageSquare className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    {agent.totalConversations}
                  </span>
                </div>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge className={getLeadScoreColor(agent.averageLeadScore)}>
                  <Target className="w-3 h-3 mr-1" />
                  {agent.averageLeadScore.toFixed(1)}/7
                </Badge>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {agent.responseCount}
                </div>
                {agent.errorCount > 0 && (
                  <div className="text-xs text-red-600">
                    {agent.errorCount} errors
                  </div>
                )}
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge className={getSuccessRateColor(agent.successRate)}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {agent.successRate.toFixed(1)}%
                </Badge>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge className={getResponseTimeColor(agent.averageResponseTime)}>
                  <Clock className="w-3 h-3 mr-1" />
                  {agent.averageResponseTime.toFixed(1)}s
                </Badge>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-gray-900">
                    {agent.milestoneAchievedCount}
                  </span>
                </div>
              </td>
              
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  {agent.agentDisabledCount > 0 ? (
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="w-3 h-3 mr-1" />
                      {agent.agentDisabledCount} disabled
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AgentPerformanceTable;
