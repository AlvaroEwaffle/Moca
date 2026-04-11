import express from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticateToken } from '../middleware/auth';
import Conversation from '../models/conversation.model';
import { LeadFollowUp } from '../models';

const router = express.Router();

// GET overview metrics
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET overview request received');
    
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start and end dates are required' 
      });
    }

    const dateRange = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    // Validate dates
    if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid date format' 
      });
    }

    const metrics = await AnalyticsService.getOverviewMetrics(dateRange);
    
    console.log('✅ [Analytics] Overview metrics fetched successfully');
    res.json({ success: true, data: metrics });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching overview metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch overview metrics' 
    });
  }
});

// GET agent performance
router.get('/agents', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET agents request received');
    
    const { accountId } = req.query;
    const performance = await AnalyticsService.getAgentPerformance(accountId as string);
    
    console.log('✅ [Analytics] Agent performance fetched successfully');
    res.json({ success: true, data: performance });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching agent performance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch agent performance' 
    });
  }
});

// GET lead scoring analytics
router.get('/leads', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET leads request received');
    
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start and end dates are required' 
      });
    }

    const dateRange = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    // Validate dates
    if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid date format' 
      });
    }

    const analytics = await AnalyticsService.getLeadScoringAnalytics(dateRange);
    
    console.log('✅ [Analytics] Lead scoring analytics fetched successfully');
    res.json({ success: true, data: analytics });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching lead scoring analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch lead scoring analytics' 
    });
  }
});

// GET conversation analytics
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET conversations request received');
    
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start and end dates are required' 
      });
    }

    const dateRange = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    // Validate dates
    if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid date format' 
      });
    }

    const analytics = await AnalyticsService.getConversationAnalytics(dateRange);
    
    console.log('✅ [Analytics] Conversation analytics fetched successfully');
    res.json({ success: true, data: analytics });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching conversation analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation analytics' 
    });
  }
});

// GET system health metrics
router.get('/system', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET system request received');
    
    const metrics = await AnalyticsService.getSystemHealthMetrics();
    
    console.log('✅ [Analytics] System health metrics fetched successfully');
    res.json({ success: true, data: metrics });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching system health metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch system health metrics' 
    });
  }
});

// GET real-time metrics
router.get('/realtime', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET realtime request received');
    
    const metrics = await AnalyticsService.getRealTimeMetrics();
    
    console.log('✅ [Analytics] Real-time metrics fetched successfully');
    res.json({ success: true, data: metrics });
    
  } catch (error) {
    console.error('❌ [Analytics] Error fetching real-time metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch real-time metrics' 
    });
  }
});

// GET data export (CSV format)
router.get('/export', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET export request received');
    
    const { type, start, end } = req.query;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Export type is required' 
      });
    }

    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start and end dates are required' 
      });
    }

    const dateRange = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    // Validate dates
    if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid date format' 
      });
    }

    let data;
    let filename;

    switch (type) {
      case 'overview':
        data = await AnalyticsService.getOverviewMetrics(dateRange);
        filename = `overview-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}.csv`;
        break;
      case 'agents':
        data = await AnalyticsService.getAgentPerformance();
        filename = `agents-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}.csv`;
        break;
      case 'leads':
        data = await AnalyticsService.getLeadScoringAnalytics(dateRange);
        filename = `leads-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}.csv`;
        break;
      case 'conversations':
        data = await AnalyticsService.getConversationAnalytics(dateRange);
        filename = `conversations-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}.csv`;
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid export type. Supported types: overview, agents, leads, conversations' 
        });
    }

    // Convert data to CSV format (simplified)
    const csv = convertToCSV(data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    
    console.log('✅ [Analytics] Data exported successfully');
    
  } catch (error) {
    console.error('❌ [Analytics] Error exporting data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export data' 
    });
  }
});

