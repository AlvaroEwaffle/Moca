import { useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Save,
  Send,
  Settings,
  Clock,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  FileText,
  BarChart3
} from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface FollowUpConfig {
  userId: string;
  accountId: string;
  enabled: boolean;
  minLeadScore: number;
  maxFollowUps: number;
  timeSinceLastAnswer: number;
  messageMode: 'template' | 'ai';
  messageTemplate: string;
}

interface FollowUpStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
}

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
}

interface FollowUpHistoryItem {
  _id: string;
  conversationId: {
    _id: string;
    leadScoring?: { currentScore: number };
  };
  contactId: {
    name?: string;
    psid?: string;
  };
  status: string;
  scheduledAt: string;
  sentAt?: string;
  messageTemplate: string;
  createdAt: string;
}

export default function FollowUps() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [config, setConfig] = useState<FollowUpConfig | null>(null);
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [history, setHistory] = useState<FollowUpHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const token = localStorage.getItem('accessToken');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/instagram/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const accts = data.data?.accounts || data.data || data;
        setAccounts(Array.isArray(accts) ? accts : []);
        if (accts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accts[0].accountId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [token, selectedAccountId]);

  const fetchConfig = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/follow-ups/config/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchStats = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/follow-ups/stats/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [token]);

  const fetchHistory = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/follow-ups/history/${accountId}?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.followUps || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchConfig(selectedAccountId);
      fetchStats(selectedAccountId);
      fetchHistory(selectedAccountId);
    }
  }, [selectedAccountId, fetchConfig, fetchStats, fetchHistory]);

  const handleSave = async () => {
    if (!config || !selectedAccountId) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/follow-ups/config/${selectedAccountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: config.enabled,
          minLeadScore: config.minLeadScore,
          maxFollowUps: config.maxFollowUps,
          timeSinceLastAnswer: config.timeSinceLastAnswer,
          messageMode: config.messageMode,
          messageTemplate: config.messageTemplate
        })
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Follow-up configuration updated." });
        fetchConfig(selectedAccountId);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to save", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!selectedAccountId) return;
    setSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/follow-ups/send/${selectedAccountId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Sent", description: data.message });
        fetchStats(selectedAccountId);
        fetchHistory(selectedAccountId);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to send", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      delivered: { color: 'bg-green-100 text-green-800', label: 'Delivered' },
      responded: { color: 'bg-emerald-100 text-emerald-800', label: 'Responded' },
      converted: { color: 'bg-purple-100 text-purple-800', label: 'Converted' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed' }
    };
    const v = variants[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.label}</span>;
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Follow-Ups | Moca</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-Up Configuration</h1>
          <p className="text-muted-foreground">Configure automatic follow-up messages for leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.accountId} value={a.accountId}>
                  @{a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Follow-ups</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus?.sent || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus?.failed || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Configure when and how follow-up messages are sent to leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Enable Follow-ups</Label>
                <p className="text-sm text-muted-foreground">Automatically send follow-up messages to qualified leads.</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>

            {/* Min lead score */}
            <div className="space-y-2">
              <Label>Minimum Lead Score ({config.minLeadScore}/7)</Label>
              <Slider
                value={[config.minLeadScore]}
                onValueChange={([val]) => setConfig({ ...config, minLeadScore: val })}
                min={1}
                max={7}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Only send follow-ups to leads with a score of {config.minLeadScore} or higher.
              </p>
            </div>

            {/* Max follow-ups */}
            <div className="space-y-2">
              <Label>Max Follow-ups per Lead</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.maxFollowUps}
                onChange={(e) => setConfig({ ...config, maxFollowUps: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of follow-up messages per lead before stopping.
              </p>
            </div>

            {/* Time delay */}
            <div className="space-y-2">
              <Label>Hours Since Last Answer</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={config.timeSinceLastAnswer}
                onChange={(e) => setConfig({ ...config, timeSinceLastAnswer: parseInt(e.target.value) || 12 })}
              />
              <p className="text-xs text-muted-foreground">
                Wait this many hours after last activity before sending a follow-up.
              </p>
            </div>

            {/* Message mode */}
            <div className="space-y-2">
              <Label>Message Mode</Label>
              <Select
                value={config.messageMode}
                onValueChange={(val: 'template' | 'ai') => setConfig({ ...config, messageMode: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Template
                    </div>
                  </SelectItem>
                  <SelectItem value="ai">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Generated
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {config.messageMode === 'template'
                  ? 'Use a fixed template with {name} personalization.'
                  : 'AI generates contextual follow-ups based on conversation history.'}
              </p>
            </div>

            {/* Template editor */}
            {config.messageMode === 'template' && (
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea
                  value={config.messageTemplate}
                  onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
                  placeholder="Hola {name}! Vi que te interesaste..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{name}'} to insert the contact's name.
                </p>
              </div>
            )}

            {/* Template preview */}
            {config.messageMode === 'template' && config.messageTemplate && (
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  <strong>Preview:</strong>{' '}
                  {config.messageTemplate.replace(/\{name\}/g, 'Maria')}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Configuration
              </Button>
              <Button variant="outline" onClick={handleSendNow} disabled={sending || !config.enabled}>
                {sending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item._id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {item.contactId?.name || item.contactId?.psid || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                      {item.messageTemplate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.conversationId?.leadScoring?.currentScore && (
                      <Badge variant="outline">Score {item.conversationId.leadScoring.currentScore}</Badge>
                    )}
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
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
