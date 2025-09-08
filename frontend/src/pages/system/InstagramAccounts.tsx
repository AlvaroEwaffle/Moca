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
  ChevronRight
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
  
  // Accordion state
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchAccounts();
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