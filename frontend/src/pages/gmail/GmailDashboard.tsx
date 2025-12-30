import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { Mail, FileText, TrendingUp, AlertCircle, Play, Pause, Clock, ExternalLink, Plus, Loader2, ChevronDown, ChevronUp, User, MessageSquare, Send, Edit, Filter, Save, Zap, Eye, RotateCw, Trash2, Plug } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Helmet } from 'react-helmet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ActivityMetrics {
  emailsAnalyzed24h: number;
  draftsGenerated: number;
  importantesDetectados: number;
}

interface DraftItem {
  id: string;
  subject: string;
  ruleName?: string;
  ruleId?: string;
  agentId?: string;
  agentName?: string;
  status: string;
  approvalState?: 'new' | 'approved' | 'sent';
  draftId?: string;
  draftContent?: string;
  createdAt: string;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}

interface RuleLog {
  id: string;
  ruleName: string;
  emailsProcessed: number;
  executedAt: string;
  status: 'success' | 'error';
  error?: string;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'paused';
  lastExecution?: string;
  enabledRules: number;
  totalDrafts: number;
}

const GmailDashboard = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    emailsAnalyzed24h: 0,
    draftsGenerated: 0,
    importantesDetectados: 0
  });
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [logs, setLogs] = useState<RuleLog[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logThreads, setLogThreads] = useState<Record<string, any[]>>({});
  const [loadingThreads, setLoadingThreads] = useState<Record<string, boolean>>({});
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null);
  const [draftThread, setDraftThread] = useState<any>(null);
  const [loadingDraftThread, setLoadingDraftThread] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);
  const [agentEmails, setAgentEmails] = useState<any[]>([]);
  const [loadingAgentEmails, setLoadingAgentEmails] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [draftFilter, setDraftFilter] = useState<'all' | 'new' | 'approved' | 'sent'>('all');
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null);
  const [editDraftContent, setEditDraftContent] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [executingRule, setExecutingRule] = useState<string | null>(null);
  const [draftQueue, setDraftQueue] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [resettingDraft, setResettingDraft] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!accessToken) {
      setGmailConnected(false);
      return;
    }
    try {
      const resp = await fetch(`${BACKEND_URL}/api/integrations`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      if (resp.ok && data.data) {
        const gmailIntegration = (data.data as any[]).find(
          (i) => i.type === 'gmail' && i.status === 'connected'
        );
        setGmailConnected(!!gmailIntegration);
      } else {
        setGmailConnected(false);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setGmailConnected(false);
    }
  }, [accessToken]);

  const handleConnectGmail = useCallback(async () => {
    if (!accessToken) {
      toast({
        title: 'Sesión requerida',
        description: 'Inicia sesión para conectar Gmail.',
        variant: 'destructive'
      });
      return;
    }
    setConnecting(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/integrations/google/auth-url?scope=gmail`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      if (resp.ok && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        throw new Error(data.error || 'No se pudo generar el enlace de conexión');
      }
    } catch (error: any) {
      toast({
        title: 'Error al conectar Gmail',
        description: error.message || 'Intenta nuevamente más tarde',
        variant: 'destructive'
      });
      setConnecting(false);
    }
  }, [accessToken, toast]);

  const fetchDashboardData = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    // If not connected, skip data fetch
    if (gmailConnected === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch metrics (last 24h)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      // Fetch drafts with filter
      const filterParam = draftFilter !== 'all' ? `&approvalState=${draftFilter}` : '';
      const draftsResponse = await fetch(`${BACKEND_URL}/api/gmail/drafts?limit=50&sort=-createdAt${filterParam}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const draftsData = await draftsResponse.json();
      
      // Initialize draftsWithRules as empty array
      let draftsWithRules: DraftItem[] = [];
      
      if (draftsData.success && draftsData.data) {
        // Get rule names for drafts
        draftsWithRules = await Promise.all(
          draftsData.data.map(async (draft: any) => {
            let ruleName = 'Manual';
            if (draft.ruleId) {
              try {
                const ruleResponse = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${draft.ruleId}`, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                const ruleData = await ruleResponse.json();
                if (ruleData.success) {
                  ruleName = ruleData.data.name;
                }
              } catch (e) {
                console.error('Error fetching rule:', e);
              }
            }
            return {
              id: draft.id,
              subject: draft.subject || '(Sin asunto)',
              ruleName,
              ruleId: draft.ruleId,
              agentId: draft.agentId,
              agentName: draft.agentId ? 'Agent' : undefined, // TODO: Fetch agent name
              status: draft.status,
              approvalState: draft.approvalState || 'new',
              draftId: draft.draftId,
              draftContent: draft.draftContent,
              createdAt: draft.createdAt,
              error: draft.error,
              retryCount: draft.retryCount,
              maxRetries: draft.maxRetries
            };
          })
        );
        setDrafts(draftsWithRules);

        // Calculate metrics
        const last24h = new Date();
        last24h.setHours(last24h.getHours() - 24);
        
        const recentDrafts = draftsWithRules.filter(d => 
          new Date(d.createdAt) >= last24h
        );

        setMetrics({
          emailsAnalyzed24h: 0, // TODO: Calculate from interaction logs
          draftsGenerated: recentDrafts.length,
          importantesDetectados: 0 // TODO: Calculate from labels/importance
        });
      }

      // Fetch rules for logs
      const rulesResponse = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const rulesData = await rulesResponse.json();

      if (rulesData.success && rulesData.data) {
        // Build logs from rules metadata
        const ruleLogs: RuleLog[] = rulesData.data
          .filter((rule: any) => rule.lastRunAt)
          .map((rule: any) => ({
            id: rule.id,
            ruleName: rule.name,
            emailsProcessed: rule.metadata?.totalEmailsFetched || 0,
            executedAt: rule.lastRunAt,
            status: rule.metadata?.lastError ? 'error' : 'success',
            error: rule.metadata?.lastError
          }))
          .sort((a: RuleLog, b: RuleLog) => 
            new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
          )
          .slice(0, 10);

        setLogs(ruleLogs);
      }

      // Build agent statuses from Gmail fetch rules
      // Each rule acts as an "agent" for Gmail
      const rulesAsAgents: AgentStatus[] = (rulesData.data || []).map((rule: any) => {
        // Count drafts for this rule
        const ruleDrafts = draftsWithRules.filter((d: any) => 
          d.ruleId === rule.id || d.ruleName === rule.name
        );

        return {
          id: rule.id || rule._id,
          name: rule.name,
          status: rule.enabled ? 'active' : 'paused',
          lastExecution: rule.lastRunAt,
          enabledRules: rule.enabled ? 1 : 0,
          totalDrafts: ruleDrafts.length
        };
      });

      // Also fetch traditional agents and merge with rules
      try {
        const agentsResponse = await fetch(`${BACKEND_URL}/api/agents`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const agentsData = await agentsResponse.json();

        if (agentsData.success && agentsData.data) {
          // Build agent statuses for traditional agents that have Gmail rules
          const agentsWithStatus = await Promise.all(
            agentsData.data.map(async (agent: any) => {
              // Count enabled rules for this agent
              const agentRules = rulesData.data?.filter((r: any) => 
                r.agentId === agent.id && r.enabled
              ) || [];

              // Only include agents that have Gmail rules
              if (agentRules.length === 0) return null;

              // Count drafts for this agent
              const agentDrafts = draftsWithRules.filter((d: any) => 
                d.agentId === agent.id
              );

              // Get last execution from rules
              const lastExecution = agentRules
                .filter((r: any) => r.lastRunAt)
                .sort((a: any, b: any) => 
                  new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime()
                )[0]?.lastRunAt;

              return {
                id: agent.id,
                name: agent.name,
                status: agent.status === 'active' ? 'active' : 'paused',
                lastExecution,
                enabledRules: agentRules.length,
                totalDrafts: agentDrafts.length
              };
            })
          );

          // Merge rules as agents with traditional agents
          const allAgents = [
            ...rulesAsAgents,
            ...agentsWithStatus.filter((a): a is AgentStatus => a !== null)
          ];
          setAgents(allAgents);
        } else {
          // If no traditional agents, just use rules as agents
          setAgents(rulesAsAgents);
        }
      } catch (error) {
        // If agents endpoint fails, just use rules as agents
        setAgents(rulesAsAgents);
      }

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast, draftFilter, gmailConnected]);

  const fetchDraftQueue = useCallback(async () => {
    if (!accessToken) {
      setLoadingQueue(false);
      return;
    }
    if (gmailConnected === false) {
      setLoadingQueue(false);
      return;
    }
    setLoadingQueue(true);
    try {
      // Fetch all drafts and filter for pending/generating on frontend
      // We'll fetch recent drafts and filter by status
      const [pendingResponse, generatingResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/gmail/drafts?status=pending&limit=20&sort=-createdAt`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch(`${BACKEND_URL}/api/gmail/drafts?status=generating&limit=20&sort=-createdAt`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      ]);
      
      const pendingData = await pendingResponse.json();
      const generatingData = await generatingResponse.json();
      
      // Combine both responses
      const allQueueItems: any[] = [];
      
      if (pendingData.success && pendingData.data) {
        allQueueItems.push(...pendingData.data);
      }
      if (generatingData.success && generatingData.data) {
        allQueueItems.push(...generatingData.data);
      }
      
      // Sort by createdAt (newest first) and remove duplicates by id
      const uniqueItems = Array.from(
        new Map(allQueueItems.map(item => [item.id, item])).values()
      ).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).slice(0, 20); // Limit to 20 most recent
      
      const queueItems = uniqueItems.map((item: any) => ({
        id: item.id,
        subject: item.subject || '(Sin asunto)',
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        status: item.status,
        priority: item.priority || 'medium',
        createdAt: item.createdAt,
        retryCount: item.retryCount || 0,
        maxRetries: item.maxRetries || 3,
        error: item.error,
        threadId: item.threadId,
        emailId: item.emailId
      }));
      
      setDraftQueue(queueItems);
    } catch (error: any) {
      console.error('Error fetching draft queue:', error);
    } finally {
      setLoadingQueue(false);
    }
  }, [accessToken, gmailConnected]);

  useEffect(() => {
    fetchIntegrationStatus();
    fetchDashboardData();
    fetchDraftQueue();
    
    // Refresh draft queue every 10 seconds
    const queueInterval = setInterval(() => {
      fetchDraftQueue();
    }, 10000);
    
    return () => clearInterval(queueInterval);
  }, [fetchDashboardData, fetchDraftQueue, draftFilter, accessToken, fetchIntegrationStatus]);

  const handleOpenInGmail = (draftId: string) => {
    window.open(`https://mail.google.com/mail/u/0/#drafts/${draftId}`, '_blank');
  };

  const handleToggleDraftSelection = (draftId: string) => {
    setSelectedDraftIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(draftId)) {
        newSet.delete(draftId);
      } else {
        newSet.add(draftId);
      }
      return newSet;
    });
  };

  const handleSelectAllDrafts = (checked: boolean) => {
    if (checked) {
      setSelectedDraftIds(new Set(drafts.map(d => d.id)));
    } else {
      setSelectedDraftIds(new Set());
    }
  };

  const handleBulkDeleteDrafts = async () => {
    if (!accessToken || selectedDraftIds.size === 0) return;
    
    const confirmMessage = `¿Estás seguro de que deseas eliminar ${selectedDraftIds.size} borrador(es)? Esta acción no se puede deshacer.`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingDrafts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          ids: Array.from(selectedDraftIds)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete drafts');

      toast({
        title: 'Éxito',
        description: `Se eliminaron ${data.data.deletedCount} borrador(es) correctamente`
      });

      setSelectedDraftIds(new Set());
      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron eliminar los borradores',
        variant: 'destructive'
      });
    } finally {
      setDeletingDrafts(false);
    }
  };

  const handleSendDraft = async (draftId: string) => {
    if (!accessToken || !selectedDraft) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${selectedDraft.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // If draft not found, offer to regenerate
        if (data.canRegenerate) {
          toast({
            title: 'Borrador no encontrado',
            description: 'El borrador fue eliminado en Gmail. Por favor, genera un nuevo borrador primero.',
            variant: 'destructive'
          });
          // Optionally, automatically regenerate
          try {
            const processResponse = await fetch(`${BACKEND_URL}/api/gmail/drafts/${selectedDraft.id}/process`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const processData = await processResponse.json();
            
            if (processResponse.ok) {
              toast({
                title: 'Regenerando borrador',
                description: 'El borrador se está regenerando. Intenta enviarlo nuevamente en unos momentos.'
              });
              // Refresh draft data after a short delay
              setTimeout(() => {
                handleViewDraft(selectedDraft);
              }, 2000);
            }
          } catch (regenerateError: any) {
            console.error('Error regenerating draft:', regenerateError);
          }
        } else {
          throw new Error(data.error || 'Failed to send draft');
        }
        return;
      }
      
      toast({
        title: 'Éxito',
        description: 'Email enviado correctamente'
      });
      
      // Close modal and refresh dashboard
      setSelectedDraft(null);
      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar el email',
        variant: 'destructive'
      });
    }
  };

  const fetchLogThreads = async (ruleId: string) => {
    if (!accessToken) return;
    
    setLoadingThreads(prev => ({ ...prev, [ruleId]: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${ruleId}/threads`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch threads');
      
      setLogThreads(prev => ({ ...prev, [ruleId]: data.data?.threads || [] }));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load threads',
        variant: 'destructive'
      });
    } finally {
      setLoadingThreads(prev => ({ ...prev, [ruleId]: false }));
    }
  };

  const handleToggleLogThreads = (ruleId: string) => {
    if (expandedLogId === ruleId) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(ruleId);
      // Fetch threads if not already loaded
      if (!logThreads[ruleId]) {
        fetchLogThreads(ruleId);
      }
    }
  };

  const handleViewAgent = async (agent: AgentStatus) => {
    setSelectedAgent(agent);
    setLoadingAgentEmails(true);
    setAgentEmails([]);
    
    try {
      // Fetch emails that this rule would bring (preview mode - no processing)
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${agent.id}/emails`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const emails = data.data?.emails || [];
        setAgentEmails(emails);
        setExpandedThreads(new Set()); // Reset expanded threads
      } else {
        throw new Error(data.error || 'Failed to fetch emails');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load emails',
        variant: 'destructive'
      });
    } finally {
      setLoadingAgentEmails(false);
    }
  };

  const handleExecuteRule = async (agent: AgentStatus) => {
    if (!accessToken) return;
    
    setExecutingRule(agent.id);
    try {
      // Execute the rule (this will fetch and process emails, create drafts if configured)
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${agent.id}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute rule');
      }
      
      // Show success message with statistics
      const result = data.data;
      toast({
        title: '✅ Regla ejecutada exitosamente',
        description: `Emails procesados: ${result.emailsFetched || 0} | Contactos: ${result.contacts || 0} | Conversaciones: ${result.conversations || 0} | Mensajes: ${result.messages || 0}`,
        duration: 5000
      });
      
      // Refresh dashboard to show new drafts
      await fetchDashboardData();
      // Refresh draft queue to show newly queued drafts
      await fetchDraftQueue();
      
      // Optionally, show the emails that were processed
      await handleViewAgent(agent);
      
    } catch (error: any) {
      toast({
        title: 'Error al ejecutar la regla',
        description: error.message || 'No se pudo ejecutar la regla',
        variant: 'destructive'
      });
    } finally {
      setExecutingRule(null);
    }
  };

  const handleGenerateDraft = async (email: any) => {
    if (!accessToken) return;
    try {
      // Extract email address from "Name <email@domain.com>" format
      const extractEmail = (emailStr: string) => {
        const match = emailStr.match(/<([^>]+)>/);
        return match ? match[1] : emailStr;
      };

      const fromEmail = extractEmail(email.from);
      const displayName = email.from.replace(/<[^>]+>/g, '').trim() || fromEmail;

      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          emailId: email.id,
          threadId: email.threadId,
          subject: email.subject || '(Sin asunto)',
          fromEmail: fromEmail,
          fromName: displayName !== fromEmail ? displayName : undefined,
          originalBody: email.snippet || email.subject || '',
          priority: 'medium'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to queue draft');
      
      toast({
        title: 'Éxito',
        description: 'Borrador encolado. Se generará automáticamente en breve.'
      });
      
      // Refresh dashboard data
      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo encolar el borrador',
        variant: 'destructive'
      });
    }
  };

  const handleViewDraft = async (draft: DraftItem) => {
    setSelectedDraft(draft);
    setLoadingDraftThread(true);
    
    try {
      // Fetch the draft details
      const draftResponse = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draft.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const draftData = await draftResponse.json();
      
      if (draftData.success && draftData.data) {
        const draftItem = draftData.data;
        
        // Store draft content
        setDraftThread({
          draft: draftItem,
          conversation: null,
          messages: []
        });
        
        // If we have a conversationId, fetch the thread
        if (draftItem.conversationId) {
          try {
            const conversationResponse = await fetch(
              `${BACKEND_URL}/api/instagram/conversations/${draftItem.conversationId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const conversationResult = await conversationResponse.json();
            
            if (conversationResult.success) {
              const convData = conversationResult.data;
              setDraftThread({
                draft: draftItem,
                conversation: convData.conversation,
                messages: convData.messages || []
              });
            }
          } catch (convError) {
            console.error('Error fetching conversation:', convError);
            // Continue without conversation data
          }
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load draft details',
        variant: 'destructive'
      });
    } finally {
      setLoadingDraftThread(false);
    }
  };

  const handleEditDraft = (draft: DraftItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDraft(draft);
    setEditDraftContent(draft.draftContent || '');
  };

  const handleSaveDraft = async () => {
    if (!accessToken || !editingDraft) return;
    setSavingDraft(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${editingDraft.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          draftContent: editDraftContent
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update draft');

      toast({
        title: 'Éxito',
        description: 'Borrador actualizado correctamente'
      });

      setEditingDraft(null);
      setEditDraftContent('');
      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el borrador',
        variant: 'destructive'
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleUpdateApprovalState = async (draftId: string, newState: 'new' | 'approved' | 'sent', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!accessToken) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          approvalState: newState
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update approval state');

      toast({
        title: 'Éxito',
        description: `Estado actualizado a ${newState === 'new' ? 'Nuevo' : newState === 'approved' ? 'Aprobado' : 'Enviado'}`
      });

      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado',
        variant: 'destructive'
      });
    }
  };

  const getApprovalStateBadge = (state?: 'new' | 'approved' | 'sent') => {
    const approvalState = state || 'new';
    switch (approvalState) {
      case 'new':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Nuevo</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobado</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Enviado</Badge>;
      default:
        return <Badge variant="outline">Nuevo</Badge>;
    }
  };

  // Group emails by threadId
  const groupEmailsByThread = (emails: any[]) => {
    const threadsMap = new Map<string, any[]>();
    
    emails.forEach(email => {
      const threadId = email.threadId || `single_${email.id}`;
      if (!threadsMap.has(threadId)) {
        threadsMap.set(threadId, []);
      }
      threadsMap.get(threadId)!.push(email);
    });
    
    // Convert to array and sort each thread's emails by date (newest first)
    const threads = Array.from(threadsMap.entries()).map(([threadId, threadEmails]) => {
      threadEmails.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // Newest first
      });
      
      return {
        threadId,
        emails: threadEmails,
        count: threadEmails.length,
        latestEmail: threadEmails[0], // First email is the newest
        oldestEmail: threadEmails[threadEmails.length - 1] // Last email is the oldest
      };
    });
    
    // Sort threads by latest email date (newest first)
    threads.sort((a, b) => {
      const dateA = a.latestEmail.date ? new Date(a.latestEmail.date).getTime() : 0;
      const dateB = b.latestEmail.date ? new Date(b.latestEmail.date).getTime() : 0;
      return dateB - dateA;
    });
    
    return threads;
  };

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES');
  };

  const isStuck = (item: any) => {
    if (item.status !== 'generating') return false;
    const updatedAt = new Date(item.updatedAt || item.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - updatedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins > 30; // Stuck if in generating status for more than 30 minutes
  };

  const handleResetStuckDraft = async (draftId: string) => {
    if (!accessToken) return;
    setResettingDraft(draftId);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draftId}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset draft');
      }
      
      toast({
        title: 'Éxito',
        description: 'Borrador reseteado. Se reintentará en el próximo ciclo del worker.'
      });
      
      // Refresh queue
      await fetchDraftQueue();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo resetear el borrador',
        variant: 'destructive'
      });
    } finally {
      setResettingDraft(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gmail Dashboard | Moca</title>
      </Helmet>

      <div className="space-y-6 p-6">
        {gmailConnected === false && (
          <Card className="border-2 border-dashed border-violet-200 bg-violet-50">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="flex items-center gap-2 text-violet-900">
                <Plug className="w-5 h-5" />
                Conecta tu cuenta de Gmail
              </CardTitle>
              <CardDescription>
                Para crear reglas y procesar correos, primero conecta tu cuenta de Gmail con OAuth.
              </CardDescription>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleConnectGmail} disabled={connecting}>
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirigiendo a Google...
                    </>
                  ) : (
                    'Conectar Gmail'
                  )}
                </Button>
                <Button variant="outline" onClick={() => navigate('/app/gmail/rules')}>
                  Ver reglas
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="w-8 h-8 text-violet-600" />
              Gmail Dashboard
              {gmailConnected === true && (
                <div className="flex items-center gap-2 ml-2">
                  <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="text-sm font-normal text-green-600">Conectado</span>
                </div>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              Panel centralizado de actividad de Gmail
            </p>
          </div>
          <Button onClick={() => navigate('/app/gmail/rules/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Agente Gmail
          </Button>
        </div>

        {/* Activity Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Emails Analizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-violet-600" />
                <div>
                  <p className="text-3xl font-bold text-gray-900">{metrics.emailsAnalyzed24h}</p>
                  <p className="text-sm text-gray-500">Últimas 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Borradores Generados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-3xl font-bold text-gray-900">{metrics.draftsGenerated}</p>
                  <p className="text-sm text-gray-500">Últimas 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Importantes Detectados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-3xl font-bold text-gray-900">{metrics.importantesDetectados}</p>
                  <p className="text-sm text-gray-500">Últimas 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Agent Status */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de los Agentes</CardTitle>
              <CardDescription>Agentes de Gmail y su estado</CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay agentes configurados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => handleViewAgent(agent)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{agent.name}</p>
                          <Badge
                            variant={agent.status === 'active' ? 'default' : 'secondary'}
                          >
                            {agent.status === 'active' ? 'Activo' : 'Pausado'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>{agent.enabledRules} reglas activas</p>
                          {agent.lastExecution && (
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Última ejecución: {formatDate(agent.lastExecution)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAgent(agent)}
                          title="Ver emails que traería esta regla"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Vista Previa
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleExecuteRule(agent)}
                          disabled={executingRule === agent.id || agent.status !== 'active'}
                          title="Ejecutar regla manualmente y crear borradores"
                        >
                          {executingRule === agent.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Ejecutando...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Ejecutar Regla
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/app/gmail/rules/${agent.id}`)}
                          title="Editar agente"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Draft Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5" />
                Cola de Borradores
                {!loadingQueue && (
                  <Badge variant="secondary" className="ml-2">
                    ({draftQueue.length})
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Borradores pendientes de generación o en proceso
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingQueue ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                </div>
              ) : draftQueue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay borradores en la cola</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asunto</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Encolado</TableHead>
                      <TableHead>Reintentos</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.subject}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.fromName ? (
                              <>
                                <p className="font-medium">{item.fromName}</p>
                                <p className="text-gray-500 text-xs">{item.fromEmail}</p>
                              </>
                            ) : (
                              <p>{item.fromEmail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Pendiente
                            </Badge>
                          ) : item.status === 'generating' ? (
                            <Badge 
                              variant="outline" 
                              className={isStuck(item) 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : "bg-blue-50 text-blue-700 border-blue-200"}
                            >
                              {isStuck(item) && <AlertCircle className="w-3 h-3 mr-1 inline" />}
                              {!isStuck(item) && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                              {isStuck(item) ? 'Atascado' : 'Generando'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{item.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              item.priority === 'urgent' 
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : item.priority === 'high'
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : item.priority === 'low'
                                ? 'bg-gray-50 text-gray-700 border-gray-200'
                                : ''
                            }
                          >
                            {item.priority === 'urgent' ? 'Urgente' :
                             item.priority === 'high' ? 'Alta' :
                             item.priority === 'low' ? 'Baja' : 'Media'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          {item.retryCount > 0 ? (
                            <div className="text-sm">
                              <p className="text-orange-600">{item.retryCount}/{item.maxRetries}</p>
                              {item.error && (
                                <p className="text-xs text-red-500 line-clamp-1" title={item.error}>
                                  {item.error}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(item.status === 'generating' || item.status === 'failed' || item.status === 'completed') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetStuckDraft(item.id)}
                              disabled={resettingDraft === item.id}
                              title={isStuck(item) ? 'Este borrador está atascado. Click para resetear y reintentar.' : item.status === 'completed' ? 'Regenerar este borrador' : 'Resetear borrador para reintentar'}
                            >
                              {resettingDraft === item.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Reseteando...
                                </>
                              ) : (
                                <>
                                  <RotateCw className="w-4 h-4 mr-2" />
                                  {isStuck(item) ? 'Resetear (Atascado)' : item.status === 'completed' ? 'Regenerar' : 'Resetear'}
                                </>
                              )}
                            </Button>
                          )}
                          {item.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetStuckDraft(item.id)}
                              disabled={resettingDraft === item.id}
                              title="Forzar regeneración inmediata"
                            >
                              {resettingDraft === item.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Reseteando...
                                </>
                              ) : (
                                <>
                                  <RotateCw className="w-4 h-4 mr-2" />
                                  Regenerar
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {draftQueue.length > 0 && (
                <div className="mt-4 text-xs text-gray-500 text-center">
                  La cola se actualiza automáticamente cada 10 segundos
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drafts Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Borradores Creados por el Agente</CardTitle>
                  <CardDescription>Últimos borradores generados</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDraftIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDeleteDrafts}
                      disabled={deletingDrafts}
                    >
                      {deletingDrafts ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar ({selectedDraftIds.size})
                        </>
                      )}
                    </Button>
                  )}
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Select
                    value={draftFilter}
                    onValueChange={(value: 'all' | 'new' | 'approved' | 'sent') => setDraftFilter(value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="new">Nuevo</SelectItem>
                      <SelectItem value="approved">Aprobado</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {drafts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay borradores creados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDraftIds.size === drafts.length && drafts.length > 0}
                          onCheckedChange={handleSelectAllDrafts}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableHead>
                      <TableHead>Asunto</TableHead>
                      <TableHead>Regla</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((draft) => (
                      <TableRow 
                        key={draft.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleViewDraft(draft)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedDraftIds.has(draft.id)}
                            onCheckedChange={() => handleToggleDraftSelection(draft.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {draft.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{draft.ruleName || 'Manual'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getApprovalStateBadge(draft.approvalState)}
                            {draft.status === 'failed' && draft.error && (
                              <div className="text-xs text-red-600 mt-1 line-clamp-1" title={draft.error}>
                                <AlertCircle className="w-3 h-3 inline mr-1" />
                                Error: {draft.error.substring(0, 50)}{draft.error.length > 50 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {draft.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!accessToken) return;
                                  try {
                                    const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draft.id}/reset`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${accessToken}` }
                                    });
                                    const data = await response.json();
                                    if (!response.ok) throw new Error(data.error || 'Failed to reset draft');
                                    toast({
                                      title: 'Éxito',
                                      description: 'El borrador se reintentará automáticamente'
                                    });
                                    fetchDashboardData();
                                  } catch (error: any) {
                                    toast({
                                      title: 'Error',
                                      description: error.message || 'No se pudo resetear el borrador',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                title="Reintentar borrador"
                              >
                                <RotateCw className="w-4 h-4" />
                              </Button>
                            )}
                            {draft.draftContent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleEditDraft(draft, e)}
                                title="Editar borrador"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {draft.approvalState !== 'approved' && draft.approvalState !== 'sent' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleUpdateApprovalState(draft.id, 'approved', e)}
                                title="Aprobar borrador"
                              >
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 cursor-pointer">
                                  Aprobar
                                </Badge>
                              </Button>
                            )}
                            {draft.draftId && draft.approvalState === 'approved' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendDraft(draft.id);
                                }}
                                title="Enviar email"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {draft.draftId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenInGmail(draft.draftId!);
                                }}
                                title="Abrir en Gmail"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                            {!draft.draftId && draft.status !== 'failed' && (
                              <Badge variant="secondary">{draft.status}</Badge>
                            )}
                            {draft.status === 'failed' && !draft.draftId && (
                              <Badge variant="destructive">Fallido</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Logs de Ejecución</CardTitle>
            <CardDescription>Registro de ejecuciones de reglas</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No hay logs de ejecución</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {logs.map((log) => (
                  <AccordionItem key={log.id} value={log.id}>
                    <AccordionTrigger
                      onClick={() => handleToggleLogThreads(log.id)}
                      className="hover:no-underline"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {log.status === 'success' ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-medium">
                            Regla "{log.ruleName}" procesó {log.emailsProcessed} correos
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(log.executedAt)}
                          </p>
                        </div>
                        {log.error && (
                          <Badge variant="destructive" className="text-xs mr-2">
                            Error
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {loadingThreads[log.id] ? (
                        <div className="p-4 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600 mb-2" />
                          <p className="text-sm text-gray-600">Cargando threads...</p>
                        </div>
                      ) : logThreads[log.id] && logThreads[log.id].length > 0 ? (
                        <div className="space-y-2 p-2 border rounded-lg bg-gray-50">
                          {logThreads[log.id].map((thread: any, idx: number) => (
                            <div
                              key={thread.threadId || idx}
                              className="p-3 bg-white border rounded-lg hover:bg-gray-50"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{thread.subject}</p>
                                  {thread.contact && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      <User className="w-3 h-3 inline mr-1" />
                                      {thread.contact.name} ({thread.contact.email})
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {thread.messageCount} mensajes
                                </Badge>
                              </div>
                              {thread.messages && thread.messages.length > 0 && (
                                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                  {thread.messages.slice(0, 3).map((msg: any, msgIdx: number) => (
                                    <div key={msgIdx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                      <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="w-3 h-3" />
                                        <span className="font-medium">
                                          {msg.role === 'user' ? 'Usuario' : 'Agente'}
                                        </span>
                                      </div>
                                      <p className="line-clamp-2">
                                        {typeof msg.content === 'object' && msg.content?.text 
                                          ? msg.content.text 
                                          : typeof msg.content === 'string' 
                                          ? msg.content 
                                          : msg.text || '(Sin contenido)'}
                                      </p>
                                    </div>
                                  ))}
                                  {thread.messages.length > 3 && (
                                    <p className="text-xs text-gray-500 text-center pt-1">
                                      +{thread.messages.length - 3} mensajes más
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No hay threads disponibles para esta ejecución
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Draft Thread Modal */}
      <Dialog open={!!selectedDraft} onOpenChange={(open) => !open && setSelectedDraft(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDraft?.subject || 'Thread y Borrador'}</DialogTitle>
            <DialogDescription>
              Ver el thread completo y el borrador generado
            </DialogDescription>
          </DialogHeader>
          
          {loadingDraftThread ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Thread Messages */}
              {draftThread && draftThread.messages && draftThread.messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Thread de Emails</h3>
                  <div className="space-y-3 border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                    {draftThread.messages.map((msg: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user' || msg.sender === 'user'
                            ? 'bg-white border-l-4 border-blue-500'
                            : 'bg-violet-50 border-l-4 border-violet-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4" />
                          <span className="font-medium text-sm">
                            {msg.role === 'user' || msg.sender === 'user' ? 'Usuario' : 'Agente'}
                          </span>
                          {(msg.timestamp || msg.createdAt) && (
                            <span className="text-xs text-gray-500">
                              {new Date(msg.timestamp || msg.createdAt).toLocaleString('es-ES')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {typeof msg.content === 'object' && msg.content?.text 
                            ? msg.content.text 
                            : typeof msg.content === 'string' 
                            ? msg.content 
                            : msg.text || '(Sin contenido)'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Content */}
              {draftThread && draftThread.draft && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Borrador Generado</h3>
                  <div className={`border rounded-lg p-4 ${
                    draftThread.draft.status === 'failed' 
                      ? 'bg-red-50 border-red-200' 
                      : draftThread.draft.status === 'completed' 
                      ? 'bg-green-50 border-green-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <Badge 
                        variant="outline" 
                        className={
                          draftThread.draft.status === 'failed'
                            ? "bg-red-100 text-red-700 border-red-300"
                            : draftThread.draft.draftId 
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-yellow-100 text-yellow-700 border-yellow-300"
                        }
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        {draftThread.draft.status === 'completed' 
                          ? 'Borrador creado en Gmail' 
                          : draftThread.draft.status === 'failed'
                          ? 'Fallido'
                          : draftThread.draft.status === 'generating'
                          ? 'Generando...'
                          : draftThread.draft.status === 'pending'
                          ? 'Pendiente'
                          : draftThread.draft.status}
                      </Badge>
                      {draftThread.draft.draftId && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSendDraft(draftThread.draft.draftId)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Enviar Email
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenInGmail(draftThread.draft.draftId)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir en Gmail
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Error Display */}
                    {draftThread.draft.status === 'failed' && draftThread.draft.error && (
                      <div className="mt-3 p-4 bg-red-100 border border-red-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-800 mb-1">Error al generar el borrador:</p>
                            <p className="text-sm text-red-700 whitespace-pre-wrap">
                              {draftThread.draft.error}
                            </p>
                            {draftThread.draft.retryCount !== undefined && draftThread.draft.retryCount > 0 && (
                              <p className="text-xs text-red-600 mt-2">
                                Intentos: {draftThread.draft.retryCount} / {draftThread.draft.maxRetries || 3}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Draft Content */}
                    {draftThread.draft.draftContent && (
                      <div className="mt-3 p-3 bg-white rounded border border-green-200">
                        <p className="text-xs text-gray-500 mb-2 font-medium">Contenido del borrador:</p>
                        <p className="text-sm whitespace-pre-wrap text-gray-900">
                          {draftThread.draft.draftContent}
                        </p>
                      </div>
                    )}
                    {!draftThread.draft.draftContent && draftThread.draft.draftId && (
                      <p className="text-sm text-gray-600">
                        El borrador se ha creado en Gmail y está disponible en tu carpeta de borradores.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Agent Emails Modal */}
      <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Vista Previa - Emails del Agente: {selectedAgent?.name}</DialogTitle>
                <DialogDescription>
                  Emails que este agente traería según su configuración (sin procesar). Usa "Ejecutar Regla" para procesarlos y crear borradores.
                </DialogDescription>
              </div>
              {selectedAgent && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(null);
                      handleExecuteRule(selectedAgent);
                    }}
                    disabled={executingRule === selectedAgent.id || selectedAgent.status !== 'active'}
                  >
                    {executingRule === selectedAgent.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ejecutando...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Ejecutar Regla
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(null);
                      navigate(`/app/gmail/rules/${selectedAgent.id}`);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Agente
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {loadingAgentEmails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
          ) : agentEmails.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No hay emails que coincidan con los criterios de este agente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const threads = groupEmailsByThread(agentEmails);
                const totalEmails = agentEmails.length;
                
                return (
                  <>
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          📧 {threads.length} thread{threads.length !== 1 ? 's' : ''} encontrado{threads.length !== 1 ? 's' : ''} ({totalEmails} email{totalEmails !== 1 ? 's' : ''} en total)
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Al ejecutar la regla, estos emails serán procesados y se crearán borradores según la configuración del agente.
                        </p>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Thread</TableHead>
                            <TableHead>Última actividad</TableHead>
                            <TableHead>Mensajes</TableHead>
                            <TableHead>Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {threads.map((thread) => {
                            const isExpanded = expandedThreads.has(thread.threadId);
                            const latestEmail = thread.latestEmail;
                            
                            // Extract sender info
                            const extractEmail = (emailStr: string) => {
                              const match = emailStr.match(/<([^>]+)>/);
                              return match ? match[1] : emailStr;
                            };
                            const fromEmail = extractEmail(latestEmail.from);
                            const displayName = latestEmail.from.replace(/<[^>]+>/g, '').trim() || fromEmail;
                            
                            return (
                              <>
                                <TableRow 
                                  key={thread.threadId}
                                  className="cursor-pointer hover:bg-gray-50"
                                  onClick={() => toggleThread(thread.threadId)}
                                >
                                  <TableCell>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-400" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium text-sm">{displayName}</span>
                                      </div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {latestEmail.subject || '(Sin asunto)'}
                                      </p>
                                      {latestEmail.snippet && (
                                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                                          {latestEmail.snippet}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-500">
                                    {latestEmail.date ? formatDate(latestEmail.date) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {thread.count} mensaje{thread.count !== 1 ? 's' : ''}
                                    </Badge>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleGenerateDraft(latestEmail)}
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      Generar Borrador
                                    </Button>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="bg-gray-50 p-0">
                                      <div className="p-4 space-y-3">
                                        <p className="text-sm font-semibold text-gray-700 mb-3">
                                          Mensajes del thread ({thread.count}):
                                        </p>
                                        <div className="space-y-2">
                                          {thread.emails.map((email) => {
                                            const emailFromEmail = extractEmail(email.from);
                                            const emailDisplayName = email.from.replace(/<[^>]+>/g, '').trim() || emailFromEmail;
                                            
                                            return (
                                              <div
                                                key={email.id}
                                                className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50"
                                              >
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium">{emailDisplayName}</span>
                                                    <span className="text-xs text-gray-500">
                                                      {email.date ? formatDate(email.date) : '-'}
                                                    </span>
                                                  </div>
                                                  {email.snippet && (
                                                    <p className="text-xs text-gray-600 line-clamp-2">
                                                      {email.snippet}
                                                    </p>
                                                  )}
                                                </div>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleGenerateDraft(email)}
                                                >
                                                  <FileText className="w-4 h-4 mr-2" />
                                                  Generar Borrador
                                                </Button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Draft Modal */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => !open && setEditingDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Borrador</DialogTitle>
            <DialogDescription>
              {editingDraft?.subject || 'Editar contenido del borrador'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Contenido del Borrador
              </label>
              <Textarea
                value={editDraftContent}
                onChange={(e) => setEditDraftContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Escribe o edita el contenido del borrador aquí..."
              />
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingDraft(null);
                  setEditDraftContent('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GmailDashboard;

