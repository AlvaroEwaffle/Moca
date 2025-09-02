import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, User, MessageCircle, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet";

interface Contact {
  id: string;
  name: string;
  username: string;
  psid: string;
  lastMessage?: Date;
}

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
}

const SendMessage = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const backendUrl = BACKEND_URL;
      
      // Fetch contacts and accounts in parallel
      const [contactsResponse, accountsResponse] = await Promise.all([
        fetch(`${backendUrl}/api/instagram/contacts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }),
        fetch(`${backendUrl}/api/instagram/accounts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        })
      ]);

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        setContacts(contactsData.data?.contacts || []);
      }

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData.data?.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load contacts and accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact || !selectedAccount || !messageText.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          contactId: selectedContact,
          accountId: selectedAccount,
          content: {
            text: messageText.trim()
          },
          priority: priority
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setMessageText("");
        setSelectedContact("");
        setSelectedAccount("");
        setPriority("normal");
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getSelectedContact = () => {
    return contacts.find(contact => contact.id === selectedContact);
  };

  const getSelectedAccount = () => {
    return accounts.find(account => account.accountId === selectedAccount);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
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
        <title>Send Message | Moca - Instagram DM Agent</title>
        <meta name="description" content="Send manual messages to your Instagram contacts" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Send Message</h1>
          <p className="text-gray-600 mt-1">
            Send a manual message to any of your Instagram contacts
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Message sent successfully! It will be delivered shortly.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Message Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>
                  Select a contact and compose your message
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contact Selection */}
                <div className="space-y-2">
                  <Label htmlFor="contact">Select Contact *</Label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>{contact.name}</span>
                            <span className="text-gray-500">(@{contact.username})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Account Selection */}
                <div className="space-y-2">
                  <Label htmlFor="account">Instagram Account *</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.accountId} value={account.accountId}>
                          <div className="flex items-center space-x-2">
                            <MessageCircle className="w-4 h-4" />
                            <span>{account.accountName}</span>
                            <Badge variant={account.isActive ? "default" : "secondary"}>
                              {account.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Selection */}
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message Text */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="min-h-[120px]"
                    maxLength={1000}
                  />
                  <div className="text-right text-sm text-gray-500">
                    {messageText.length}/1000 characters
                  </div>
                </div>

                {/* Send Button */}
                <Button 
                  onClick={handleSendMessage}
                  disabled={!selectedContact || !selectedAccount || !messageText.trim() || sending}
                  className="w-full"
                >
                  {sending ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact & Account Info */}
          <div className="space-y-6">
            {/* Selected Contact Info */}
            {getSelectedContact() && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Selected Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {getSelectedContact()?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          @{getSelectedContact()?.username}
                        </p>
                      </div>
                    </div>
                    
                    {getSelectedContact()?.lastMessage && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>Last message: {formatTimeAgo(getSelectedContact()!.lastMessage!)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Account Info */}
            {getSelectedAccount() && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Selected Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {getSelectedAccount()?.accountName}
                        </p>
                        <Badge variant={getSelectedAccount()?.isActive ? "default" : "secondary"}>
                          {getSelectedAccount()?.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Tips */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Quick Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Messages are queued and sent based on rate limits</p>
                  <p>• High priority messages are sent first</p>
                  <p>• Keep messages under 1000 characters</p>
                  <p>• Messages are delivered within minutes</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SendMessage;
