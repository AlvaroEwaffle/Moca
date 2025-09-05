import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, User, Bot, Clock, MessageCircle, Archive, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet";
import LeadScoreIndicator from "@/components/LeadScoreIndicator";
import ConversationAnalytics from "@/components/ConversationAnalytics";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    messageId?: string;
    attachments?: any[];
  };
}

interface Conversation {
  id: string;
  contactId: string;
  accountId: string;
  status: 'open' | 'closed' | 'archived';
  contact: {
    name?: string;
    username?: string;
    profilePicture?: string;
  };
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
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
    businessNameUsed?: string;
    responseQuality: number;
  };
  analytics?: {
    leadProgression: {
      trend: 'improving' | 'declining' | 'stable';
      averageScore: number;
      peakScore: number;
      progressionRate: number;
    };
    repetitionPatterns: string[];
    conversationFlow: {
      totalTurns: number;
      averageTurnLength: number;
      questionCount: number;
      responseCount: number;
    };
  };
}

const ConversationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (id) {
      fetchConversation();
    }
  }, [id]);

  const fetchConversation = async () => {
    try {
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
        
        // Transform the conversation data to match our interface
        const transformedConversation = {
          ...conversationData,
          messages: messages.map((msg: any) => ({
            id: msg._id || msg.id,
            text: msg.text || msg.content?.text || '',
            sender: msg.sender || (msg.isFromBot ? 'bot' : 'user'),
            timestamp: msg.metadata?.timestamp || msg.createdAt || new Date(),
            status: msg.status || 'sent',
            metadata: msg.metadata
          })),
          // Add structured AI response fields
          leadScoring: conversationData?.leadScoring ? {
            currentScore: conversationData.leadScoring.currentScore || 1,
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
          } : undefined
        };
        
        setConversation(transformedConversation);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation) return;

    setSending(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          contactId: conversation.contactId,
          accountId: conversation.accountId,
          content: {
            text: newMessage.trim()
          },
          priority: 'normal'
        })
      });

      if (response.ok) {
        setNewMessage("");
        // Refresh conversation to show the new message
        fetchConversation();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/app/conversations')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {conversation.contact?.name || conversation.contact?.username || 'Unknown Contact'}
                </h1>
                {getStatusBadge(conversation.status)}
              </div>
              <p className="text-gray-600 mb-3">
                @{conversation.contact?.username || 'unknown'}
              </p>
              
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
              
              {/* AI Response Quality Indicators */}
              {conversation.aiResponseMetadata && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge 
                    variant={conversation.aiResponseMetadata.lastResponseType === 'structured' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {conversation.aiResponseMetadata.lastResponseType}
                  </Badge>
                  {conversation.aiResponseMetadata.repetitionDetected && (
                    <Badge variant="destructive" className="text-xs">
                      Repetition Detected
                    </Badge>
                  )}
                  {conversation.aiResponseMetadata.contextAwareness && (
                    <Badge variant="outline" className="text-xs">
                      Context Aware
                    </Badge>
                  )}
                  {conversation.aiResponseMetadata.lastIntent && (
                    <Badge variant="secondary" className="text-xs">
                      {conversation.aiResponseMetadata.lastIntent}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
            <Button variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Messages */}
        <Card className="h-96 overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(!conversation.messages || conversation.messages.length === 0) ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No messages yet</p>
                </div>
              ) : (
                conversation.messages
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 min-h-[60px] resize-none"
                  disabled={sending}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() || sending}
                  className="px-4"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Info and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Contact Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <p className="text-sm text-gray-600">{conversation.contact?.name || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Username:</span>
                  <p className="text-sm text-gray-600">@{conversation.contact?.username || 'unknown'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Status:</span>
                  <div className="mt-1">{getStatusBadge(conversation.status)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Conversation Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Messages:</span>
                  <p className="text-sm text-gray-600">{conversation.messages?.length || 0}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Started:</span>
                  <p className="text-sm text-gray-600">{formatTime(conversation.createdAt)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Last Updated:</span>
                  <p className="text-sm text-gray-600">{formatTime(conversation.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Scoring Summary */}
          {conversation.leadScoring && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Lead Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Current Score:</span>
                    <p className="text-sm text-gray-600">{conversation.leadScoring.currentScore}/10</p>
                  </div>
                  {conversation.leadScoring.previousScore && (
                    <div>
                      <span className="text-sm font-medium">Previous Score:</span>
                      <p className="text-sm text-gray-600">{conversation.leadScoring.previousScore}/10</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium">Progression:</span>
                    <p className="text-sm text-gray-600 capitalize">{conversation.leadScoring.progression}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Confidence:</span>
                    <p className="text-sm text-gray-600">{Math.round(conversation.leadScoring.confidence * 100)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detailed Analytics */}
        {conversation.analytics && conversation.aiResponseMetadata && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConversationAnalytics
              analytics={conversation.analytics}
              aiResponseMetadata={conversation.aiResponseMetadata}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ConversationDetail;
