import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, MessageCircle, Clock, User, Filter, RefreshCw, Eye, Target, Calendar, Link, Presentation, CheckCircle, XCircle } from "lucide-react";
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
}

const ConversationsList = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

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
          return <Link className="w-3 h-3 mr-1" />;
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
      return milestone.target?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Milestone';
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
                          {conversation.milestone && getMilestoneBadge(conversation.milestone)}
                        </div>
                        
                        {/* Lead Score Indicator */}
                        {conversation.leadScoring && (
                          <div className="mb-2">
                            <LeadScoreIndicator
                              score={conversation.leadScoring.currentScore}
                              progression={conversation.leadScoring.progression}
                              confidence={conversation.leadScoring.confidence}
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <MessageCircle className="w-3 h-3" />
                          <span>{conversation.messageCount} messages</span>
                          <span className="mx-1">•</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(conversation.lastMessage?.timestamp || conversation.updatedAt)}</span>
                        </div>
                        
                        {/* Lead Status and Meta Information */}
                        <div className="mt-2 space-y-2">
                          {/* Lead Status Row */}
                          {conversation.leadScoring && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Lead Status:</span>
                                <Badge 
                                  variant={
                                    conversation.leadScoring.currentScore >= 7 ? 'default' :
                                    conversation.leadScoring.currentScore >= 4 ? 'secondary' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {conversation.leadScoring.currentScore}/10
                                </Badge>
                                <span className="text-xs text-gray-400">
                                  {conversation.leadScoring.progression === 'increased' ? '↗️' :
                                   conversation.leadScoring.progression === 'decreased' ? '↘️' : '➡️'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {Math.round(conversation.leadScoring.confidence * 100)}% confidence
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Max Score */}
                          {conversation.analytics?.leadProgression?.peakScore && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Max Score:</span>
                              <Badge 
                                variant="outline"
                                className="text-xs"
                              >
                                {conversation.analytics.leadProgression.peakScore}/10
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-3">
                      {/* Quick Status Summary */}
                      <div className="text-right space-y-1">
                        {conversation.leadScoring && (
                          <div className="text-xs text-gray-500">
                            Lead: {conversation.leadScoring.currentScore}/10
                            {conversation.leadScoring.progression === 'increased' ? ' ↗️' :
                             conversation.leadScoring.progression === 'decreased' ? ' ↘️' : ' ➡️'}
                          </div>
                        )}
                        {conversation.aiResponseMetadata && (
                          <div className="text-xs text-gray-500">
                            AI: {conversation.aiResponseMetadata.lastResponseType}
                            {conversation.aiResponseMetadata.repetitionDetected && ' ⚠️'}
                            {conversation.aiResponseMetadata.contextAwareness && ' 🧠'}
                          </div>
                        )}
                        {conversation.analytics?.leadProgression && (
                          <div className="text-xs text-gray-500">
                            Trend: {conversation.analytics.leadProgression.trend === 'improving' ? '📈' :
                                   conversation.analytics.leadProgression.trend === 'declining' ? '📉' : '➡️'}
                          </div>
                        )}
                      </div>

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
