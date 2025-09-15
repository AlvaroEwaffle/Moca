import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Link,
  Presentation,
  ChevronDown,
  ChevronRight,
  Shield,
  BarChart3,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Helmet } from "react-helmet";

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  settings?: {
    systemPrompt?: string;
    defaultMilestone?: {
      target: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
      customTarget?: string;
      autoDisableAgent: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
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
}

const InstagramAccounts = () => {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
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

  useEffect(() => {
    fetchAccounts();
    fetchGlobalConfig();
  }, []);

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
        setAccounts(data.data?.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to load Instagram accounts');
    } finally {
      setLoading(false);
    }
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
        }
      }
    } catch (error) {
      console.error('Error fetching global config:', error);
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
            autoDisableOnScore: globalConfigForm.autoDisableOnScore,
            autoDisableOnMilestone: globalConfigForm.autoDisableOnMilestone
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

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString();
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
        <title>Instagram Accounts | Moca - Instagram DM Agent</title>
        <meta name="description" content="Manage your Instagram accounts and AI system prompts" />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Instagram Accounts</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Manage your Instagram accounts and customize AI system prompts
            </p>
          </div>
          <Button onClick={fetchAccounts} variant="outline" size="sm" className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

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

                  {/* System Prompt Accordion */}
                  <div className="border-t pt-4">
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
                                  {account.settings.defaultMilestone.target === 'link_shared' && <Link className="w-4 h-4 text-violet-600 flex-shrink-0" />}
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
    </>
  );
};

export default InstagramAccounts;