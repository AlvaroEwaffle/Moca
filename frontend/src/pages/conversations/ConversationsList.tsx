import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, MessageCircle, Clock, User, Filter, RefreshCw, Eye, Target, Calendar, Link as LinkIcon, Presentation, CheckCircle, XCircle, Info, LayoutGrid, Key, Send, Loader2, AlertTriangle } from "lucide-react";
import { Helmet } from "react-helmet";
import LeadScoreIndicator from "@/components/LeadScoreIndicator";

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
  leadScoring?: {
    currentScore: number;
    previousScore?: number;
    progression: 'increased' | 'decreased' | 'maintained';
    confidence: number;
  };
  aiResponseMetadata?: {
    lastResponseType: 'structured' | 'fallback';
    lastIntent?: string;
    lastNextAction?: string;
    repetitionDetected: boolean;
    contextAwareness: boolean;
    responseQuality: number;
  };
  analytics?: {
    leadProgression: {
      trend: 'improving' | 'declining' | 'stable';
      averageScore: number;
      peakScore: number;
    };
    repetitionPatterns: string[];
  };
  milestone?: {
    target?: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
    customTarget?: string;
    status: 'pending' | 'achieved' | 'failed';
    achievedAt?: Date;
    notes?: string;
    autoDisableAgent: boolean;
  };
  settings?: {
    aiEnabled?: boolean;
    activatedByKeyword?: boolean;
    activationKeyword?: string;
  };
}

