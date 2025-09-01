import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Instagram, 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  ExternalLink
} from "lucide-react";
import { Helmet } from "react-helmet";

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: Date;
  isActive: boolean;
  rateLimits: {
    messagesPerSecond: number;
    userCooldown: number;
    debounceWindow: number;
  };
  settings: {
    autoRespond: boolean;
    aiEnabled: boolean;
    fallbackRules: string[];
  };
  webhook: {
    verifyToken: string;
    endpoint: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InstagramAccounts = () => {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState<{ [key: string]: boolean }>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add Account Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    accountId: "",
    accountName: "",
    accessToken: "",
    refreshToken: ""
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
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

  const testConnection = async (accountId: string) => {
    setTestingConnection(accountId);
    setError(null);
    setSuccess(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/test-connection/${accountId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Connection test successful for ${accountId}`);
      } else {
        setError(data.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setError('Failed to test connection');
    } finally {
      setTestingConnection(null);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this Instagram account? This action cannot be undone.')) {
      return;
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        setAccounts(accounts.filter(account => account.accountId !== accountId));
        setSuccess('Instagram account deleted successfully');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
    }
  };

  const addAccount = async () => {
    if (!newAccount.accountId || !newAccount.accessToken) {
      setError('Account ID and Access Token are required');
      return;
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          accountId: newAccount.accountId,
          accountName: newAccount.accountName || `Account ${newAccount.accountId}`,
          accessToken: newAccount.accessToken,
          refreshToken: newAccount.refreshToken || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAccounts([...accounts, data.data.account]);
        setNewAccount({ accountId: "", accountName: "", accessToken: "", refreshToken: "" });
        setShowAddForm(false);
        setSuccess('Instagram account added successfully');
      } else {
        setError(data.error || 'Failed to add account');
      }
    } catch (error) {
      console.error('Error adding account:', error);
      setError('Failed to add account');
    }
  };

  const toggleTokenVisibility = (accountId: string) => {
    setShowTokens(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
    setTimeout(() => setSuccess(null), 2000);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const isTokenExpired = (expiryDate: Date) => {
    return new Date(expiryDate) <= new Date();
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
        <meta name="description" content="Manage your connected Instagram accounts" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Instagram Accounts</h1>
            <p className="text-gray-600 mt-1">
              Manage your connected Instagram accounts and settings
            </p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
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

        {/* Add Account Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Instagram Account</CardTitle>
              <CardDescription>
                Connect a new Instagram account to your Moca system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Account ID *</Label>
                  <Input
                    id="accountId"
                    placeholder="Instagram Account ID"
                    value={newAccount.accountId}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, accountId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    placeholder="Display name for this account"
                    value={newAccount.accountName}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, accountName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Instagram User Access Token"
                  value={newAccount.accessToken}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, accessToken: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="refreshToken">Refresh Token (Optional)</Label>
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="Refresh Token"
                  value={newAccount.refreshToken}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, refreshToken: e.target.value }))}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={addAccount}>
                  Add Account
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accounts List */}
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Instagram accounts</h3>
                <p className="text-gray-600 mb-4">
                  Connect your first Instagram account to start automating messages
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
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
                          {isTokenExpired(account.tokenExpiry) && (
                            <Badge variant="destructive">Token Expired</Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Account ID:</span> {account.accountId}
                          </div>
                          <div>
                            <span className="font-medium">Token Expiry:</span> {formatTime(account.tokenExpiry)}
                          </div>
                          <div>
                            <span className="font-medium">Rate Limits:</span> {account.rateLimits.messagesPerSecond} msg/sec, {account.rateLimits.userCooldown}s cooldown
                          </div>
                          <div>
                            <span className="font-medium">Settings:</span> 
                            Auto-respond: {account.settings.autoRespond ? 'Yes' : 'No'}, 
                            AI: {account.settings.aiEnabled ? 'Enabled' : 'Disabled'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(account.accountId)}
                        disabled={testingConnection === account.accountId}
                      >
                        {testingConnection === account.accountId ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-600"></div>
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAccount(account.accountId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Token Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Access Token</h4>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTokenVisibility(account.accountId)}
                        >
                          {showTokens[account.accountId] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(account.accessToken)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded text-sm font-mono break-all">
                      {showTokens[account.accountId] 
                        ? account.accessToken 
                        : '•'.repeat(50)
                      }
                    </div>
                  </div>

                  {/* Webhook Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Webhook Configuration</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(account.webhook.endpoint)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Endpoint:</span>
                        <div className="bg-gray-100 p-2 rounded font-mono text-xs break-all">
                          {account.webhook.endpoint}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Verify Token:</span>
                        <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                          {account.webhook.verifyToken}
                        </div>
                      </div>
                    </div>
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
