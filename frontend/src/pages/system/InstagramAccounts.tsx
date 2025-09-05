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
  Bot
} from "lucide-react";
import { Helmet } from "react-helmet";

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  settings?: {
    systemPrompt?: string;
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

      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Instagram Accounts</h1>
            <p className="text-gray-600 mt-1">
              Manage your Instagram accounts and customize AI system prompts
            </p>
          </div>
          <Button onClick={fetchAccounts} variant="outline" size="sm">
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
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                        <Instagram className="w-6 h-6 text-violet-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {account.accountName}
                          </h3>
                          <Badge variant={account.isActive ? "default" : "secondary"}>
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Account ID:</span> {account.accountId}
                          </div>
                          <div>
                            <span className="font-medium">Last Updated:</span> {formatTime(account.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(account)}
                        disabled={editingAccount === account.accountId}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit Prompt
                      </Button>
                    </div>
                  </div>

                  {/* System Prompt Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Bot className="w-4 h-4 text-violet-600" />
                      <h4 className="text-sm font-medium text-gray-700">AI System Prompt</h4>
                    </div>
                    
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
                        
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => saveInstructions(account.accountId)}
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
                            onClick={cancelEditing}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {account.settings?.systemPrompt ? (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
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
                        
                        <div className="text-xs text-gray-500">
                          {account.settings?.systemPrompt 
                            ? `${account.settings.systemPrompt.length} characters`
                            : 'Default prompt in use'
                          }
                        </div>
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