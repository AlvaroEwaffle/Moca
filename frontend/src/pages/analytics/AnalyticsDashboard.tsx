import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Download,
  Settings,
  TrendingUp,
  Users,
  MessageSquare,
  Target,
  BarChart3,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Import chart components
import MetricCard from '@/components/analytics/MetricCard';
import LeadScoreChart from '@/components/analytics/LeadScoreChart';
import AgentPerformanceTable from '@/components/analytics/AgentPerformanceTable';
import SystemStatusWidget from '@/components/analytics/SystemStatusWidget';
import ConversationTrendsChart from '@/components/analytics/ConversationTrendsChart';

import { BACKEND_URL } from '@/utils/config';

interface DateRange {
  start: Date;
  end: Date;
}

interface OverviewMetrics {
  totalConversations: number;
  activeConversations: number;
  averageLeadScore: number;
  responseSuccessRate: number;
  milestoneAchievementRate: number;
  totalMessages: number;
  averageResponseTime: number;
  agentDisablementRate: number;
}

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

interface SystemHealthMetrics {
  totalAccounts: number;
  activeAccounts: number;
  totalContacts: number;
  totalMessages: number;
  averageProcessingTime: number;
  errorRate: number;
  queueStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  globalAgentConfig: {
    responseLimitsEnabled: boolean;
    leadScoreAutoDisableEnabled: boolean;
    milestoneAutoDisableEnabled: boolean;
  };
}

const AnalyticsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });

  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [leadScoringAnalytics, setLeadScoringAnalytics] = useState<LeadScoringAnalytics | null>(null);
  const [conversationAnalytics, setConversationAnalytics] = useState<ConversationAnalytics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        fetchOverviewMetrics(),
        fetchAgentPerformance(),
        fetchLeadScoringAnalytics(),
        fetchConversationAnalytics(),
        fetchSystemHealth()
      ]);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const fetchOverviewMetrics = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Mock data for testing when not authenticated
        setOverviewMetrics({
          totalConversations: 150,
          activeConversations: 25,
          averageLeadScore: 3.2,
          responseSuccessRate: 95.5,
          milestoneAchievementRate: 78.3,
          totalMessages: 1250,
          averageResponseTime: 1.8,
          agentDisablementRate: 12.5
        });
        return;
      }

      const response = await fetch(
        `${BACKEND_URL}/api/analytics/overview?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setOverviewMetrics(data.data);
      }
    } catch (error) {
      console.error('Error fetching overview metrics:', error);
      // Fallback to mock data
      setOverviewMetrics({
        totalConversations: 150,
        activeConversations: 25,
        averageLeadScore: 3.2,
        responseSuccessRate: 95.5,
        milestoneAchievementRate: 78.3,
        totalMessages: 1250,
        averageResponseTime: 1.8,
        agentDisablementRate: 12.5
      });
    }
  };

  const fetchAgentPerformance = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Mock data for testing when not authenticated
        setAgentPerformance([
          {
            accountId: 'account_123',
            accountName: 'My Business Account',
            totalConversations: 45,
            averageLeadScore: 3.8,
            responseCount: 120,
            errorCount: 3,
            averageResponseTime: 1.5,
            successRate: 97.5,
            agentDisabledCount: 2,
            milestoneAchievedCount: 8
          },
          {
            accountId: 'account_456',
            accountName: 'Another Account',
            totalConversations: 32,
            averageLeadScore: 2.9,
            responseCount: 85,
            errorCount: 1,
            averageResponseTime: 2.1,
            successRate: 98.8,
            agentDisabledCount: 0,
            milestoneAchievedCount: 5
          }
        ]);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/analytics/agents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setAgentPerformance(data.data);
      }
    } catch (error) {
      console.error('Error fetching agent performance:', error);
      // Fallback to mock data
      setAgentPerformance([
        {
          accountId: 'account_123',
          accountName: 'My Business Account',
          totalConversations: 45,
          averageLeadScore: 3.8,
          responseCount: 120,
          errorCount: 3,
          averageResponseTime: 1.5,
          successRate: 97.5,
          agentDisabledCount: 2,
          milestoneAchievedCount: 8
        }
      ]);
    }
  };

  const fetchLeadScoringAnalytics = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Mock data for testing when not authenticated
        setLeadScoringAnalytics({
          scoreDistribution: [
            { score: 1, count: 25, percentage: 16.7, stepName: 'Contact Received' },
            { score: 2, count: 30, percentage: 20.0, stepName: 'Answers 1 Question' },
            { score: 3, count: 35, percentage: 23.3, stepName: 'Confirms Interest' },
            { score: 4, count: 28, percentage: 18.7, stepName: 'Milestone Met' },
            { score: 5, count: 20, percentage: 13.3, stepName: 'Reminder Sent' },
            { score: 6, count: 8, percentage: 5.3, stepName: 'Reminder Answered' },
            { score: 7, count: 4, percentage: 2.7, stepName: 'Sales Done' }
          ],
          averageScore: 3.2,
          progressionRate: 65.0,
          topPerformingScores: [
            { score: 4, stepName: 'Milestone Met', count: 28 },
            { score: 3, stepName: 'Confirms Interest', count: 35 },
            { score: 2, stepName: 'Answers 1 Question', count: 30 }
          ]
        });
        return;
      }

      const response = await fetch(
        `${BACKEND_URL}/api/analytics/leads?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setLeadScoringAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching lead scoring analytics:', error);
      // Fallback to mock data
      setLeadScoringAnalytics({
        scoreDistribution: [
          { score: 1, count: 25, percentage: 16.7, stepName: 'Contact Received' },
          { score: 2, count: 30, percentage: 20.0, stepName: 'Answers 1 Question' },
          { score: 3, count: 35, percentage: 23.3, stepName: 'Confirms Interest' }
        ],
        averageScore: 3.2,
        progressionRate: 65.0,
        topPerformingScores: [
          { score: 4, stepName: 'Milestone Met', count: 28 }
        ]
      });
    }
  };

  const fetchConversationAnalytics = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Mock data for testing when not authenticated
        setConversationAnalytics({
          totalConversations: 150,
          conversationsByStatus: [
            { status: 'open', count: 25, percentage: 16.7 },
            { status: 'closed', count: 125, percentage: 83.3 }
          ],
          averageConversationLength: 8.3,
          averageMessagesPerConversation: 12.5,
          conversationsByDay: [
            { date: '2024-01-15', count: 5 },
            { date: '2024-01-16', count: 8 },
            { date: '2024-01-17', count: 12 }
          ],
          peakActivityHours: [
            { hour: 14, count: 8 },
            { hour: 15, count: 12 },
            { hour: 16, count: 10 }
          ]
        });
        return;
      }

      const response = await fetch(
        `${BACKEND_URL}/api/analytics/conversations?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setConversationAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching conversation analytics:', error);
      // Fallback to mock data
      setConversationAnalytics({
        totalConversations: 150,
        conversationsByStatus: [
          { status: 'open', count: 25, percentage: 16.7 },
          { status: 'closed', count: 125, percentage: 83.3 }
        ],
        averageConversationLength: 8.3,
        averageMessagesPerConversation: 12.5,
        conversationsByDay: [],
        peakActivityHours: []
      });
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${BACKEND_URL}/api/analytics/system`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setSystemHealth(data.data);
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  };

  const exportData = async (type: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${BACKEND_URL}/api/analytics/export?type=${type}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchAllData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor your chatbot performance and system health</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={refreshData}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => exportData('overview')}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Conversations"
          value={overviewMetrics?.totalConversations || 0}
          change="+12%"
          trend="up"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Conversations"
          value={overviewMetrics?.activeConversations || 0}
          change="+5%"
          trend="up"
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Average Lead Score"
          value={overviewMetrics?.averageLeadScore?.toFixed(1) || '0.0'}
          change="+0.3"
          trend="up"
          icon={<Target className="w-5 h-5" />}
        />
        <MetricCard
          title="Response Success Rate"
          value={`${overviewMetrics?.responseSuccessRate || 0}%`}
          change="+2%"
          trend="up"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Messages"
          value={overviewMetrics?.totalMessages || 0}
          change="+8%"
          trend="up"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${overviewMetrics?.averageResponseTime?.toFixed(1) || '0.0'}s`}
          change="-0.2s"
          trend="up"
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          title="Milestone Achievement"
          value={`${overviewMetrics?.milestoneAchievementRate || 0}%`}
          change="+3%"
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Agent Disablement"
          value={`${overviewMetrics?.agentDisablementRate || 0}%`}
          change="+1%"
          trend="down"
          icon={<XCircle className="w-5 h-5" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              <span>Lead Score Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadScoreChart data={leadScoringAnalytics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-violet-600" />
              <span>Conversation Trends</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationTrendsChart data={conversationAnalytics} />
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-violet-600" />
            <span>Agent Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AgentPerformanceTable data={agentPerformance} />
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-violet-600" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SystemStatusWidget data={systemHealth} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
