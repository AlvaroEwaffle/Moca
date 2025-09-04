import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, MessageCircle, Clock, User, Filter, RefreshCw, Eye } from "lucide-react";
import { Helmet } from "react-helmet";

interface Conversation {
  id: string;
  contactId: string;
  accountId: string;
  status: 'open' | 'closed' | 'archived';
  lastMessage: {
    text: string;
    timestamp: Date;
    sender: 'user' | 'bot';
  };
  contact: {
    name: string;
    username: string;
    profilePicture?: string;
  };
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  agentEnabled?: boolean;
}

const ConversationsList = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  const handleAgentToggle = (conversationId: string, enabled: boolean) => {
    // TODO: Implement API call to toggle agent status
    console.log(`Toggle agent for conversation ${conversationId}: ${enabled}`);
    
    // Update local state for now
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agentEnabled: enabled }
          : conv
      )
    );
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    filterAndSortConversations();
  }, [conversations, searchTerm, statusFilter, sortBy]);

  const fetchConversations = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 Conversations data:', data);
        
        // Transform the data to match our interface
        const transformedConversations = (data.data?.conversations || []).map((conv: any) => ({
          id: conv._id || conv.id,
          contactId: conv.contactId,
          accountId: conv.accountId,
          status: conv.status || 'open',
          lastMessage: {
            text: conv.lastMessage?.text || 'No messages yet',
            timestamp: conv.lastMessage?.timestamp || conv.timestamps?.lastActivity || new Date(),
            sender: conv.lastMessage?.sender || 'user'
          },
          contact: {
            name: conv.contactId?.name || 'Unknown Contact',
            username: conv.contactId?.metadata?.instagramData?.username || conv.contactId?.psid || 'unknown',
            profilePicture: conv.contactId?.profilePicture
          },
          messageCount: conv.messageCount || 0,
          createdAt: conv.createdAt || new Date(),
          updatedAt: conv.updatedAt || conv.timestamps?.lastActivity || new Date(),
          agentEnabled: conv.settings?.aiEnabled !== false // Default to true if not specified
        }));
        
        setConversations(transformedConversations);
      } else {
        console.error('❌ Failed to fetch conversations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortConversations = () => {
    let filtered = [...conversations];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.contact?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.lastMessage?.text?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(conv => conv.status === statusFilter);
    }

    // Sort conversations
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "most_messages":
          return b.messageCount - a.messageCount;
        case "name":
          return (a.contact?.name || '').localeCompare(b.contact?.name || '');
        default:
          return 0;
      }
    });

    setFilteredConversations(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="default" className="bg-green-100 text-green-800">Open</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
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
        <title>Conversations | Moca - Instagram DM Agent</title>
        <meta name="description" content="Manage your Instagram conversations and messages" />
      </Helmet>

      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
            <p className="text-gray-600 mt-1">
              Manage your Instagram conversations ({filteredConversations.length} total)
            </p>
          </div>
          <Button onClick={fetchConversations} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="most_messages">Most Messages</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Conversations List */}
        <div className="space-y-4">
          {filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "Start by connecting your Instagram account"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map((conversation) => (
              <Card 
                key={conversation.id} 
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-violet-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-gray-500 text-sm">
                            @{conversation.contact?.username || 'unknown'}
                          </span>
                          {getStatusBadge(conversation.status)}
                        </div>
                        
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <MessageCircle className="w-3 h-3" />
                          <span>{conversation.messageCount} messages</span>
                          <span className="mx-1">•</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(conversation.lastMessage?.timestamp || conversation.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/app/conversations/${conversation.id}`)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Details</span>
                      </Button>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Agent</span>
                        <Switch
                          checked={conversation.agentEnabled}
                          onCheckedChange={(checked) => handleAgentToggle(conversation.id, checked)}
                        />
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

export default ConversationsList;
