import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Archive, 
  Trash2, 
  MessageCircle, 
  User, 
  Bot, 
  TrendingUp,
  ArrowRight,
  Target,
  Calendar,
  Link,
  Presentation,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Conversation {
  _id: string;
  contact?: {
    name?: string;
    username?: string;
    psid?: string;
    metadata?: any;
  };
  status: string;
  messageCount: number;
  messages: Message[];
  timestamps?: {
    createdAt?: Date;
    lastUserMessage?: Date;
    lastActivity?: Date;
  };
  leadScoring?: {
    currentScore: number;
    previousScore: number;
    progression: string;
    confidence: number;
  };
  aiResponseMetadata?: {
    lastResponseType: string;
    lastIntent: string;
    lastNextAction: string;
    repetitionDetected: boolean;
    contextAwareness: boolean;
    responseQuality: number;
  };
  metrics?: {
    userMessages: number;
    botMessages: number;
  };
  analytics?: any;
  milestone?: {
    target?: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
    customTarget?: string;
    status: 'pending' | 'achieved' | 'failed';
    achievedAt?: Date;
    notes?: string;
    autoDisableAgent: boolean;
  };
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  createdAt: Date;
  status: string;
  metadata?: any;
}

const ConversationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Milestone management state
  const [editingMilestone, setEditingMilestone] = useState(false);
  const [milestoneTarget, setMilestoneTarget] = useState<'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom'>('link_shared');
  const [customMilestoneTarget, setCustomMilestoneTarget] = useState<string>("");
  const [autoDisableAgent, setAutoDisableAgent] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchConversation();
    }
  }, [id]);

  const fetchConversation = async () => {
    try {
      setError(null);
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const conversationData = data.data?.conversation;
        const messages = data.data?.messages || [];

        // Validate that we have the required data
        if (!conversationData) {
          throw new Error('No conversation data received');
        }
        
        // Transform the conversation data to match our interface
        const transformedConversation = {
          ...conversationData,
          // Map contact information correctly with safe access
          contact: {
            name: conversationData?.contactId?.metadata?.instagramData?.username || 'Unknown Contact',
            username: conversationData?.contactId?.metadata?.instagramData?.username || 'unknown',
            psid: conversationData?.contactId?.psid || '',
            metadata: conversationData?.contactId?.metadata || {}
          },
          messages: messages.map((msg: any) => ({
            id: msg._id || msg.id,
            text: msg.text || msg.content?.text || '',
            sender: msg.role === 'assistant' ? 'bot' : (msg.role === 'user' ? 'user' : (msg.isFromBot ? 'bot' : 'user')),
            timestamp: msg.metadata?.timestamp || msg.createdAt || new Date(),
            createdAt: msg.createdAt || new Date(),
            status: msg.status || 'sent',
            metadata: msg.metadata
          })),
          // Add structured AI response fields
          leadScoring: conversationData?.leadScoring ? {
            currentScore: conversationData.analytics?.leadProgression?.peakScore || 1,
            previousScore: conversationData.leadScoring.previousScore,
            progression: conversationData.leadScoring.progression || 'maintained',
            confidence: conversationData.leadScoring.confidence || 0.5
          } : undefined,
          aiResponseMetadata: conversationData?.aiResponseMetadata ? {
            lastResponseType: conversationData.aiResponseMetadata.lastResponseType || 'fallback',
            lastIntent: conversationData.aiResponseMetadata.lastIntent,
            lastNextAction: conversationData.aiResponseMetadata.lastNextAction,
            repetitionDetected: conversationData.aiResponseMetadata.repetitionDetected || false,
            contextAwareness: conversationData.aiResponseMetadata.contextAwareness || false,
            responseQuality: conversationData.aiResponseMetadata.responseQuality || 0.5
          } : undefined,
          analytics: conversationData?.analytics ? {
            leadProgression: conversationData.analytics.leadProgression ? {
              trend: conversationData.analytics.leadProgression.trend || 'stable',
              averageScore: conversationData.analytics.leadProgression.averageScore || 1,
              peakScore: conversationData.analytics.leadProgression.peakScore || 1,
              progressionRate: conversationData.analytics.leadProgression.progressionRate || 0
            } : undefined,
            repetitionPatterns: conversationData.analytics.repetitionPatterns || [],
            conversationFlow: conversationData.analytics.conversationFlow ? {
              totalTurns: conversationData.analytics.conversationFlow.totalTurns || 0,
              averageTurnLength: conversationData.analytics.conversationFlow.averageTurnLength || 0,
              questionCount: conversationData.analytics.conversationFlow.questionCount || 0,
              responseCount: conversationData.analytics.conversationFlow.responseCount || 0
            } : undefined
          } : undefined,
          // Add timestamps with safe access
          timestamps: {
            createdAt: conversationData?.timestamps?.createdAt ? new Date(conversationData.timestamps.createdAt) : new Date(),
            lastUserMessage: conversationData?.timestamps?.lastUserMessage ? new Date(conversationData.timestamps.lastUserMessage) : new Date(),
            lastActivity: conversationData?.timestamps?.lastActivity ? new Date(conversationData.timestamps.lastActivity) : new Date()
          },
          // Add milestone data
          milestone: conversationData?.milestone ? {
            target: conversationData.milestone.target,
            customTarget: conversationData.milestone.customTarget,
            status: conversationData.milestone.status || 'pending',
            achievedAt: conversationData.milestone.achievedAt ? new Date(conversationData.milestone.achievedAt) : undefined,
            notes: conversationData.milestone.notes,
            autoDisableAgent: conversationData.milestone.autoDisableAgent ?? true
          } : undefined
        };

        setConversation(transformedConversation);
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to fetch conversation: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Milestone management functions
  const startEditingMilestone = () => {
    if (conversation?.milestone) {
      setMilestoneTarget(conversation.milestone.target || 'link_shared');
      setCustomMilestoneTarget(conversation.milestone.customTarget || "");
      setAutoDisableAgent(conversation.milestone.autoDisableAgent);
    }
    setEditingMilestone(true);
  };

  const cancelEditingMilestone = () => {
    setEditingMilestone(false);
    setMilestoneTarget('link_shared');
    setCustomMilestoneTarget("");
    setAutoDisableAgent(true);
  };

  const saveMilestone = async () => {
    if (!conversation) return;
    
    setSaving(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations/${conversation._id}/milestone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          target: milestoneTarget,
          customTarget: milestoneTarget === 'custom' ? customMilestoneTarget : undefined,
          autoDisableAgent: autoDisableAgent
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConversation({
          ...conversation,
          milestone: data.data.milestone
        });
        setEditingMilestone(false);
      } else {
        const errorData = await response.json();
        console.error('Error saving milestone:', errorData.error);
      }
    } catch (error) {
      console.error('Error saving milestone:', error);
    } finally {
      setSaving(false);
    }
  };

  const markMilestoneAchieved = async () => {
    if (!conversation) return;
    
    setSaving(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/conversations/${conversation._id}/milestone/achieve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          notes: 'Manually marked as achieved'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConversation({
          ...conversation,
          milestone: data.data.milestone
        });
      } else {
        const errorData = await response.json();
        console.error('Error achieving milestone:', errorData.error);
      }
    } catch (error) {
      console.error('Error achieving milestone:', error);
    } finally {
      setSaving(false);
    }
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

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString();
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

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading conversation</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => navigate('/app/conversations')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Conversations
        </Button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Conversation not found</h2>
        <p className="text-gray-600 mb-4">The conversation you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/app/conversations')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Conversations
        </Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{conversation.contact?.name || conversation.contact?.username || 'Unknown Contact'} | Moca - Instagram DM Agent</title>
        <meta name="description" content={`Conversation with ${conversation.contact?.name || conversation.contact?.username || 'Unknown Contact'}`} />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Simplified Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/app/conversations')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  {conversation.contact?.name || conversation.contact?.username || 'Unknown Contact'}
              </h1>
                {getStatusBadge(conversation.status)}
              </div>
              <p className="text-sm sm:text-base text-gray-600 break-words">
                @{conversation.contact?.username || 'unknown'} • Last contact: {formatTimeAgo(conversation.timestamps?.lastUserMessage || conversation.timestamps?.lastActivity || new Date())}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 flex-1 sm:flex-none">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Status Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className="text-2xl font-bold text-gray-900">{conversation.status}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Score Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Lead Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {conversation.leadScoring?.currentScore || 1}/7
                  </p>
                  <p className="text-xs text-gray-500">
                    {conversation.leadScoring?.confidence ? `${Math.round(conversation.leadScoring.confidence * 100)}% confidence` : ''}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{conversation.messageCount || 0}</p>
                  <p className="text-xs text-gray-500">
                    {conversation.metrics?.userMessages || 0} user • {conversation.metrics?.botMessages || 0} bot
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Action Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-gray-600 mb-1">Next Action</p>
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {conversation.aiResponseMetadata?.lastNextAction || 'Continue conversation'}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestone Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Conversation Milestone</span>
              {conversation.milestone?.status === 'achieved' && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Achieved
                </Badge>
              )}
              {conversation.milestone?.status === 'pending' && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingMilestone ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milestone Target</label>
                  <select
                    value={milestoneTarget}
                    onChange={(e) => setMilestoneTarget(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    <option value="link_shared">Link Shared</option>
                    <option value="meeting_scheduled">Meeting Scheduled</option>
                    <option value="demo_booked">Demo Booked</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {milestoneTarget === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Milestone Description</label>
                    <input
                      type="text"
                      value={customMilestoneTarget}
                      onChange={(e) => setCustomMilestoneTarget(e.target.value)}
                      placeholder="e.g., 'Price quote requested'"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                  <label htmlFor="autoDisableAgent" className="text-sm text-gray-700">
                    Auto-disable agent when milestone is achieved
                  </label>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    onClick={saveMilestone}
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Target className="w-4 h-4 mr-2" />
                    )}
                    Save Milestone
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={cancelEditingMilestone}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {conversation.milestone ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      {conversation.milestone.target === 'link_shared' && <Link className="w-5 h-5 text-violet-600" />}
                      {conversation.milestone.target === 'meeting_scheduled' && <Calendar className="w-5 h-5 text-violet-600" />}
                      {conversation.milestone.target === 'demo_booked' && <Presentation className="w-5 h-5 text-violet-600" />}
                      {conversation.milestone.target === 'custom' && <Target className="w-5 h-5 text-violet-600" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {conversation.milestone.target === 'custom' 
                            ? conversation.milestone.customTarget 
                            : conversation.milestone.target 
                              ? conversation.milestone.target.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                              : 'Milestone'
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          Status: {conversation.milestone.status}
                          {conversation.milestone.achievedAt && (
                            <span> • Achieved: {formatTime(conversation.milestone.achievedAt)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {conversation.milestone.notes && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700">{conversation.milestone.notes}</p>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={startEditingMilestone}
                        size="sm"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Edit Milestone
                      </Button>
                      {conversation.milestone.status === 'pending' && (
                        <Button 
                          onClick={markMilestoneAchieved}
                          disabled={saving}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Mark Achieved
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No milestone set for this conversation</p>
                    <Button onClick={startEditingMilestone} size="sm">
                      <Target className="w-4 h-4 mr-2" />
                      Set Milestone
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List - Bigger Chat */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5" />
                <span>Messages</span>
                <Badge variant="outline">{conversation.messages?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[600px] overflow-hidden">
              <div className="h-full overflow-y-auto p-6 space-y-4">
                {(!conversation.messages || conversation.messages.length === 0) ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No messages yet</p>
                </div>
              ) : (
                  conversation.messages
                    .sort((a, b) => {
                      // Use createdAt for sorting as it's more reliable than timestamp
                      // The timestamp field has corrupted dates for user messages
                      const timeA = new Date(a.createdAt || a.metadata?.timestamp || 0).getTime();
                      const timeB = new Date(b.createdAt || b.metadata?.timestamp || 0).getTime();
                      return timeB - timeA; // Most recent first
                    })
                    .map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        message.sender === 'user'
                            ? 'bg-violet-600 text-white ml-auto'
                            : 'bg-gray-100 text-gray-900 mr-auto'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.sender === 'bot' && (
                            <Bot className="w-4 h-4 mt-0.5 text-violet-600 flex-shrink-0" />
                        )}
                        {message.sender === 'user' && (
                            <User className="w-4 h-4 mt-0.5 text-white flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed break-words">{message.text}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-xs ${message.sender === 'user' ? 'text-violet-100' : 'text-gray-500'}`}>
                              {formatTimeAgo(message.timestamp)}
                            </span>
                            {message.sender === 'user' && (
                                <span className="text-xs text-violet-100">
                                {message.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

          {/* Enhanced Contact Info with AI Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Contact & AI Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Contact Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Username</p>
                  <p className="text-lg font-semibold">@{conversation.contact?.username || 'unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">First Contact</p>
                  <p className="text-sm">{formatTime(conversation.timestamps?.createdAt || new Date())}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Activity</p>
                  <p className="text-sm">{formatTime(conversation.timestamps?.lastActivity || new Date())}</p>
                </div>
              </div>

              {/* AI Response Quality Indicators */}
              {conversation.aiResponseMetadata && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">AI Response Quality</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Response Type</span>
                      <Badge 
                        variant={conversation.aiResponseMetadata.lastResponseType === 'structured' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {conversation.aiResponseMetadata.lastResponseType}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Intent</span>
                      <Badge variant="outline" className="text-xs">
                        {conversation.aiResponseMetadata.lastIntent || 'unknown'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Context Aware</span>
                      <div className={`w-3 h-3 rounded-full ${conversation.aiResponseMetadata.contextAwareness ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Repetition Detected</span>
                      <div className={`w-3 h-3 rounded-full ${conversation.aiResponseMetadata.repetitionDetected ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Response Quality</span>
                      <span className="text-sm font-medium">
                        {Math.round((conversation.aiResponseMetadata.responseQuality || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lead Scoring Details */}
              {conversation.leadScoring && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Lead Scoring Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Current Score</span>
                      <span className="text-sm font-bold">{conversation.leadScoring.currentScore || 1}/7</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Previous Score</span>
                      <span className="text-sm font-medium">{conversation.leadScoring.previousScore || 'N/A'}/7</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Progression</span>
                      <Badge 
                        variant={
                          conversation.leadScoring.progression === 'increased' ? 'default' :
                          conversation.leadScoring.progression === 'decreased' ? 'destructive' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {conversation.leadScoring.progression || 'maintained'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Confidence</span>
                      <span className="text-sm font-medium">
                        {Math.round((conversation.leadScoring.confidence || 0) * 100)}%
                      </span>
                    </div>

                    {/* Step Information */}
                    {conversation.leadScoring.currentStep && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Current Step</span>
                          <span className="text-sm font-bold text-violet-600">
                            {conversation.leadScoring.currentStep.stepNumber || conversation.leadScoring.currentScore || 1}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">
                          {conversation.leadScoring.currentStep.stepName || 'Contact Received'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {conversation.leadScoring.currentStep.stepDescription || 'Initial contact from customer'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analytics Summary */}
              {conversation.analytics && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Analytics Summary</h4>
                  <div className="space-y-3">
                    {conversation.analytics.leadProgression && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Lead Trend</span>
                        <Badge 
                          variant={
                            conversation.analytics.leadProgression.trend === 'improving' ? 'default' :
                            conversation.analytics.leadProgression.trend === 'declining' ? 'destructive' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {conversation.analytics.leadProgression.trend}
                        </Badge>
                      </div>
                    )}

                    {conversation.analytics.leadProgression && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Average Score</span>
                        <span className="text-sm font-medium">
                          {conversation.analytics.leadProgression.averageScore?.toFixed(1) || 'N/A'}/7
                        </span>
                      </div>
                    )}

                    {conversation.analytics.leadProgression && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Peak Score</span>
                        <span className="text-sm font-medium">
                          {conversation.analytics.leadProgression.peakScore || 'N/A'}/7
                        </span>
                      </div>
                    )}

                    {conversation.analytics.conversationFlow && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Turns</span>
                        <span className="text-sm font-medium">
                          {conversation.analytics.conversationFlow.totalTurns || 0}
                        </span>
                      </div>
                    )}
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ConversationDetail;