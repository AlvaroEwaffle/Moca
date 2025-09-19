import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, MessageCircle, Clock, User, Filter, RefreshCw, Eye, Target, Calendar, Link as LinkIcon, Presentation, CheckCircle, XCircle, Info, Bot, BotOff, Calendar as CalendarIcon, List } from "lucide-react";
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

interface KanbanColumn {
  id: string;
  title: string;
  description: string;
  scoreRange: [number, number];
  color: string;
  conversations: Conversation[];
}

const ConversationsKanban = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  // Define Kanban columns based on lead score
  const kanbanColumns: Omit<KanbanColumn, 'conversations'>[] = [
    {
      id: 'contact-received',
      title: 'Contact Received',
      description: 'Initial contact from customer',
      scoreRange: [1, 1],
      color: 'bg-gray-100 border-gray-300'
    },
    {
      id: 'answers-question',
      title: 'Answers 1 Question',
      description: 'Customer responds to first question',
      scoreRange: [2, 2],
      color: 'bg-blue-100 border-blue-300'
    },
    {
      id: 'confirms-interest',
      title: 'Confirms Interest',
      description: 'Customer shows clear interest',
      scoreRange: [3, 3],
      color: 'bg-yellow-100 border-yellow-300'
    },
    {
      id: 'milestone-met',
      title: 'Milestone Met',
      description: 'Specific milestone achieved',
      scoreRange: [4, 4],
      color: 'bg-orange-100 border-orange-300'
    },
    {
      id: 'reminder-sent',
      title: 'Reminder Sent',
      description: 'Follow-up reminder sent',
      scoreRange: [5, 5],
      color: 'bg-purple-100 border-purple-300'
    },
    {
      id: 'reminder-answered',
      title: 'Reminder Answered',
      description: 'Customer responds to reminder',
      scoreRange: [6, 6],
      color: 'bg-indigo-100 border-indigo-300'
    },
    {
      id: 'sales-done',
      title: 'Sales Done',
      description: 'Sale completed successfully',
      scoreRange: [7, 7],
      color: 'bg-green-100 border-green-300'
    }
  ];

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

  const filterConversations = (conversations: Conversation[]) => {
    let filtered = [...conversations];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.contact?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.lastMessage?.text?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(conv => new Date(conv.updatedAt) >= filterDate);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(conv => new Date(conv.updatedAt) >= filterDate);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(conv => new Date(conv.updatedAt) >= filterDate);
          break;
      }
    }

    // Filter by agent status
    if (agentFilter !== "all") {
      filtered = filtered.filter(conv => {
        if (agentFilter === "enabled") return conv.agentEnabled === true;
        if (agentFilter === "disabled") return conv.agentEnabled === false;
        return true;
      });
    }

    return filtered;
  };

  const getFilteredColumns = (): KanbanColumn[] => {
    const filteredConversations = filterConversations(conversations);
    
    return kanbanColumns.map(column => ({
      ...column,
      conversations: filteredConversations.filter(conv => {
        const score = conv.leadScoring?.currentScore || 1;
        return score >= column.scoreRange[0] && score <= column.scoreRange[1];
      })
    }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  const columns = getFilteredColumns();
  const totalConversations = columns.reduce((sum, col) => sum + col.conversations.length, 0);

  return (
    <TooltipProvider>
      <Helmet>
        <title>Conversations Kanban | Moca - Instagram DM Agent</title>
        <meta name="description" content="Manage your Instagram conversations with a Kanban board view" />
      </Helmet>

      <div className="space-y-6 p-6 max-w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">Conversations Kanban</h1>
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
              Organize conversations by lead score ({totalConversations} total)
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/conversations">
                <List className="w-4 h-4 mr-2" />
                List View
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
              
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="AI Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="flex gap-6 overflow-x-auto px-2 pb-4">
          {columns.map((column) => (
            <div key={column.id} className="w-80 flex-shrink-0">
              <Card className={`${column.color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-800">
                    {column.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-600">
                    {column.description}
                  </CardDescription>
                  <Badge variant="outline" className="w-fit text-xs">
                    {column.conversations.length} conversations
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0 px-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto py-2">
                    {column.conversations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No conversations
                      </div>
                    ) : (
                      column.conversations.map((conversation) => (
                        <Card 
                          key={conversation.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer bg-white mx-1"
                          onClick={() => navigate(`/app/conversations/${conversation.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-2 flex-1 min-w-0">
                                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-violet-600" />
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1 mb-1">
                                      <span className="text-gray-500 text-xs font-medium">
                                        @{conversation.contact?.username || 'unknown'}
                                      </span>
                                      {getStatusBadge(conversation.status)}
                                    </div>
                                    
                                    {/* Lead Score */}
                                    {conversation.leadScoring?.currentScore && (
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="text-xs text-gray-500">🎯</span>
                                        <span className="text-xs font-medium text-gray-900">
                                          {conversation.leadScoring.currentScore}/7
                                        </span>
                                        {conversation.leadScoring?.confidence && (
                                          <span className="text-xs text-gray-500">
                                            ({Math.round(conversation.leadScoring.confidence * 100)}%)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <MessageCircle className="w-3 h-3 flex-shrink-0" />
                                      <span>{conversation.messageCount}</span>
                                      <span>•</span>
                                      <Clock className="w-3 h-3 flex-shrink-0" />
                                      <span>{formatTimeAgo(conversation.lastMessage?.timestamp || conversation.updatedAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Last Message Preview */}
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                {truncateText(conversation.lastMessage?.text || 'No messages yet', 60)}
                              </div>

                              {/* Milestone */}
                              {conversation.milestone && (
                                <div className="flex justify-center">
                                  {getMilestoneBadge(conversation.milestone)}
                                </div>
                              )}

                              {/* AI Status and Actions */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  {conversation.agentEnabled ? (
                                    <Bot className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <BotOff className="w-3 h-3 text-gray-400" />
                                  )}
                                  <span>{conversation.agentEnabled ? 'AI On' : 'AI Off'}</span>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/app/conversations/${conversation.id}`);
                                  }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ConversationsKanban;
