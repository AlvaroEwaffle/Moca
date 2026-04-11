import { useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  TrendingUp,
  Users,
  Target,
  ArrowRight
} from "lucide-react";
import { Helmet } from "react-helmet";

interface FunnelStep {
  score: number;
  stepName: string;
  count: number;
  percentage: number;
  conversionRate: number;
}

interface FollowUpStats {
  totalSent: number;
  totalResponded: number;
  totalConverted: number;
  totalFailed: number;
  totalPending: number;
  responseRate: number;
  conversionRate: number;
}

export default function Funnel() {
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [total, setTotal] = useState(0);
  const [followUpStats, setFollowUpStats] = useState<FollowUpStats | null>(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('accessToken');

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/funnel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFunnel(data.data?.funnel || []);
        setTotal(data.data?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch funnel:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchFollowUpStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/follow-up-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUpStats(data.data || null);
      }
    } catch (err) {
      console.error('Failed to fetch follow-up stats:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchFunnel();
    fetchFollowUpStats();
  }, [fetchFunnel, fetchFollowUpStats]);

  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  const getBarColor = (score: number): string => {
    const colors: Record<number, string> = {
      1: 'bg-slate-400',
      2: 'bg-blue-400',
      3: 'bg-cyan-400',
      4: 'bg-emerald-400',
      5: 'bg-yellow-400',
      6: 'bg-orange-400',
      7: 'bg-green-500'
    };
    return colors[score] || 'bg-gray-400';
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Conversion Funnel | Moca</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversion Funnel</h1>
          <p className="text-muted-foreground">Lead score distribution and conversion rates across your pipeline.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchFunnel(); fetchFollowUpStats(); }} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score 3+ (Interested)</CardTitle>
            <Target className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {funnel.filter(f => f.score >= 3).reduce((sum, f) => sum + f.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {total > 0
                ? `${Math.round((funnel.filter(f => f.score >= 3).reduce((sum, f) => sum + f.count, 0) / total) * 100)}%`
                : '0%'} of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score 5+ (Hot Leads)</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {funnel.filter(f => f.score >= 5).reduce((sum, f) => sum + f.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {total > 0
                ? `${Math.round((funnel.filter(f => f.score >= 5).reduce((sum, f) => sum + f.count, 0) / total) * 100)}%`
                : '0%'} of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>Number of conversations at each lead score level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funnel.map((step, idx) => (
              <div key={step.score} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 text-center justify-center">
                      {step.score}
                    </Badge>
                    <span className="font-medium">{step.stepName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{step.count} leads</span>
                    <span className="text-muted-foreground w-14 text-right">{step.percentage}%</span>
                    {idx > 0 && (
                      <div className="flex items-center gap-1 w-24 justify-end">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className={`text-xs font-medium ${
                          step.conversionRate >= 50 ? 'text-green-600' :
                          step.conversionRate >= 20 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {step.conversionRate}%
                        </span>
                      </div>
                    )}
                    {idx === 0 && <div className="w-24" />}
                  </div>
                </div>
                <div className="h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(step.score)}`}
                    style={{ width: `${Math.max((step.count / maxCount) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up effectiveness */}
      {followUpStats && (
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Effectiveness</CardTitle>
            <CardDescription>How well follow-up messages are performing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center">
                <p className="text-2xl font-bold">{followUpStats.totalSent}</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{followUpStats.totalResponded}</p>
                <p className="text-xs text-muted-foreground">Responded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{followUpStats.totalConverted}</p>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{followUpStats.responseRate}%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{followUpStats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
