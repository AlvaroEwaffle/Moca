import React from 'react';
import { Badge } from './ui/badge';

interface LeadScoreIndicatorProps {
  score: number;
  progression?: 'increased' | 'decreased' | 'maintained';
  confidence?: number;
  className?: string;
}

const LeadScoreIndicator: React.FC<LeadScoreIndicatorProps> = ({
  score,
  progression = 'maintained',
  confidence = 0.5,
  className = ''
}) => {
  const getScoreColor = (score: number) => {
    if (score <= 2) return 'bg-gray-100 text-gray-600';
    if (score <= 4) return 'bg-blue-100 text-blue-600';
    if (score <= 6) return 'bg-yellow-100 text-yellow-600';
    if (score <= 8) return 'bg-orange-100 text-orange-600';
    return 'bg-green-100 text-green-600';
  };

  const getScoreLabel = (score: number) => {
    const labels = {
      1: 'Contacted',
      2: 'Answered',
      3: 'Shows Interest',
      4: 'Product Interest',
      5: 'Info Request',
      6: 'Demo Request',
      7: 'Scheduling',
      8: 'Proposal Sent',
      9: 'Negotiating',
      10: 'Ready to Close'
    };
    return labels[score as keyof typeof labels] || 'Unknown';
  };

  const getProgressionIcon = (progression: string) => {
    switch (progression) {
      case 'increased':
        return '↗️';
      case 'decreased':
        return '↘️';
      default:
        return '➡️';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="secondary" 
        className={`${getScoreColor(score)} font-medium`}
      >
        {score}/10
      </Badge>
      
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">
          {getScoreLabel(score)}
        </span>
        
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">
            {getProgressionIcon(progression)}
          </span>
          <span className={`text-xs ${getConfidenceColor(confidence)}`}>
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>
      </div>
    </div>
  );
};

export default LeadScoreIndicator;