// R2.3: GET conversion funnel — score distribution with conversion rates
router.get('/funnel', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET funnel request received');

    const distribution = await Conversation.aggregate([
      { $match: { status: { $in: ['open', 'closed'] } } },
      {
        $group: {
          _id: '$leadScoring.currentScore',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const total = distribution.reduce((sum: number, d: { count: number }) => sum + d.count, 0);

    // Build funnel with conversion rates
    const funnel = [];
    for (let score = 1; score <= 7; score++) {
      const entry = distribution.find((d: { _id: number }) => d._id === score);
      const count = entry?.count || 0;
      const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

      // Conversion rate: how many of the previous step advanced to this one
      const prevEntry = distribution.find((d: { _id: number }) => d._id === score - 1);
      const prevCount = prevEntry?.count || 0;
      const conversionRate = score === 1
        ? 100
        : prevCount > 0
          ? Math.round((count / prevCount) * 1000) / 10
          : 0;

      const stepNames: Record<number, string> = {
        1: 'Contact Received',
        2: 'Answers 1 Question',
        3: 'Confirms Interest',
        4: 'Milestone Met',
        5: 'Reminder Sent',
        6: 'Reminder Answered',
        7: 'Sales Done'
      };

      funnel.push({
        score,
        stepName: stepNames[score] || `Step ${score}`,
        count,
        percentage,
        conversionRate
      });
    }

    console.log('✅ [Analytics] Funnel data fetched successfully');
    res.json({ success: true, data: { funnel, total } });
  } catch (error) {
    console.error('❌ [Analytics] Error fetching funnel:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch funnel data' });
  }
});

// R2.5: GET follow-up effectiveness stats
router.get('/follow-up-stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET follow-up-stats request received');

    const totalSent = await LeadFollowUp.countDocuments({
      status: { $in: ['sent', 'delivered', 'responded', 'converted'] }
    });
    const totalResponded = await LeadFollowUp.countDocuments({ status: 'responded' });
    const totalConverted = await LeadFollowUp.countDocuments({ status: 'converted' });
    const totalFailed = await LeadFollowUp.countDocuments({ status: 'failed' });
    const totalPending = await LeadFollowUp.countDocuments({ status: 'pending' });

    const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 1000) / 10 : 0;
    const conversionRate = totalSent > 0 ? Math.round((totalConverted / totalSent) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalSent,
        totalResponded,
        totalConverted,
        totalFailed,
        totalPending,
        responseRate,
        conversionRate
      }
    });
  } catch (error) {
    console.error('❌ [Analytics] Error fetching follow-up stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch follow-up stats' });
  }
});

// R2.5: GET average response time by score level
router.get('/response-time', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] GET response-time request received');

    const responseTimeByScore = await Conversation.aggregate([
      { $match: { status: { $in: ['open', 'closed'] }, 'timestamps.lastUserMessage': { $exists: true }, 'timestamps.lastBotMessage': { $exists: true } } },
      {
        $project: {
          score: '$leadScoring.currentScore',
          responseTimeMs: {
            $subtract: ['$timestamps.lastBotMessage', '$timestamps.lastUserMessage']
          }
        }
      },
      { $match: { responseTimeMs: { $gt: 0, $lt: 86400000 } } }, // Filter valid (0-24h)
      {
        $group: {
          _id: '$score',
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const data = responseTimeByScore.map((entry: { _id: number; avgResponseTimeMs: number; count: number }) => ({
      score: entry._id,
      avgResponseTimeMinutes: Math.round(entry.avgResponseTimeMs / 60000),
      count: entry.count
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [Analytics] Error fetching response time:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch response time' });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data: any): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  } else {
    // For single objects, convert to key-value pairs
    const headers = Object.keys(data);
    const csvRows = ['Key,Value'];
    
    for (const key of headers) {
      const value = data[key];
      const stringValue = typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      csvRows.push(`${key},${stringValue}`);
    }
    
    return csvRows.join('\n');
  }
}

export default router;