const ConversationsList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  
  // Bulk message state
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [bulkFilters, setBulkFilters] = useState({
    status: 'open' as 'open' | 'closed' | 'archived'
  });
  const [sendResults, setSendResults] = useState<{
    queued: number;
    failed: number;
    estimatedTime: number;
  } | null>(null);
  const [eligibleConversations, setEligibleConversations] = useState<Array<{
    id: string;
    contact: {
      name: string;
      username: string;
      psid: string;
    };
    status: string;
    leadScore: number;
    lastActivity: Date;
  }>>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [loadingConversations, setLoadingConversations] = useState(false);

  const handleAgentToggle = async (conversationId: string, enabled: boolean) => {
    console.log(`🔧 [Frontend] Toggle agent for conversation ${conversationId}: ${enabled}`);
    
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations/${conversationId}/agent`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          enabled: enabled
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Agent status updated successfully');
        // Update local state
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, agentEnabled: enabled }
              : conv
          )
        );
      } else {
        console.error('❌ Failed to update agent status:', data.error);
        // Revert the toggle in UI
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, agentEnabled: !enabled }
              : conv
          )
        );
      }
    } catch (error) {
      console.error('❌ Error updating agent status:', error);
      // Revert the toggle in UI
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, agentEnabled: !enabled }
            : conv
        )
      );
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch eligible count and conversations when modal opens or filters change
  useEffect(() => {
    if (bulkMessageOpen) {
      fetchEligibleCount();
      fetchEligibleConversations();
    } else {
      // Reset when modal closes
      setEligibleConversations([]);
      setSelectedConversationIds(new Set());
    }
  }, [bulkMessageOpen, bulkFilters]);

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
          agentEnabled: conv.settings?.aiEnabled !== false, // Default to true if not specified
          // Add structured AI response fields
          leadScoring: conv.leadScoring ? {
            currentScore: conv.leadScoring.currentScore || 1,
            previousScore: conv.leadScoring.previousScore,
            progression: conv.leadScoring.progression || 'maintained',
            confidence: conv.leadScoring.confidence || 0.5
          } : undefined,
          aiResponseMetadata: conv.aiResponseMetadata ? {
            lastResponseType: conv.aiResponseMetadata.lastResponseType || 'fallback',
            lastIntent: conv.aiResponseMetadata.lastIntent,
            lastNextAction: conv.aiResponseMetadata.lastNextAction,
            repetitionDetected: conv.aiResponseMetadata.repetitionDetected || false,
            contextAwareness: conv.aiResponseMetadata.contextAwareness || false,
            responseQuality: conv.aiResponseMetadata.responseQuality || 0.5
          } : undefined,
          analytics: conv.analytics ? {
            leadProgression: conv.analytics.leadProgression ? {
              trend: conv.analytics.leadProgression.trend || 'stable',
              averageScore: conv.analytics.leadProgression.averageScore || 1,
              peakScore: conv.analytics.leadProgression.peakScore || 1
            } : undefined,
            repetitionPatterns: conv.analytics.repetitionPatterns || []
          } : undefined,
          // Add milestone data
          milestone: conv.milestone ? {
            target: conv.milestone.target,
            customTarget: conv.milestone.customTarget,
            status: conv.milestone.status || 'pending',
            achievedAt: conv.milestone.achievedAt ? new Date(conv.milestone.achievedAt) : undefined,
            notes: conv.milestone.notes,
            autoDisableAgent: conv.milestone.autoDisableAgent ?? true
          } : undefined
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

  const getMilestoneBadge = (milestone: any) => {
    const getMilestoneIcon = () => {
      switch (milestone.target) {
        case 'link_shared':
          return <LinkIcon className="w-3 h-3 mr-1" />;
        case 'meeting_scheduled':
          return <Calendar className="w-3 h-3 mr-1" />;
        case 'demo_booked':
          return <Presentation className="w-3 h-3 mr-1" />;
        case 'custom':
          return <Target className="w-3 h-3 mr-1" />;
        default:
          return <Target className="w-3 h-3 mr-1" />;
      }
    };

    const getMilestoneText = () => {
      if (milestone.target === 'custom' && milestone.customTarget) {
        return milestone.customTarget;
      }
      if (milestone.target) {
        return milestone.target.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      return 'Milestone';
    };

    const getBadgeVariant = () => {
      switch (milestone.status) {
        case 'achieved':
          return 'default';
        case 'pending':
          return 'outline';
        case 'failed':
          return 'destructive';
        default:
          return 'outline';
      }
    };

    const getBadgeColor = () => {
      switch (milestone.status) {
        case 'achieved':
          return 'bg-green-100 text-green-800';
        case 'pending':
          return 'bg-yellow-100 text-yellow-800';
        case 'failed':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <Badge variant={getBadgeVariant()} className={getBadgeColor()}>
        {getMilestoneIcon()}
        {getMilestoneText()}
        {milestone.status === 'achieved' && <CheckCircle className="w-3 h-3 ml-1" />}
      </Badge>
    );
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

  // Bulk message functions
  const fetchEligibleCount = async () => {
    setLoadingCount(true);
    try {
      const backendUrl = BACKEND_URL;
      const params = new URLSearchParams({
        status: bulkFilters.status || 'open'
      });
      
      const response = await fetch(`${backendUrl}/api/instagram/conversations/bulk-message/eligible-count?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEligibleCount(data.data?.count || 0);
      } else {
        console.error('Failed to fetch eligible count');
        setEligibleCount(0);
      }
    } catch (error) {
      console.error('Error fetching eligible count:', error);
      setEligibleCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  const fetchEligibleConversations = async () => {
    setLoadingConversations(true);
    try {
      const backendUrl = BACKEND_URL;
      const params = new URLSearchParams({
        status: bulkFilters.status || 'open'
      });
      
      const response = await fetch(`${backendUrl}/api/instagram/conversations/bulk-message/eligible-list?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const conversations = data.data?.conversations || [];
        setEligibleConversations(conversations);
        // Select all by default
        setSelectedConversationIds(new Set(conversations.map((c: any) => c.id)));
      } else {
        console.error('Failed to fetch eligible conversations');
        setEligibleConversations([]);
        setSelectedConversationIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching eligible conversations:', error);
      setEligibleConversations([]);
      setSelectedConversationIds(new Set());
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleToggleConversation = (conversationId: string) => {
    setSelectedConversationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedConversationIds.size === eligibleConversations.length) {
      // Deselect all
      setSelectedConversationIds(new Set());
    } else {
      // Select all
      setSelectedConversationIds(new Set(eligibleConversations.map(c => c.id)));
    }
  };

  const handleSendBulkMessage = async () => {
    if (!messageText.trim()) {
      toast({
        title: "Error",
        description: "Message text cannot be empty",
        variant: "destructive"
      });
      return;
    }

    if (messageText.length > 1000) {
      toast({
        title: "Error",
        description: "Message text cannot exceed 1000 characters",
        variant: "destructive"
      });
      return;
    }

    if (selectedConversationIds.size === 0) {
      toast({
        title: "No recipients selected",
        description: "Please select at least one conversation to send the message to",
        variant: "destructive"
      });
      return;
    }

    // Confirm before sending
    const confirmed = window.confirm(
      `Are you sure you want to send this message to ${selectedConversationIds.size} conversation${selectedConversationIds.size !== 1 ? 's' : ''}?\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setSending(true);
    setSendResults(null);

    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations/bulk-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          messageText: messageText.trim(),
          filters: {
            status: bulkFilters.status,
            conversationIds: Array.from(selectedConversationIds) // Send only selected conversations
          },
          options: {
            priority: 'normal'
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSendResults({
          queued: data.data.messagesQueued || 0,
          failed: (data.data.totalTargeted || 0) - (data.data.messagesQueued || 0),
          estimatedTime: data.data.estimatedTimeToComplete || 0
        });

        toast({
          title: "Success",
          description: `Successfully queued ${data.data.messagesQueued} message${data.data.messagesQueued !== 1 ? 's' : ''}. Messages will be sent automatically.`,
        });

        // Reset form and close after 3 seconds
        setTimeout(() => {
          setMessageText("");
          setBulkMessageOpen(false);
          setSendResults(null);
          fetchConversations(); // Refresh conversations
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to send bulk message');
      }
    } catch (error: any) {
      console.error('Error sending bulk message:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to send bulk message',
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenBulkMessage = () => {
    setBulkMessageOpen(true);
    setMessageText("");
    setSendResults(null);
    setBulkFilters({ status: 'open' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Helmet>
        <title>Conversations | Moca - Instagram DM Agent</title>
        <meta name="description" content="Manage your Instagram conversations and messages" />
      </Helmet>

      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">📊 7-Step Lead Scoring Scale:</p>
                    <div className="text-xs space-y-1">
                      <div>1. <strong>Contact Received</strong> - Initial contact from customer</div>
                      <div>2. <strong>Answers 1 Question</strong> - Customer responds to first question</div>
                      <div>3. <strong>Confirms Interest</strong> - Customer shows interest in service/product</div>
                      <div>4. <strong>Milestone Met</strong> - Specific business milestone achieved</div>
                      <div>5. <strong>Reminder Sent</strong> - Follow-up reminder sent to customer</div>
                      <div>6. <strong>Reminder Answered</strong> - Customer responds to follow-up</div>
                      <div>7. <strong>Sales Done</strong> - Sale completed or deal closed</div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-gray-600 mt-1">
              Manage your Instagram conversations ({filteredConversations.length} total)
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenBulkMessage} variant="default" size="sm" className="bg-violet-600 hover:bg-violet-700">
              <Send className="w-4 h-4 mr-2" />
              Bulk Message
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/conversations-kanban">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Kanban View
              </Link>
            </Button>
            <Button onClick={fetchConversations} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
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
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {/* Header Section */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-gray-500 text-sm font-medium">
                              @{conversation.contact?.username || 'unknown'}
                            </span>
                            {getStatusBadge(conversation.status)}
                            {conversation.milestone && getMilestoneBadge(conversation.milestone)}
                            {conversation.settings?.activatedByKeyword && conversation.settings?.activationKeyword && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Key className="w-3 h-3" />
                                Activated: {conversation.settings.activationKeyword.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Lead Score and Meta Information */}
                          {conversation.leadScoring?.currentScore && (
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs text-gray-500">🎯</span>
                              <span className="text-sm font-medium text-gray-900">
                                {conversation.leadScoring.currentScore}/7 Lead Score
                              </span>
                              {conversation.leadScoring?.confidence && (
                                <span className="text-xs text-gray-500">
                                  ({Math.round(conversation.leadScoring.confidence * 100)}% confidence)
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                            <MessageCircle className="w-3 h-3 flex-shrink-0" />
                            <span>{conversation.messageCount} messages</span>
                            <span>•</span>
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>{formatTimeAgo(conversation.lastMessage?.timestamp || conversation.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Actions Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* AI Status and Trend - Left side on mobile, right on desktop */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {conversation.aiResponseMetadata && (
                          <div className="flex items-center gap-1">
                            <span>🤖</span>
                            <span>AI: {conversation.aiResponseMetadata.lastResponseType}</span>
                            {conversation.aiResponseMetadata.repetitionDetected && <span>⚠️</span>}
                            {conversation.aiResponseMetadata.contextAwareness && <span>🧠</span>}
                          </div>
                        )}
                        {conversation.analytics?.leadProgression && (
                          <div className="flex items-center gap-1">
                            <span>📈</span>
                            <span>
                              {conversation.analytics.leadProgression.trend === 'improving' ? 'Trending up' :
                               conversation.analytics.leadProgression.trend === 'declining' ? 'Trending down' : 'Stable'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Agent Toggle and Details Button - Right side */}
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Agent</span>
                          <Switch
                            checked={conversation.agentEnabled}
                            onCheckedChange={(checked) => handleAgentToggle(conversation.id, checked)}
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/conversations/${conversation.id}`)}
                          className="flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">Details</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Bulk Message Modal */}
      <Dialog open={bulkMessageOpen} onOpenChange={setBulkMessageOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Bulk Message</DialogTitle>
            <DialogDescription>
              Send a message to all conversations where the agent is active
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Message Input */}
            <div className="space-y-2">
              <Label htmlFor="messageText">Message</Label>
              <Textarea
                id="messageText"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your message here..."
                rows={6}
                className="resize-none"
                maxLength={1000}
              />
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Characters: {messageText.length} / 1000</span>
                {messageText.length > 800 && (
                  <span className="text-amber-600">Approaching character limit</span>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <Label>Filters</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="statusFilter" className="text-sm font-normal w-24">Status:</Label>
                  <Select
                    value={bulkFilters.status}
                    onValueChange={(value: 'open' | 'closed' | 'archived') =>
                      setBulkFilters({ ...bulkFilters, status: value })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open only</SelectItem>
                      <SelectItem value="closed">Closed only</SelectItem>
                      <SelectItem value="archived">Archived only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Eligible Count Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              {loadingCount ? (
                <div className="flex items-center gap-2 text-blue-800">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calculating eligible conversations...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-800">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-semibold">
                      <strong>{selectedConversationIds.size}</strong> of <strong>{eligibleCount}</strong> conversation{eligibleCount !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Only conversations with active agent ({bulkFilters.status} status) will receive this message.
                  </p>
                  {eligibleCount === 0 && (
                    <p className="text-sm text-amber-700 font-medium mt-2">
                      ⚠️ No eligible conversations found. Make sure you have conversations with active agent in the selected status.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Conversations List with Checkboxes */}
            {eligibleCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Conversations</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-sm text-violet-600 hover:text-violet-700"
                  >
                    {selectedConversationIds.size === eligibleConversations.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                      <span className="ml-2 text-sm text-gray-600">Loading conversations...</span>
                    </div>
                  ) : eligibleConversations.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-500">
                      No conversations found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {eligibleConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleToggleConversation(conv.id)}
                        >
                          <Checkbox
                            checked={selectedConversationIds.has(conv.id)}
                            onCheckedChange={() => handleToggleConversation(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                @{conv.contact.username}
                              </span>
                              {conv.contact.name && conv.contact.name !== conv.contact.username && (
                                <span className="text-xs text-gray-500">
                                  ({conv.contact.name})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                Score: {conv.leadScore}/7
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(conv.lastActivity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results */}
            {sendResults && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Messages Queued Successfully</span>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✅ Successfully queued: <strong>{sendResults.queued}</strong> message{sendResults.queued !== 1 ? 's' : ''}</p>
                    {sendResults.failed > 0 && (
                      <p className="text-amber-700">⚠️ Failed: {sendResults.failed} message{sendResults.failed !== 1 ? 's' : ''}</p>
                    )}
                    <p>⏱️ Estimated time to complete: <strong>{sendResults.estimatedTime}</strong> second{sendResults.estimatedTime !== 1 ? 's' : ''}</p>
                    <p className="mt-2 text-xs">Messages will be sent automatically by the system, respecting rate limits.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            {eligibleCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">Important:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>This action cannot be undone</li>
                      <li>Messages will be sent automatically and respect rate limits</li>
                      <li>Only conversations with active agent will receive the message</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkMessageOpen(false);
                setMessageText("");
                setSendResults(null);
              }}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendBulkMessage}
              disabled={sending || !messageText.trim() || selectedConversationIds.size === 0 || loadingCount || loadingConversations}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedConversationIds.size} Conversation{selectedConversationIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default ConversationsList;
