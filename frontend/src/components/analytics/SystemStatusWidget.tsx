import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Server, 
  Users, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Settings,
  Activity
} from 'lucide-react';

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

interface SystemStatusWidgetProps {
  data: SystemHealthMetrics | null;
}

const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="text-center">
          <Server className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No system health data available</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600 bg-green-100';
    if (value <= thresholds.warning) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getOverallStatus = () => {
    if (data.errorRate > 10) return { status: 'Critical', color: 'text-red-600 bg-red-100', icon: XCircle };
    if (data.errorRate > 5) return { status: 'Warning', color: 'text-yellow-600 bg-yellow-100', icon: AlertCircle };
    return { status: 'Healthy', color: 'text-green-600 bg-green-100', icon: CheckCircle };
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <StatusIcon className="w-6 h-6" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
            <p className="text-sm text-gray-600">Overall system health</p>
          </div>
        </div>
        <Badge className={overallStatus.color}>
          {overallStatus.status}
        </Badge>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Server className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-600">Accounts</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.totalAccounts}</div>
          <div className="text-xs text-gray-500">
            {data.activeAccounts} active
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-600">Contacts</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.totalContacts.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total contacts</div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MessageSquare className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-600">Messages</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.totalMessages.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total messages</div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-600">Processing Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.averageProcessingTime.toFixed(1)}s</div>
          <div className="text-xs text-gray-500">Average response time</div>
        </div>
      </div>

      {/* Error Rate */}
      <div className="p-4 border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-600">Error Rate</span>
          </div>
          <Badge className={getStatusColor(data.errorRate, { good: 2, warning: 5 })}>
            {data.errorRate.toFixed(1)}%
          </Badge>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              data.errorRate <= 2 ? 'bg-green-500' : 
              data.errorRate <= 5 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(data.errorRate * 10, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Queue Status */}
      <div className="p-4 border rounded-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-violet-600" />
          <span className="text-sm font-medium text-gray-600">Queue Status</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">{data.queueStatus.pending}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{data.queueStatus.processing}</div>
            <div className="text-xs text-gray-500">Processing</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{data.queueStatus.completed}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{data.queueStatus.failed}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
        </div>
      </div>

      {/* Global Agent Configuration */}
      <div className="p-4 border rounded-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-violet-600" />
          <span className="text-sm font-medium text-gray-600">Global Agent Configuration</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Response Limits</span>
            <Badge variant={data.globalAgentConfig.responseLimitsEnabled ? "default" : "secondary"}>
              {data.globalAgentConfig.responseLimitsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Lead Score Auto-Disable</span>
            <Badge variant={data.globalAgentConfig.leadScoreAutoDisableEnabled ? "default" : "secondary"}>
              {data.globalAgentConfig.leadScoreAutoDisableEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Milestone Auto-Disable</span>
            <Badge variant={data.globalAgentConfig.milestoneAutoDisableEnabled ? "default" : "secondary"}>
              {data.globalAgentConfig.milestoneAutoDisableEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatusWidget;
