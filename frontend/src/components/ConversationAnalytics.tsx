import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface ConversationAnalyticsProps {
  analytics: {
    leadProgression: {
      trend: 'improving' | 'declining' | 'stable';
      averageScore: number;
      peakScore: number;
      progressionRate: number;
    };
    repetitionPatterns: string[];
    conversationFlow: {
      totalTurns: number;
      averageTurnLength: number;
      questionCount: number;
      responseCount: number;
    };
  };
  aiResponseMetadata: {
    lastResponseType: 'structured' | 'fallback';
    lastIntent?: string;
    lastNextAction?: string;
    repetitionDetected: boolean;
    contextAwareness: boolean;
    businessNameUsed?: string;
    responseQuality: number;
  };
}

const ConversationAnalytics: React.FC<ConversationAnalyticsProps> = ({
  analytics,
  aiResponseMetadata
}) => {
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      default:
        return '➡️';
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return 'text-green-600';
    if (quality >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Lead Progression */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lead Progression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Trend:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm">{getTrendIcon(analytics.leadProgression.trend)}</span>
              <span className={`text-sm font-medium ${getTrendColor(analytics.leadProgression.trend)}`}>
                {analytics.leadProgression.trend}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Average Score:</span>
            <span className="text-sm font-medium">{analytics.leadProgression.averageScore.toFixed(1)}/10</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Peak Score:</span>
            <span className="text-sm font-medium">{analytics.leadProgression.peakScore}/10</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Progression Rate:</span>
            <span className="text-sm font-medium">{Math.round(analytics.leadProgression.progressionRate * 100)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* AI Response Metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">AI Response Quality</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Response Type:</span>
            <Badge variant={aiResponseMetadata.lastResponseType === 'structured' ? 'default' : 'secondary'}>
              {aiResponseMetadata.lastResponseType}
            </Badge>
          </div>
          
          {aiResponseMetadata.lastIntent && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Intent:</span>
              <span className="text-sm font-medium">{aiResponseMetadata.lastIntent}</span>
            </div>
          )}
          
          {aiResponseMetadata.lastNextAction && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Action:</span>
              <span className="text-sm font-medium">{aiResponseMetadata.lastNextAction}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Quality Score:</span>
            <span className={`text-sm font-medium ${getQualityColor(aiResponseMetadata.responseQuality)}`}>
              {Math.round(aiResponseMetadata.responseQuality * 100)}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Context Aware:</span>
            <Badge variant={aiResponseMetadata.contextAwareness ? 'default' : 'secondary'}>
              {aiResponseMetadata.contextAwareness ? 'Yes' : 'No'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Repetition Detected:</span>
            <Badge variant={aiResponseMetadata.repetitionDetected ? 'destructive' : 'default'}>
              {aiResponseMetadata.repetitionDetected ? 'Yes' : 'No'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Flow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversation Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Turns:</span>
            <span className="text-sm font-medium">{analytics.conversationFlow.totalTurns}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Questions Asked:</span>
            <span className="text-sm font-medium">{analytics.conversationFlow.questionCount}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Bot Responses:</span>
            <span className="text-sm font-medium">{analytics.conversationFlow.responseCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Repetition Patterns */}
      {analytics.repetitionPatterns && analytics.repetitionPatterns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Repetition Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {analytics.repetitionPatterns.map((pattern, index) => (
                <Badge key={index} variant="destructive" className="text-xs">
                  {pattern}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConversationAnalytics;
