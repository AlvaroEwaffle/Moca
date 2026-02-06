import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Instagram, 
  Settings, 
  Save,
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Bot,
  Target,
  Calendar,
  Link as LinkIcon,
  Presentation,
  ChevronDown,
  ChevronRight,
  Shield,
  BarChart3,
  Clock,
  AlertTriangle,
  ExternalLink,
  Copy,
  Plug,
  Plus,
  Trash2,
  TestTube,
  Heart,
  Activity,
  Download,
  CheckCircle2,
  Power,
  Key,
  Sparkles
} from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import ChatbotTest from "@/components/ChatbotTest";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  settings?: {
    aiEnabled?: 'off' | 'test' | 'on' | boolean; // Support both new string format and old boolean for migration
    defaultAgentEnabled?: boolean; // Whether new conversations should have agent enabled by default
    systemPrompt?: string;
    defaultMilestone?: {
      target: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
      customTarget?: string;
      autoDisableAgent: boolean;
    };
  };
  commentSettings?: {
    enabled: boolean;
    autoReplyComment: boolean;
    autoReplyDM: boolean;
    commentMessage: string;
    dmMessage: string;
    replyDelay: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface MCPServer {
  name: string;
  url: string;
  connectionType: 'http' | 'websocket' | 'stdio';
  authentication: {
    type: 'none' | 'api_key' | 'bearer' | 'oauth2';
    apiKey?: string;
    bearerToken?: string;
    oauth2Config?: {
      clientId?: string;
      clientSecret?: string;
      tokenUrl?: string;
    };
  };
  tools: Array<{
    name: string;
    description: string;
    enabled: boolean;
    parameters?: any;
  }>;
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
}

interface MCPToolsConfig {
  enabled: boolean;
  servers: MCPServer[];
}

interface GlobalAgentConfig {
  id: string;
  responseLimits: {
    maxResponsesPerConversation: number;
    resetCounterOnMilestone: boolean;
  };
  leadScoring: {
    scale: {
      step1: { name: string; description: string; score: number };
      step2: { name: string; description: string; score: number };
      step3: { name: string; description: string; score: number };
      step4: { name: string; description: string; score: number };
      step5: { name: string; description: string; score: number };
      step6: { name: string; description: string; score: number };
      step7: { name: string; description: string; score: number };
    };
    autoDisableOnScore?: number;
    autoDisableOnMilestone: boolean;
  };
  systemSettings: {
    enableResponseLimits: boolean;
    enableLeadScoreAutoDisable: boolean;
    enableMilestoneAutoDisable: boolean;
    logAllDecisions: boolean;
  };
  mcpTools?: MCPToolsConfig;
}

interface FollowUpConfig {
  id?: string;
  userId: string;
  accountId: string;
  enabled: boolean;
  minLeadScore: number;
  maxFollowUps: number;
  timeSinceLastAnswer: number;
  messageMode: 'template' | 'ai';
  messageTemplate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const InstagramAccounts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [testing, setTesting] = useState(false);
  const [followUpConfig, setFollowUpConfig] = useState<FollowUpConfig | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  
  // Milestone configuration state
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [milestoneTarget, setMilestoneTarget] = useState<'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom'>('link_shared');
  const [customMilestoneTarget, setCustomMilestoneTarget] = useState<string>("");
  const [autoDisableAgent, setAutoDisableAgent] = useState<boolean>(true);
  
  // Global agent configuration state
  const [globalConfig, setGlobalConfig] = useState<GlobalAgentConfig | null>(null);
  const [editingGlobalConfig, setEditingGlobalConfig] = useState<boolean>(false);
  const [globalConfigForm, setGlobalConfigForm] = useState({
    maxResponsesPerConversation: 3,
    resetCounterOnMilestone: false,
    autoDisableOnScore: undefined as number | undefined,
    autoDisableOnMilestone: true,
    enableResponseLimits: true,
    enableLeadScoreAutoDisable: true,
    enableMilestoneAutoDisable: true,
    logAllDecisions: true
  });
  
  // Accordion state
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  
  // Keyword Activation state
  const [keywordRules, setKeywordRules] = useState<Array<{id: string; keyword: string; enabled: boolean; createdAt: string; updatedAt: string}>>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<{id?: string; keyword: string; enabled: boolean} | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [savingKeyword, setSavingKeyword] = useState(false);
  
  // MCP Tools state
  const [mcpConfig, setMcpConfig] = useState<MCPToolsConfig>({
    enabled: false,
    servers: []
  });
  const [editingMcp, setEditingMcp] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<MCPServer | null>(null);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [testingMcpConnection, setTestingMcpConnection] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchingTools, setFetchingTools] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<Array<{name: string; description: string; parameters?: any}>>([]);

  useEffect(() => {
    fetchAccounts();
    fetchGlobalConfig();
    fetchMcpConfig();
  }, []);

  // Fetch keywords when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0) {
      fetchKeywordRules(accounts[0].accountId);
    }
  }, [accounts]);

  // Test connection after accounts are loaded
  useEffect(() => {
    if (accounts.length > 0 && !loading) {
      testConnection();
    } else if (accounts.length === 0 && !loading) {
      setConnectionStatus('disconnected');
    }
  }, [accounts.length, loading]);

  useEffect(() => {
    if (mcpConfig.enabled) {
      fetchAvailableTools();
    }
  }, [mcpConfig.enabled]);

  // Fetch follow-up configuration when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      fetchFollowUpConfig(accounts[0].accountId);
    }
  }, [accounts]);

  const fetchAccounts = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedAccounts = data.data?.accounts || [];
        setAccounts(fetchedAccounts);
        
        // If we have accounts, set connection status to connected by default
        // The useEffect will call testConnection to verify the actual connection status
        if (fetchedAccounts.length > 0) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('disconnected');
        }
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to load Instagram accounts');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAgentMode = async (accountId: string, mode: 'off' | 'test' | 'on') => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}/ai-enabled`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ aiEnabled: mode })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setAccounts(prev => 
          prev.map(account => 
            account.accountId === accountId 
              ? { 
                  ...account, 
                  settings: { 
                    ...account.settings, 
                    aiEnabled: mode 
                  } 
                }
              : account
          )
        );

        const modeLabels: Record<string, string> = {
          'off': 'Desactivado',
          'test': 'Modo Test',
          'on': 'Activado'
        };

        toast({
          title: `Agente ${modeLabels[mode]}`,
          description: `El agente de Instagram ha sido configurado en modo "${modeLabels[mode]}"`,
        });
      } else {
        throw new Error(data.error || 'Failed to update agent mode');
      }
    } catch (error: any) {
      console.error('Error updating agent mode:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el modo del agente",
        variant: "destructive"
      });
      
      // Refresh accounts to revert UI state
      fetchAccounts();
    }
  };

  const handleDefaultAgentEnabledToggle = async (accountId: string, enabled: boolean) => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}/default-agent-enabled`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ defaultAgentEnabled: enabled })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setAccounts(prev => 
          prev.map(account => 
            account.accountId === accountId 
              ? { 
                  ...account, 
                  settings: { 
                    ...account.settings, 
                    defaultAgentEnabled: enabled 
                  } 
                }
              : account
          )
        );

        toast({
          title: "Default Agent State Updated",
          description: `New conversations will now ${enabled ? 'have' : 'not have'} the agent enabled by default.`,
        });
      } else {
        throw new Error(data.error || 'Failed to update default agent enabled setting');
      }
    } catch (error: any) {
      console.error('Error updating default agent enabled:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to update default agent enabled setting',
        variant: "destructive",
      });
      
      // Refresh accounts to revert UI state
      fetchAccounts();
    }
  };

  // Helper to get current agent mode (migrate from boolean if needed)
  const getCurrentAgentMode = (account: InstagramAccount): 'off' | 'test' | 'on' => {
    if (!account.settings?.aiEnabled) return 'on'; // Default
    
    // Handle migration from boolean to string
    if (typeof account.settings.aiEnabled === 'boolean') {
      return account.settings.aiEnabled ? 'on' : 'off';
    }
    
    return account.settings.aiEnabled as 'off' | 'test' | 'on';
  };

  const fetchGlobalConfig = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGlobalConfig(data.data);
        // Update form with current config
        if (data.data) {
          setGlobalConfigForm({
            maxResponsesPerConversation: data.data.responseLimits.maxResponsesPerConversation,
            resetCounterOnMilestone: data.data.responseLimits.resetCounterOnMilestone,
            autoDisableOnScore: data.data.leadScoring.autoDisableOnScore,
            autoDisableOnMilestone: data.data.leadScoring.autoDisableOnMilestone,
            enableResponseLimits: data.data.systemSettings.enableResponseLimits,
            enableLeadScoreAutoDisable: data.data.systemSettings.enableLeadScoreAutoDisable,
            enableMilestoneAutoDisable: data.data.systemSettings.enableMilestoneAutoDisable,
            logAllDecisions: data.data.systemSettings.logAllDecisions
          });
          
          // Update MCP config if available
          if (data.data.mcpTools) {
            setMcpConfig(data.data.mcpTools);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching global config:', error);
    }
  };

  const fetchMcpConfig = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔧 [MCP] Fetched MCP config:', data);
        if (data.data) {
          setMcpConfig({
            enabled: data.data.enabled || false,
            servers: data.data.servers || []
          });
          console.log('✅ [MCP] MCP config state updated:', {
            enabled: data.data.enabled,
            serversCount: data.data.servers?.length || 0
          });
        }
      } else {
        console.error('❌ [MCP] Failed to fetch MCP config:', response.status);
      }
    } catch (error) {
      console.error('❌ [MCP] Error fetching MCP config:', error);
    }
  };

  const fetchAvailableTools = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools/available`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching available tools:', error);
    }
  };

  const saveMcpConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(mcpConfig)
      });

      if (response.ok) {
        setSuccess('MCP tools configuration saved successfully');
        setEditingMcp(false);
        await fetchMcpConfig();
        await fetchAvailableTools();
        toast({
          title: "Success",
          description: "MCP tools configuration saved successfully",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save MCP configuration');
        toast({
          title: "Error",
          description: errorData.error || 'Failed to save MCP configuration',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setError('Failed to save MCP configuration');
      toast({
        title: "Error",
        description: 'Failed to save MCP configuration',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addMcpServer = () => {
    const newServer: MCPServer = {
      name: '',
      url: '',
      connectionType: 'http',
      authentication: { type: 'none' },
      tools: [],
      enabled: true,
      timeout: 30000,
      retryAttempts: 3
    };
    setEditingMcpServer(newServer);
  };

  const saveMcpServer = async (server: MCPServer) => {
    try {
      const backendUrl = BACKEND_URL;
      console.log('🔧 [MCP] Saving server:', server);
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(server)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ [MCP] Server saved successfully:', responseData);
        setEditingMcpServer(null);
        setDiscoveredTools([]); // Clear discovered tools after saving
        await fetchMcpConfig(); // Refresh the config to show the new server
        toast({
          title: "Success",
          description: "MCP server saved successfully",
        });
      } else {
        const errorData = await response.json();
        console.error('❌ [MCP] Failed to save server:', errorData);
        toast({
          title: "Error",
          description: errorData.error || 'Failed to save MCP server',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ [MCP] Error saving server:', error);
      toast({
        title: "Error",
        description: 'Failed to save MCP server',
        variant: "destructive",
      });
    }
  };

  const deleteMcpServer = async (serverName: string) => {
    if (!confirm(`Are you sure you want to delete the MCP server "${serverName}"?`)) {
      return;
    }

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools/servers/${serverName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        await fetchMcpConfig();
        toast({
          title: "Success",
          description: "MCP server deleted successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || 'Failed to delete MCP server',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: 'Failed to delete MCP server',
        variant: "destructive",
      });
    }
  };

  const testMcpConnection = async (serverName: string) => {
    setTestingMcpConnection(serverName);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/global-agent-config/mcp-tools/servers/${serverName}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: `Connection to ${serverName} successful`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || `Failed to connect to ${serverName}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: 'Failed to test connection',
        variant: "destructive",
      });
    } finally {
      setTestingMcpConnection(null);
    }
  };

  const healthCheckMcpServer = async (server: MCPServer) => {
    if (!server.url) {
      setHealthCheckResult({ success: false, message: 'Please enter a server URL first' });
      return;
    }

    setHealthChecking(true);
    setHealthCheckResult(null);

    try {
      // Build the health check URL
      // If the URL already ends with /health, use it as-is
      // Otherwise, try to append /health or use the base URL
      let healthCheckUrl = server.url.trim();
      
      // If URL doesn't end with /health, try to add it
      if (!healthCheckUrl.endsWith('/health') && !healthCheckUrl.endsWith('/health/')) {
        // Remove trailing slash if present
        healthCheckUrl = healthCheckUrl.replace(/\/$/, '');
        healthCheckUrl = healthCheckUrl + '/health';
      }

      // Build headers for authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authentication headers based on server config
      if (server.authentication.type === 'api_key' && server.authentication.apiKey) {
        headers['X-API-Key'] = server.authentication.apiKey;
      } else if (server.authentication.type === 'bearer' && server.authentication.bearerToken) {
        headers['Authorization'] = `Bearer ${server.authentication.bearerToken}`;
      }

      // Directly test the MCP server health endpoint with timeout
      const timeout = server.timeout || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({})); // Try to parse JSON, but don't fail if it's not JSON
        setHealthCheckResult({ 
          success: true, 
          message: `Health check passed! Server responded with status ${response.status}.` 
        });
        toast({
          title: "Health Check Passed",
          description: `Server at ${server.url} is healthy and reachable`,
        });
      } else {
        setHealthCheckResult({ 
          success: false, 
          message: `Health check failed: Server returned status ${response.status}` 
        });
        toast({
          title: "Health Check Failed",
          description: `Server returned status ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error';
      
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        errorMessage = 'Request timed out - server did not respond in time';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Check for CORS errors
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        errorMessage = 'CORS error: Server may not allow requests from this origin. Check server CORS settings.';
      }

      setHealthCheckResult({ 
        success: false, 
        message: `Health check error: ${errorMessage}` 
      });
      toast({
        title: "Health Check Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setHealthChecking(false);
    }
  };

  const fetchToolsFromServer = async (server: MCPServer) => {
    if (!server.url) {
      toast({
        title: "Error",
        description: 'Please enter a server URL first',
        variant: "destructive",
      });
      return;
    }

    setFetchingTools(true);
    setDiscoveredTools([]);

    try {
      // Build the tools URL
      let toolsUrl = server.url.trim();
      toolsUrl = toolsUrl.replace(/\/$/, ''); // Remove trailing slash
      if (!toolsUrl.endsWith('/tools')) {
        toolsUrl = toolsUrl + '/tools';
      }

      // Build headers for authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authentication headers based on server config
      if (server.authentication.type === 'api_key' && server.authentication.apiKey) {
        headers['X-API-Key'] = server.authentication.apiKey;
      } else if (server.authentication.type === 'bearer' && server.authentication.bearerToken) {
        headers['Authorization'] = `Bearer ${server.authentication.bearerToken}`;
      }

      // Fetch tools from MCP server
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), server.timeout || 10000);

      const response = await fetch(toolsUrl, {
        method: 'GET',
        headers: headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats
        let toolsList: any[] = [];
        
        if (Array.isArray(data)) {
          toolsList = data;
        } else if (data.tools && Array.isArray(data.tools)) {
          toolsList = data.tools;
        } else if (data.data && Array.isArray(data.data)) {
          toolsList = data.data;
        }

        if (toolsList.length > 0) {
          const formattedTools = toolsList.map((tool: any) => {
            // Handle OpenAI-style format: { type: "function", function: { name, description, parameters } }
            if (tool.type === 'function' && tool.function) {
              return {
                name: tool.function.name,
                description: tool.function.description || 'No description available',
                parameters: tool.function.parameters || {}
              };
            }
            // Handle direct format: { name, description, parameters }
            return {
              name: tool.name || tool.function?.name,
              description: tool.description || tool.desc || tool.function?.description || 'No description available',
              parameters: tool.parameters || tool.schema || tool.inputSchema || tool.function?.parameters || {}
            };
          });

          setDiscoveredTools(formattedTools);
          
          // Auto-populate tools in the server config
          if (editingMcpServer) {
            setEditingMcpServer(prev => prev ? {
              ...prev,
              tools: formattedTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                enabled: true,
                parameters: tool.parameters
              }))
            } : null);
          }

          toast({
            title: "Tools Discovered",
            description: `Found ${formattedTools.length} tool(s) from the server`,
          });
        } else {
          toast({
            title: "No Tools Found",
            description: 'The server returned an empty tools list',
            variant: "destructive",
          });
        }
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error';
      
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        errorMessage = 'Request timed out - server did not respond in time';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Check for CORS errors
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        errorMessage = 'CORS error: Server may not allow requests from this origin. Check server CORS settings.';
      }

      toast({
        title: "Error Fetching Tools",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setFetchingTools(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) {
        setConnectionStatus('error');
        return;
      }

      if (!accessToken) {
        setConnectionStatus('disconnected');
        return;
      }

      const response = await fetch(`${backendUrl}/api/instagram/test-connection`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Check if data structure is valid
        if (data.success && data.data && typeof data.data.connected === 'boolean') {
          setConnectionStatus(data.data.connected ? 'connected' : 'error');
        } else {
          // If structure is invalid, check if we have accounts
          const hasAccounts = accounts.length > 0;
          setConnectionStatus(hasAccounts ? 'connected' : 'disconnected');
        }
      } else if (response.status === 404) {
        // No account found - this is disconnected, not an error
        setConnectionStatus('disconnected');
      } else {
        // Other errors
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      // On network error, if we have accounts, assume connected
      // Otherwise, set to disconnected
      const hasAccounts = accounts.length > 0;
      setConnectionStatus(hasAccounts ? 'connected' : 'disconnected');
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthConnect = () => {
    // Use the Instagram Business OAuth URL provided by Meta
    const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=2160534791106844&redirect_uri=https://moca.pages.dev/instagram-callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;
    
    // Redirect to Instagram Business OAuth
    window.location.href = instagramAuthUrl;
  };

  const handleRefreshToken = async () => {
    if (accounts.length === 0) return;
    
    setLoading(true);
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) throw new Error('Backend URL not configured');

      const response = await fetch(`${backendUrl}/api/instagram-oauth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          accountId: accounts[0].accountId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      toast({
        title: "¡Token actualizado!",
        description: "El token de acceso se ha renovado exitosamente",
      });

      // Refresh account data and test connection
      await fetchAccounts();
      await testConnection();

    } catch (error) {
      console.error('Error refreshing token:', error);
      toast({
        title: "Error al actualizar token",
        description: "No se pudo renovar el token. Intenta reconectar con OAuth.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "¡Copiado!",
        description: `${label} ha sido copiado al portapapeles`,
      });
    } catch (error) {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'error':
        return 'Error de conexión';
      default:
        return 'Desconectado';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const startEditingGlobalConfig = () => {
    setEditingGlobalConfig(true);
  };

  const cancelEditingGlobalConfig = () => {
    setEditingGlobalConfig(false);
    // Reset form to current config
    if (globalConfig) {
      setGlobalConfigForm({
        maxResponsesPerConversation: globalConfig.responseLimits.maxResponsesPerConversation,
        resetCounterOnMilestone: globalConfig.responseLimits.resetCounterOnMilestone,
        autoDisableOnScore: globalConfig.leadScoring.autoDisableOnScore,
        autoDisableOnMilestone: globalConfig.leadScoring.autoDisableOnMilestone,
        enableResponseLimits: globalConfig.systemSettings.enableResponseLimits,
        enableLeadScoreAutoDisable: globalConfig.systemSettings.enableLeadScoreAutoDisable,
        enableMilestoneAutoDisable: globalConfig.systemSettings.enableMilestoneAutoDisable,
        logAllDecisions: globalConfig.systemSettings.logAllDecisions
      });
    }
  };

  const saveGlobalConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const backendUrl = BACKEND_URL;
      
      // CRITICAL: If enableLeadScoreAutoDisable is false, set autoDisableOnScore to undefined
      // This ensures consistency - if the feature is disabled, the threshold should not be set
      const autoDisableOnScore = globalConfigForm.enableLeadScoreAutoDisable 
        ? globalConfigForm.autoDisableOnScore 
        : undefined;
      
      // CRITICAL: If enableMilestoneAutoDisable is false, set autoDisableOnMilestone to false
      // This ensures consistency - if the feature is disabled, the setting should be false
      const autoDisableOnMilestone = globalConfigForm.enableMilestoneAutoDisable 
        ? globalConfigForm.autoDisableOnMilestone 
        : false;
      
      const response = await fetch(`${backendUrl}/api/global-agent-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          responseLimits: {
            maxResponsesPerConversation: globalConfigForm.maxResponsesPerConversation,
            resetCounterOnMilestone: globalConfigForm.resetCounterOnMilestone
          },
          leadScoring: {
            autoDisableOnScore: autoDisableOnScore,
            autoDisableOnMilestone: autoDisableOnMilestone
          },
          systemSettings: {
            enableResponseLimits: globalConfigForm.enableResponseLimits,
            enableLeadScoreAutoDisable: globalConfigForm.enableLeadScoreAutoDisable,
            enableMilestoneAutoDisable: globalConfigForm.enableMilestoneAutoDisable,
            logAllDecisions: globalConfigForm.logAllDecisions
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        setGlobalConfig(data.data);
        setEditingGlobalConfig(false);
        setSuccess('Global agent configuration updated successfully');
      } else {
        setError(data.error || 'Failed to update global agent configuration');
      }
    } catch (error) {
      console.error('Error saving global config:', error);
      setError('Failed to save global agent configuration');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (account: InstagramAccount) => {
    console.log('🔧 [Frontend] Starting edit for account:', {
      id: account.id,
      accountId: account.accountId,
      accountName: account.accountName
    });
    setEditingAccount(account.accountId);
    setCustomInstructions(account.settings?.systemPrompt || "");
  };

  const cancelEditing = () => {
    setEditingAccount(null);
    setCustomInstructions("");
  };

  const startEditingMilestone = (account: InstagramAccount) => {
    console.log('🎯 [Frontend] Starting milestone edit for account:', {
      id: account.id,
      accountId: account.accountId,
      accountName: account.accountName
    });
    setEditingMilestone(account.accountId);
    setMilestoneTarget(account.settings?.defaultMilestone?.target || 'link_shared');
    setCustomMilestoneTarget(account.settings?.defaultMilestone?.customTarget || "");
    setAutoDisableAgent(account.settings?.defaultMilestone?.autoDisableAgent ?? true);
  };

  const cancelEditingMilestone = () => {
    setEditingMilestone(null);
    setMilestoneTarget('link_shared');
    setCustomMilestoneTarget("");
    setAutoDisableAgent(true);
  };

  const saveMilestoneConfig = async (accountId: string) => {
    console.log('🎯 [Frontend] Saving milestone config for accountId:', accountId);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}/milestone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          defaultMilestone: {
            target: milestoneTarget,
            customTarget: milestoneTarget === 'custom' ? customMilestoneTarget : undefined,
            autoDisableAgent: autoDisableAgent
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setAccounts(accounts.map(account => 
          account.accountId === accountId 
            ? { 
                ...account, 
                settings: { 
                  ...account.settings, 
                  defaultMilestone: {
                    target: milestoneTarget,
                    customTarget: milestoneTarget === 'custom' ? customMilestoneTarget : undefined,
                    autoDisableAgent: autoDisableAgent
                  }
                } 
              }
            : account
        ));
        setEditingMilestone(null);
        setSuccess('Milestone configuration updated successfully');
      } else {
        setError(data.error || 'Failed to update milestone configuration');
      }
    } catch (error) {
      console.error('Error saving milestone config:', error);
      setError('Failed to save milestone configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveInstructions = async (accountId: string) => {
    console.log('🔧 [Frontend] Saving instructions for accountId:', accountId);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}/instructions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          customInstructions: customInstructions
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setAccounts(accounts.map(account => 
          account.accountId === accountId 
            ? { 
                ...account, 
                settings: { 
                  ...account.settings, 
                  systemPrompt: customInstructions 
                } 
              }
            : account
        ));
        setEditingAccount(null);
        setCustomInstructions("");
        setSuccess('System prompt updated successfully');
      } else {
        setError(data.error || 'Failed to update system prompt');
      }
    } catch (error) {
      console.error('Error saving instructions:', error);
      setError('Failed to save system prompt');
    } finally {
      setSaving(false);
    }
  };

  // Follow-up configuration functions
  const fetchFollowUpConfig = async (accountId: string) => {
    setFollowUpLoading(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/follow-up/config/${accountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const config = await response.json();
        setFollowUpConfig(config);
      } else {
        console.error('Failed to fetch follow-up config');
      }
    } catch (error) {
      console.error('Error fetching follow-up config:', error);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const saveFollowUpConfig = async (accountId: string) => {
    if (!followUpConfig) return;
    
    setFollowUpSaving(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/follow-up/config/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(followUpConfig)
      });

      if (response.ok) {
        const updatedConfig = await response.json();
        setFollowUpConfig(updatedConfig);
        setSuccess('Follow-up configuration saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save follow-up configuration');
      }
    } catch (error) {
      console.error('Error saving follow-up config:', error);
      setError('Failed to save follow-up configuration');
    } finally {
      setFollowUpSaving(false);
    }
  };

  const testFollowUpConfig = async (accountId: string) => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/follow-up/test/${accountId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Test result:', result);
        
        // Show confirmation dialog
        const shouldSend = window.confirm(
          `Test completed! Found ${result.leadsFound} leads that would receive follow-up messages.\n\n` +
          `Total conversations: ${result.totalConversations}\n` +
          `Eligible leads: ${result.leadsFound}\n\n` +
          `Do you want to actually send the follow-up messages now?`
        );
        
        if (shouldSend) {
          // Actually send the follow-up messages
          await sendFollowUpMessages(accountId);
        } else {
          setSuccess('Test completed - no messages sent. This was just a simulation.');
          setTimeout(() => setSuccess(null), 5000);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to test follow-up configuration');
      }
    } catch (error) {
      console.error('Error testing follow-up config:', error);
      setError('Failed to test follow-up configuration');
    }
  };

  const sendFollowUpMessages = async (accountId: string) => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/follow-up/send/${accountId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Follow-up messages sent:', result);
        setSuccess(`Follow-up messages sent successfully! ${result.messagesSent} messages queued for delivery.`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send follow-up messages');
      }
    } catch (error) {
      console.error('Error sending follow-up messages:', error);
      setError('Failed to send follow-up messages');
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Keyword Activation functions
  const fetchKeywordRules = async (accountId: string) => {
    setLoadingKeywords(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/${accountId}/keyword-activation`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform MongoDB documents (_id) to frontend format (id)
        // Filter out any invalid rules (null, undefined, or missing required fields)
        const validRules = (data.data?.rules || [])
          .filter((rule: any) => 
            rule && (rule._id || rule.id) && rule.keyword && typeof rule.keyword === 'string'
          )
          .map((rule: any) => ({
            id: rule._id || rule.id,
            keyword: rule.keyword,
            enabled: rule.enabled ?? true,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt
          }));
        console.log('📋 [Keyword Rules] Fetched and transformed rules:', validRules);
        setKeywordRules(validRules);
      } else {
        console.error('Failed to fetch keyword rules');
        setKeywordRules([]);
      }
    } catch (error) {
      console.error('Error fetching keyword rules:', error);
      setKeywordRules([]);
    } finally {
      setLoadingKeywords(false);
    }
  };

  const createKeywordRule = async (accountId: string) => {
    if (!newKeyword.trim()) {
      setError('Keyword cannot be empty');
      return;
    }

    setSavingKeyword(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/${accountId}/keyword-activation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          enabled: true
        })
      });

      const data = await response.json();

      if (response.ok) {
        await fetchKeywordRules(accountId);
        setNewKeyword("");
        setSuccess('Keyword activation rule created successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to create keyword rule');
      }
    } catch (error) {
      console.error('Error creating keyword rule:', error);
      setError('Failed to create keyword rule');
    } finally {
      setSavingKeyword(false);
    }
  };

  const updateKeywordRule = async (accountId: string, ruleId: string, updates: { keyword?: string; enabled?: boolean }) => {
    setSavingKeyword(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/${accountId}/keyword-activation/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (response.ok) {
        await fetchKeywordRules(accountId);
        setEditingKeyword(null);
        setSuccess('Keyword activation rule updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to update keyword rule');
      }
    } catch (error) {
      console.error('Error updating keyword rule:', error);
      setError('Failed to update keyword rule');
    } finally {
      setSavingKeyword(false);
    }
  };

  const deleteKeywordRule = async (accountId: string, ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this keyword activation rule?')) {
      return;
    }

    setSavingKeyword(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/${accountId}/keyword-activation/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        await fetchKeywordRules(accountId);
        setSuccess('Keyword activation rule deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to delete keyword rule');
      }
    } catch (error) {
      console.error('Error deleting keyword rule:', error);
      setError('Failed to delete keyword rule');
    } finally {
      setSavingKeyword(false);
    }
  };

  const toggleKeywordEnabled = async (accountId: string, ruleId: string, currentEnabled: boolean) => {
    await updateKeywordRule(accountId, ruleId, { enabled: !currentEnabled });
  };

  const toggleAccordion = (accountId: string, section: string) => {
    const key = `${accountId}-${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isAccordionExpanded = (accountId: string, section: string) => {
    const key = `${accountId}-${section}`;
    return expandedSections[key] || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Instagram | Moca - Instagram DM Agent</title>
        <meta name="description" content="Manage your Instagram accounts and AI system prompts" />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Instagram className="w-8 h-8 text-violet-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Instagram</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Manage your Instagram accounts and customize AI system prompts
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Power className={`w-3.5 h-3.5 ${accounts.length > 0 && getCurrentAgentMode(accounts[0]) !== 'off' ? 'text-green-600' : 'text-gray-400'}`} />
              <Select
                value={accounts.length > 0 ? getCurrentAgentMode(accounts[0]) : 'off'}
                onValueChange={(value: 'off' | 'test' | 'on') => {
                  if (accounts.length > 0) {
                    handleChangeAgentMode(accounts[0].accountId, value);
                  }
                }}
                disabled={loading || accounts.length === 0}
              >
                <SelectTrigger id="agent-mode-select" className="w-28 h-8 text-sm border-gray-300">
                  <SelectValue>
                    {(() => {
                      const currentMode = accounts.length > 0 ? getCurrentAgentMode(accounts[0]) : 'off';
                      const modeConfig: Record<'off' | 'test' | 'on', { color: string; label: string }> = {
                        off: { color: 'bg-gray-400', label: 'Off' },
                        test: { color: 'bg-yellow-500', label: 'Test' },
                        on: { color: 'bg-green-500', label: 'On' }
                      };
                      const config = modeConfig[currentMode] || modeConfig.off;
                      return (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${config.color}`}></div>
                          <span>{config.label}</span>
                        </div>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                      <span>Off</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="test">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                      <span>Test Mode</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="on">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span>On</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Estado de la Conexión
              <Badge className={getStatusColor()}>
                {getStatusIcon()}
                <span className="ml-2">{getStatusText()}</span>
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg border">
                    <div className="text-lg font-semibold text-violet-600">{accounts[0].accountName}</div>
                    <div className="text-sm text-gray-500">Cuenta de Instagram</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border">
                    <div className="text-lg font-semibold text-violet-600">{accounts[0].accountId}</div>
                    <div className="text-sm text-gray-500">Account ID</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border">
                    <div className="text-lg font-semibold text-violet-600">
                      {new Date(accounts[0].updatedAt).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">Última sincronización</div>
                  </div>
                </div>
                
                <div className="flex justify-center space-x-4 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => testConnection()}
                    disabled={testing}
                  >
                    {testing ? 'Probando...' : 'Probar Conexión'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRefreshToken}
                    disabled={loading}
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Token'}
                  </Button>
                  <Button
                    onClick={handleOAuthConnect}
                    className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
                  >
                    <Instagram className="w-4 h-4 mr-2" />
                    Reconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No hay cuenta de Instagram conectada</p>
                <p className="text-sm text-gray-400 mb-4">Conecta tu cuenta usando OAuth</p>
                <Button
                  onClick={handleOAuthConnect}
                  className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
                >
                  <Instagram className="w-4 h-4 mr-2" />
                  Conectar con Instagram
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success/Error Messages */}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Global Agent Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-violet-600" />
              <span>Global Agent Settings</span>
            </CardTitle>
            <CardDescription>
              Configure system-wide agent behavior and response limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Response Limits Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="w-4 h-4 text-violet-600" />
                  <h4 className="font-medium text-gray-900">Response Limits</h4>
                </div>
                
                {editingGlobalConfig ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="maxResponses">Max Responses per Conversation</Label>
                        <input
                          id="maxResponses"
                          type="number"
                          min="1"
                          max="20"
                          value={globalConfigForm.maxResponsesPerConversation}
                          onChange={(e) => setGlobalConfigForm(prev => ({
                            ...prev,
                            maxResponsesPerConversation: parseInt(e.target.value) || 3
                          }))}
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Agent will be disabled after this many responses
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="resetCounterOnMilestone"
                          checked={globalConfigForm.resetCounterOnMilestone}
                          onChange={(e) => setGlobalConfigForm(prev => ({
                            ...prev,
                            resetCounterOnMilestone: e.target.checked
                          }))}
                          className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                        />
                        <Label htmlFor="resetCounterOnMilestone" className="text-sm text-gray-700">
                          Reset counter when milestone is achieved
                        </Label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Max responses per conversation:</span>
                      <Badge variant="outline">
                        {globalConfig?.responseLimits.maxResponsesPerConversation || 3}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Reset counter on milestone:</span>
                      <Badge variant={globalConfig?.responseLimits.resetCounterOnMilestone ? "default" : "secondary"}>
                        {globalConfig?.responseLimits.resetCounterOnMilestone ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Lead Scoring Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                  <h4 className="font-medium text-gray-900">Lead Scoring Rules</h4>
                </div>
                
                {editingGlobalConfig ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="autoDisableOnScore">Auto-disable Agent at Lead Score</Label>
                      <select
                        id="autoDisableOnScore"
                        value={globalConfigForm.autoDisableOnScore || ''}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          autoDisableOnScore: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="">Disabled</option>
                        <option value="1">1 - Contact Received</option>
                        <option value="2">2 - Answers 1 Question</option>
                        <option value="3">3 - Confirms Interest</option>
                        <option value="4">4 - Milestone Met</option>
                        <option value="5">5 - Reminder Sent</option>
                        <option value="6">6 - Reminder Answered</option>
                        <option value="7">7 - Sales Done</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Agent will be disabled when lead reaches this score
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoDisableOnMilestone"
                        checked={globalConfigForm.autoDisableOnMilestone}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          autoDisableOnMilestone: e.target.checked
                        }))}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="autoDisableOnMilestone" className="text-sm text-gray-700">
                        Auto-disable when conversation milestone is achieved
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Auto-disable at lead score:</span>
                      <Badge variant="outline">
                        {globalConfig?.leadScoring.autoDisableOnScore 
                          ? `${globalConfig.leadScoring.autoDisableOnScore} - ${globalConfig.leadScoring.scale[`step${globalConfig.leadScoring.autoDisableOnScore}` as keyof typeof globalConfig.leadScoring.scale]?.name}`
                          : "Disabled"
                        }
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Auto-disable on milestone:</span>
                      <Badge variant={globalConfig?.leadScoring.autoDisableOnMilestone ? "default" : "secondary"}>
                        {globalConfig?.leadScoring.autoDisableOnMilestone ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* System Settings Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="w-4 h-4 text-violet-600" />
                  <h4 className="font-medium text-gray-900">System Settings</h4>
                </div>
                
                {editingGlobalConfig ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableResponseLimits"
                        checked={globalConfigForm.enableResponseLimits}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          enableResponseLimits: e.target.checked
                        }))}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="enableResponseLimits" className="text-sm text-gray-700">
                        Enable response limits
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableLeadScoreAutoDisable"
                        checked={globalConfigForm.enableLeadScoreAutoDisable}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          enableLeadScoreAutoDisable: e.target.checked
                        }))}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="enableLeadScoreAutoDisable" className="text-sm text-gray-700">
                        Enable lead score auto-disable
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableMilestoneAutoDisable"
                        checked={globalConfigForm.enableMilestoneAutoDisable}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          enableMilestoneAutoDisable: e.target.checked
                        }))}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="enableMilestoneAutoDisable" className="text-sm text-gray-700">
                        Enable milestone auto-disable
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="logAllDecisions"
                        checked={globalConfigForm.logAllDecisions}
                        onChange={(e) => setGlobalConfigForm(prev => ({
                          ...prev,
                          logAllDecisions: e.target.checked
                        }))}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="logAllDecisions" className="text-sm text-gray-700">
                        Log all agent decisions (for debugging)
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Response limits enabled:</span>
                      <Badge variant={globalConfig?.systemSettings.enableResponseLimits ? "default" : "secondary"}>
                        {globalConfig?.systemSettings.enableResponseLimits ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Lead score auto-disable:</span>
                      <Badge variant={globalConfig?.systemSettings.enableLeadScoreAutoDisable ? "default" : "secondary"}>
                        {globalConfig?.systemSettings.enableLeadScoreAutoDisable ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Milestone auto-disable:</span>
                      <Badge variant={globalConfig?.systemSettings.enableMilestoneAutoDisable ? "default" : "secondary"}>
                        {globalConfig?.systemSettings.enableMilestoneAutoDisable ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Decision logging:</span>
                      <Badge variant={globalConfig?.systemSettings.logAllDecisions ? "default" : "secondary"}>
                        {globalConfig?.systemSettings.logAllDecisions ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                  {editingGlobalConfig ? (
                    <>
                      <Button
                        onClick={saveGlobalConfig}
                        disabled={saving}
                        size="sm"
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={cancelEditingGlobalConfig}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={startEditingGlobalConfig}
                      size="sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Settings
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MCP Tools Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plug className="w-5 h-5 text-violet-600" />
              <span>MCP Tools Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure Model Context Protocol (MCP) tools to extend your agent's capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Enable/Disable MCP Tools */}
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <Label htmlFor="enableMcpTools" className="text-base font-medium">
                    Enable MCP Tools
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Allow the agent to use external tools via MCP servers
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="enableMcpTools"
                  checked={mcpConfig.enabled}
                  onChange={(e) => setMcpConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-5 w-5 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                />
              </div>

              {/* Available Tools - Only show when enabled */}
              {mcpConfig.enabled && availableTools.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Bot className="w-4 h-4 text-violet-600" />
                    <h4 className="font-medium text-gray-900">Available Tools</h4>
                    <Badge variant="outline">{availableTools.length}</Badge>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableTools.map((tool, idx) => (
                      <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="font-medium">{tool.name}</div>
                        <div className="text-gray-600 text-xs">{tool.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MCP Servers List - Always show so servers can be managed */}
              <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Settings className="w-4 h-4 text-violet-600" />
                        <h4 className="font-medium text-gray-900">MCP Servers</h4>
                        <Badge variant="outline">{mcpConfig.servers.length}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addMcpServer}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Server
                      </Button>
                    </div>

                    {mcpConfig.servers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Plug className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No MCP servers configured</p>
                        <p className="text-sm">Add a server to enable MCP tools</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mcpConfig.servers.map((server, idx) => (
                          <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant={server.enabled ? "default" : "secondary"}>
                                  {server.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                                <span className="font-medium">{server.name}</span>
                                <span className="text-sm text-gray-500">({server.connectionType})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => testMcpConnection(server.name)}
                                  disabled={testingMcpConnection === server.name}
                                >
                                  {testingMcpConnection === server.name ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-600"></div>
                                  ) : (
                                    <TestTube className="w-4 h-4 mr-1" />
                                  )}
                                  Test
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingMcpServer(server)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteMcpServer(server.name)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>URL: {server.url}</div>
                              <div>Tools: {server.tools.length}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Server Modal */}
                  {editingMcpServer && (
                    <div className="border rounded-lg p-4 bg-white">
                      <h4 className="font-medium mb-4">
                        {mcpConfig.servers.find(s => s.name === editingMcpServer.name) ? 'Edit' : 'Add'} MCP Server
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="serverName">Server Name *</Label>
                          <Input
                            id="serverName"
                            value={editingMcpServer.name}
                            onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, name: e.target.value } : null)}
                            placeholder="e.g., weather-service"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label htmlFor="serverUrl">Server URL *</Label>
                            <div className="flex space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => editingMcpServer && fetchToolsFromServer(editingMcpServer)}
                                disabled={fetchingTools || !editingMcpServer?.url}
                                className="h-7 text-xs"
                              >
                                {fetchingTools ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-violet-600 mr-1"></div>
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3 mr-1" />
                                    Get Tools
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => editingMcpServer && healthCheckMcpServer(editingMcpServer)}
                                disabled={healthChecking || !editingMcpServer?.url}
                                className="h-7 text-xs"
                              >
                                {healthChecking ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-violet-600 mr-1"></div>
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <Activity className="w-3 h-3 mr-1" />
                                    Health Check
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <Input
                            id="serverUrl"
                            value={editingMcpServer.url}
                            onChange={(e) => {
                              setEditingMcpServer(prev => prev ? { ...prev, url: e.target.value } : null);
                              setHealthCheckResult(null); // Clear result when URL changes
                            }}
                            placeholder="https://api.example.com/mcp"
                          />
                          {healthCheckResult && (
                            <div className={`mt-2 p-2 rounded text-sm flex items-center space-x-2 ${
                              healthCheckResult.success 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {healthCheckResult.success ? (
                                <Heart className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span>{healthCheckResult.message}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="connectionType">Connection Type</Label>
                          <select
                            id="connectionType"
                            value={editingMcpServer.connectionType}
                            onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, connectionType: e.target.value as any } : null)}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                          >
                            <option value="http">HTTP</option>
                            <option value="websocket">WebSocket</option>
                            <option value="stdio">STDIO</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="authType">Authentication Type</Label>
                          <select
                            id="authType"
                            value={editingMcpServer.authentication.type}
                            onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, authentication: { ...prev.authentication, type: e.target.value as any } } : null)}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                          >
                            <option value="none">None</option>
                            <option value="api_key">API Key</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="oauth2">OAuth2</option>
                          </select>
                        </div>
                        {editingMcpServer.authentication.type === 'api_key' && (
                          <div>
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                              id="apiKey"
                              type="password"
                              value={editingMcpServer.authentication.apiKey || ''}
                              onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, authentication: { ...prev.authentication, apiKey: e.target.value } } : null)}
                              placeholder="Enter API key"
                            />
                          </div>
                        )}
                        {editingMcpServer.authentication.type === 'bearer' && (
                          <div>
                            <Label htmlFor="bearerToken">Bearer Token</Label>
                            <Input
                              id="bearerToken"
                              type="password"
                              value={editingMcpServer.authentication.bearerToken || ''}
                              onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, authentication: { ...prev.authentication, bearerToken: e.target.value } } : null)}
                              placeholder="Enter bearer token"
                            />
                          </div>
                        )}
                        
                        {/* Discovered Tools Display */}
                        {discoveredTools.length > 0 && (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <Label className="font-medium">Discovered Tools ({discoveredTools.length})</Label>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDiscoveredTools([])}
                                className="h-6 text-xs"
                              >
                                Clear
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {discoveredTools.map((tool, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{tool.name}</div>
                                      <div className="text-xs text-gray-600 mt-1">{tool.description}</div>
                                      {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Has {Object.keys(tool.parameters.properties || {}).length} parameter(s)
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="ml-2">
                                      Auto-enabled
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              These tools have been automatically added to the server configuration
                            </p>
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="serverEnabled"
                            checked={editingMcpServer.enabled}
                            onChange={(e) => setEditingMcpServer(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                            className="h-4 w-4 text-violet-600"
                          />
                          <Label htmlFor="serverEnabled">Enable this server</Label>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => {
                              if (editingMcpServer) {
                                saveMcpServer(editingMcpServer);
                                // Update local state
                                const existingIndex = mcpConfig.servers.findIndex(s => s.name === editingMcpServer.name);
                                if (existingIndex >= 0) {
                                  const newServers = [...mcpConfig.servers];
                                  newServers[existingIndex] = editingMcpServer;
                                  setMcpConfig(prev => ({ ...prev, servers: newServers }));
                                } else {
                                  setMcpConfig(prev => ({ ...prev, servers: [...prev.servers, editingMcpServer] }));
                                }
                              }
                            }}
                            size="sm"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Server
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingMcpServer(null);
                              setDiscoveredTools([]);
                              setHealthCheckResult(null);
                            }}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  onClick={saveMcpConfig}
                  disabled={saving}
                  size="sm"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save MCP Configuration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts List */}
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Instagram accounts</h3>
                <p className="text-gray-600 mb-4">
                  Connect your first Instagram account through the setup process
                </p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 space-y-4 sm:space-y-0">
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                            {account.accountName}
                          </h3>
                          <Badge variant={account.isActive ? "default" : "secondary"} className="w-fit">
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                          <div className="break-all">
                            <span className="font-medium">Account ID:</span> {account.accountId}
                          </div>
                          <div>
                            <span className="font-medium">Last Updated:</span> {formatTime(account.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Click sections below to configure
                    </div>
                  </div>

                  {/* Default Agent Enabled Accordion */}
                  <div className="border-t pt-4">
                    <button
                      onClick={() => toggleAccordion(account.accountId, 'defaultAgentEnabled')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Power className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <h4 className="text-sm font-medium text-gray-700">Default Agent State</h4>
                        <Badge variant="outline" className="text-xs">
                          {account.settings?.defaultAgentEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {isAccordionExpanded(account.accountId, 'defaultAgentEnabled') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {isAccordionExpanded(account.accountId, 'defaultAgentEnabled') && (
                      <div className="mt-3 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800 mb-3">
                            <strong>Configure the default state for new conversations:</strong>
                          </p>
                          <ul className="text-xs text-blue-700 space-y-2 list-disc list-inside">
                            <li><strong>Enabled:</strong> New conversations will have the agent active by default</li>
                            <li><strong>Disabled:</strong> New conversations will have the agent inactive (can be activated via keywords or manually)</li>
                          </ul>
                          <p className="text-xs text-blue-700 mt-3 font-medium">
                            💡 Tip: Use "Keyword Activation" feature to automatically activate conversations when specific keywords are detected.
                          </p>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                          <div className="flex-1">
                            <Label htmlFor="defaultAgentEnabled" className="text-sm font-medium text-gray-900">
                              Agent Enabled by Default for New Conversations
                            </Label>
                            <p className="text-xs text-gray-500 mt-1">
                              When {account.settings?.defaultAgentEnabled ? 'enabled' : 'disabled'}, all new conversations will start with the agent {account.settings?.defaultAgentEnabled ? 'active' : 'inactive'}.
                            </p>
                          </div>
                          <Switch
                            id="defaultAgentEnabled"
                            checked={account.settings?.defaultAgentEnabled ?? false}
                            onCheckedChange={(checked) => handleDefaultAgentEnabledToggle(account.accountId, checked)}
                            disabled={saving}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* System Prompt Accordion */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => toggleAccordion(account.accountId, 'systemPrompt')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <h4 className="text-sm font-medium text-gray-700">AI System Prompt</h4>
                        {account.settings?.systemPrompt && (
                          <Badge variant="outline" className="text-xs">
                            {account.settings.systemPrompt.length} chars
                          </Badge>
                        )}
                      </div>
                      {isAccordionExpanded(account.accountId, 'systemPrompt') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {isAccordionExpanded(account.accountId, 'systemPrompt') && (
                      <div className="mt-3 space-y-4">
                        {editingAccount === account.accountId ? (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="instructions">Custom Instructions</Label>
                              <Textarea
                                id="instructions"
                                placeholder="Enter your custom AI instructions here..."
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                className="min-h-[200px] mt-2"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                These instructions will be used by the AI to respond to messages for this account.
                              </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <Button
                                onClick={() => saveInstructions(account.accountId)}
                                disabled={saving}
                          size="sm"
                                className="w-full sm:w-auto"
                        >
                                {saving ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                                  <Save className="w-4 h-4 mr-2" />
                          )}
                                Save Changes
                        </Button>
                        <Button
                                variant="outline" 
                                onClick={cancelEditing}
                          size="sm"
                                className="w-full sm:w-auto"
                        >
                                Cancel
                        </Button>
                      </div>
                    </div>
                        ) : (
                          <div className="space-y-3">
                            {account.settings?.systemPrompt ? (
                              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                                  {account.settings.systemPrompt}
                                </p>
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">
                                  No custom instructions set. Using default AI behavior.
                                </p>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-gray-500">
                                {account.settings?.systemPrompt 
                                  ? `${account.settings.systemPrompt.length} characters`
                                  : 'Default prompt in use'
                      }
                    </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(account)}
                                className="text-xs"
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Follow-up Configuration Accordion */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => toggleAccordion(account.accountId, 'followUp')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <h4 className="text-sm font-medium text-gray-700">Lead Follow-up</h4>
                        {followUpConfig?.enabled && (
                          <Badge variant="outline" className="text-xs">
                            Enabled
                          </Badge>
                        )}
                      </div>
                      {isAccordionExpanded(account.accountId, 'followUp') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {isAccordionExpanded(account.accountId, 'followUp') && (
                      <div className="mt-3 space-y-4">
                        {followUpLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
                          </div>
                        ) : followUpConfig ? (
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="followUpEnabled"
                                checked={followUpConfig.enabled}
                                onChange={(e) => setFollowUpConfig(prev => prev ? {
                                  ...prev,
                                  enabled: e.target.checked
                                } : null)}
                                className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                              />
                              <Label htmlFor="followUpEnabled" className="text-sm text-gray-700">
                                Enable automatic follow-up messages
                              </Label>
                            </div>

                            {followUpConfig.enabled && (
                              <div className="space-y-4 pl-6 border-l-2 border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="minLeadScore">Minimum Lead Score</Label>
                                    <select
                                      id="minLeadScore"
                                      value={followUpConfig.minLeadScore}
                                      onChange={(e) => setFollowUpConfig(prev => prev ? {
                                        ...prev,
                                        minLeadScore: Number(e.target.value)
                                      } : null)}
                                      className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    >
                                      <option value={1}>1 - Contact Received</option>
                                      <option value={2}>2 - Answers 1 Question</option>
                                      <option value={3}>3 - Confirms Interest</option>
                                      <option value={4}>4 - Milestone Met</option>
                                      <option value={5}>5 - Reminder Sent</option>
                                      <option value={6}>6 - Reminder Answered</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Follow up leads with this score and above
                                    </p>
                                  </div>

                                  <div>
                                    <Label htmlFor="maxFollowUps">Max Follow-ups</Label>
                                    <input
                                      id="maxFollowUps"
                                      type="number"
                                      min="1"
                                      max="10"
                                      value={followUpConfig.maxFollowUps}
                                      onChange={(e) => setFollowUpConfig(prev => prev ? {
                                        ...prev,
                                        maxFollowUps: Number(e.target.value)
                                      } : null)}
                                      className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      Maximum follow-ups per lead
                                    </p>
                                  </div>

                                  <div>
                                    <Label htmlFor="timeSinceLastAnswer">Hours Since Last Answer</Label>
                                    <input
                                      id="timeSinceLastAnswer"
                                      type="number"
                                      min="1"
                                      max="168"
                                      value={followUpConfig.timeSinceLastAnswer}
                                      onChange={(e) => setFollowUpConfig(prev => prev ? {
                                        ...prev,
                                        timeSinceLastAnswer: Number(e.target.value)
                                      } : null)}
                                      className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      Wait this long before following up
                                    </p>
                                  </div>

                                  <div className="md:col-span-2">
                                    <Label>Message Mode</Label>
                                    <div className="mt-2 flex gap-4">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name="messageMode"
                                          checked={(followUpConfig.messageMode || 'template') === 'template'}
                                          onChange={() => setFollowUpConfig(prev => prev ? { ...prev, messageMode: 'template' } : null)}
                                          className="text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className="text-sm">Template</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name="messageMode"
                                          checked={followUpConfig.messageMode === 'ai'}
                                          onChange={() => setFollowUpConfig(prev => prev ? { ...prev, messageMode: 'ai' } : null)}
                                          className="text-violet-600 focus:ring-violet-500"
                                        />
                                        <Sparkles className="w-4 h-4 text-violet-500" />
                                        <span className="text-sm">AI Suggested</span>
                                      </label>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {followUpConfig.messageMode === 'ai'
                                        ? 'AI will analyze each conversation and suggest a continuation based on your System Prompt'
                                        : 'Use a fixed template for all follow-up messages'}
                                    </p>
                                  </div>

                                  {(followUpConfig.messageMode || 'template') === 'template' && (
                                    <div className="md:col-span-2">
                                      <Label htmlFor="messageTemplate">Follow-up Message Template</Label>
                                      <Textarea
                                        id="messageTemplate"
                                        value={followUpConfig.messageTemplate}
                                        onChange={(e) => setFollowUpConfig(prev => prev ? {
                                          ...prev,
                                          messageTemplate: e.target.value
                                        } : null)}
                                        className="mt-2"
                                        rows={3}
                                        placeholder="Enter your follow-up message template..."
                                      />
                                      <p className="text-xs text-gray-500 mt-1">
                                        Use {`{name}`} for personalization (e.g., "Hola {`{name}`}!")
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                  <Button
                                    onClick={() => saveFollowUpConfig(account.accountId)}
                                    disabled={followUpSaving}
                                    size="sm"
                                    className="w-full sm:w-auto"
                                  >
                                    {followUpSaving ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    ) : (
                                      <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Save Configuration
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => testFollowUpConfig(account.accountId)}
                                    size="sm"
                                    className="w-full sm:w-auto"
                                  >
                                    <Target className="w-4 h-4 mr-2" />
                                    Test Configuration
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              Loading follow-up configuration...
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Keyword Activation Accordion */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => toggleAccordion(account.accountId, 'keywordActivation')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Key className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <h4 className="text-sm font-medium text-gray-700">Keyword Activation</h4>
                        {keywordRules.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {keywordRules.filter(r => r.enabled).length} active
                          </Badge>
                        )}
                      </div>
                      {isAccordionExpanded(account.accountId, 'keywordActivation') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {isAccordionExpanded(account.accountId, 'keywordActivation') && (
                      <div className="mt-3 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-800">
                            <strong>How it works:</strong> The bot is inactive by default. When a message (from lead or owner) contains any of these keywords, 
                            the bot will automatically activate and start responding in that conversation.
                          </p>
                        </div>

                        {loadingKeywords ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Add New Keyword */}
                            <div className="border rounded-lg p-4 bg-gray-50">
                              <Label htmlFor="newKeyword" className="text-sm font-medium">Add New Keyword</Label>
                              <div className="flex gap-2 mt-2">
                                <Input
                                  id="newKeyword"
                                  value={newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  placeholder="e.g., LANDING"
                                  className="flex-1"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter' && newKeyword.trim()) {
                                      createKeywordRule(account.accountId);
                                    }
                                  }}
                                />
                                <Button
                                  onClick={() => createKeywordRule(account.accountId)}
                                  disabled={!newKeyword.trim() || savingKeyword}
                                  size="sm"
                                >
                                  {savingKeyword ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Keywords are case-insensitive. Example: "LANDING" will match "landing", "Landing", etc.
                              </p>
                            </div>

                            {/* Keywords List */}
                            {keywordRules.length === 0 ? (
                              <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <Key className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">
                                  No keyword activation rules configured
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Add keywords to enable automatic bot activation
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {keywordRules.filter(rule => rule && rule.id && rule.keyword).map((rule) => (
                                  <div key={rule.id} className="border rounded-lg p-3 bg-white flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1">
                                      <Switch
                                        checked={rule.enabled ?? false}
                                        onCheckedChange={() => toggleKeywordEnabled(account.accountId, rule.id, rule.enabled)}
                                        disabled={savingKeyword}
                                      />
                                      <div className="flex-1">
                                        {editingKeyword?.id === rule.id ? (
                                          <div className="flex items-center gap-2">
                                            <Input
                                              value={editingKeyword?.keyword || ''}
                                              onChange={(e) => setEditingKeyword(editingKeyword ? { ...editingKeyword, keyword: e.target.value } : null)}
                                              className="text-sm"
                                              autoFocus
                                            />
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                if (editingKeyword?.keyword?.trim()) {
                                                  updateKeywordRule(account.accountId, rule.id, { keyword: editingKeyword.keyword });
                                                }
                                              }}
                                              disabled={!editingKeyword?.keyword?.trim() || savingKeyword}
                                            >
                                              <Save className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => setEditingKeyword(null)}
                                              disabled={savingKeyword}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className={`text-sm font-medium ${rule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                                              {rule.keyword?.toUpperCase() || 'UNKNOWN'}
                                            </span>
                                            {!rule.enabled && (
                                              <Badge variant="secondary" className="ml-2 text-xs">Disabled</Badge>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {editingKeyword?.id !== rule.id && (
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            if (rule && rule.id && rule.keyword) {
                                              setEditingKeyword({ id: rule.id, keyword: rule.keyword, enabled: rule.enabled ?? false });
                                            }
                                          }}
                                          disabled={savingKeyword}
                                        >
                                          <Settings className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => deleteKeywordRule(account.accountId, rule.id)}
                                          disabled={savingKeyword}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Milestone Configuration Accordion */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => toggleAccordion(account.accountId, 'milestone')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Target className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <h4 className="text-sm font-medium text-gray-700">Default Milestone Configuration</h4>
                        {account.settings?.defaultMilestone && (
                          <Badge variant="outline" className="text-xs">
                            {account.settings.defaultMilestone.target === 'custom' 
                              ? 'Custom'
                              : account.settings.defaultMilestone.target?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Set'
                            }
                          </Badge>
                        )}
                      </div>
                      {isAccordionExpanded(account.accountId, 'milestone') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    
                    {isAccordionExpanded(account.accountId, 'milestone') && (
                      <div className="mt-3 space-y-4">
                        {editingMilestone === account.accountId ? (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="milestoneTarget">Milestone Target</Label>
                              <select
                                id="milestoneTarget"
                                value={milestoneTarget}
                                onChange={(e) => setMilestoneTarget(e.target.value as any)}
                                className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                              >
                                <option value="link_shared">Link Shared</option>
                                <option value="meeting_scheduled">Meeting Scheduled</option>
                                <option value="demo_booked">Demo Booked</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>

                            {milestoneTarget === 'custom' && (
                              <div>
                                <Label htmlFor="customMilestoneTarget">Custom Milestone Description</Label>
                                <input
                                  id="customMilestoneTarget"
                                  type="text"
                                  value={customMilestoneTarget}
                                  onChange={(e) => setCustomMilestoneTarget(e.target.value)}
                                  placeholder="e.g., 'Price quote requested'"
                                  className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                />
                              </div>
                            )}

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="autoDisableAgent"
                                checked={autoDisableAgent}
                                onChange={(e) => setAutoDisableAgent(e.target.checked)}
                                className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                              />
                              <Label htmlFor="autoDisableAgent" className="text-sm text-gray-700">
                                Auto-disable agent when milestone is achieved
                              </Label>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <Button 
                                onClick={() => saveMilestoneConfig(account.accountId)}
                                disabled={saving}
                                size="sm"
                                className="w-full sm:w-auto"
                              >
                                {saving ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                ) : (
                                  <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Milestone
                              </Button>
                      <Button
                                variant="outline" 
                                onClick={cancelEditingMilestone}
                        size="sm"
                                className="w-full sm:w-auto"
                      >
                                Cancel
                      </Button>
                    </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {account.settings?.defaultMilestone ? (
                              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  {account.settings.defaultMilestone.target === 'link_shared' && <LinkIcon className="w-4 h-4 text-violet-600 flex-shrink-0" />}
                                  {account.settings.defaultMilestone.target === 'meeting_scheduled' && <Calendar className="w-4 h-4 text-violet-600 flex-shrink-0" />}
                                  {account.settings.defaultMilestone.target === 'demo_booked' && <Presentation className="w-4 h-4 text-violet-600 flex-shrink-0" />}
                                  {account.settings.defaultMilestone.target === 'custom' && <Target className="w-4 h-4 text-violet-600 flex-shrink-0" />}
                                  <span className="text-sm font-medium text-gray-700 break-words">
                                    {account.settings.defaultMilestone.target === 'custom' 
                                      ? account.settings.defaultMilestone.customTarget 
                                      : account.settings.defaultMilestone.target 
                                        ? account.settings.defaultMilestone.target.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                                        : 'Milestone'
                                    }
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Auto-disable agent: {account.settings.defaultMilestone.autoDisableAgent ? 'Yes' : 'No'}
                        </div>
                      </div>
                            ) : (
                              <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">
                                  No milestone configuration set. Using default behavior.
                                </p>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-gray-500">
                                {account.settings?.defaultMilestone ? 'Configured' : 'Not configured'}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingMilestone(account)}
                                className="text-xs"
                              >
                                <Target className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Chatbot Test Component */}
      <ChatbotTest />
    </>
  );
};

export default InstagramAccounts;