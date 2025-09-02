import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Send, Clock, TrendingUp, AlertCircle, CheckCircle, XCircle, Activity } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  newConversationsToday: number;
  totalMessages: number;
  messagesReceived: number;
  messagesSent: number;
  responseRate: number;
  queueStatus: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
  };
}

interface RecentConversation {
  id: string;
  contactName: string;
  lastMessage: string;
  timestamp: string;
  status: string;
  unreadCount: number;
}

interface RecentMessage {
  id: string;
  conversationId: string;
  contactName: string;
  content: string;
  timestamp: string;
  role: 'user' | 'assistant';
  status: string;
}

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  lastSync: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    activeConversations: 0,
    newConversationsToday: 0,
    totalMessages: 0,
    messagesReceived: 0,
    messagesSent: 0,
    responseRate: 0,
    queueStatus: {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0
    }
  });
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const handleInstagramOAuthCallback = async (authCode: string) => {
    setLoading(true);
    console.log('🔧 [OAuth Callback] Processing Instagram OAuth callback with code:', authCode);
    
    try {
      const backendUrl = BACKEND_URL;
      console.log('🔧 [OAuth Callback] Using backend URL:', backendUrl);
      
      // Get stored business info and agent behavior from onboarding
      const businessInfo = JSON.parse(localStorage.getItem('businessInfo') || '{}');
      const agentBehavior = JSON.parse(localStorage.getItem('agentBehavior') || '{}');
      
      console.log('🔧 [OAuth Callback] Business info:', businessInfo);
      console.log('🔧 [OAuth Callback] Agent behavior:', agentBehavior);

      const response = await fetch(`${backendUrl}/api/instagram/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          code: authCode,
          redirectUri: 'https://moca.pages.dev/app/dashboard',
          businessInfo,
          agentBehavior
        })
      });

      const data = await response.json();
      console.log('🔧 [OAuth Callback] Response status:', response.status);
      console.log('🔧 [OAuth Callback] Response data:', data);

      if (response.ok) {
        console.log('✅ [OAuth Callback] Instagram account connected successfully');
        toast({
          title: "¡Instagram conectado!",
          description: "Tu cuenta de Instagram se ha conectado exitosamente",
        });
        
        // Clear stored onboarding data
        localStorage.removeItem('businessInfo');
        localStorage.removeItem('agentBehavior');
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Refresh dashboard data
        await fetchDashboardData();
      } else {
        console.error('❌ [OAuth Callback] Failed to connect Instagram account:', data);
        toast({
          title: "Error al conectar",
          description: data.error || "No se pudo conectar la cuenta de Instagram",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error handling Instagram callback:', error);
      toast({
        title: "Error al conectar",
        description: "No se pudo conectar la cuenta de Instagram",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for Instagram OAuth callback
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    console.log('🔧 [Dashboard] URL params:', { code, error, searchParams: searchParams.toString() });
    
    if (code) {
      console.log('🔧 [Dashboard] OAuth code detected, processing callback...');
      handleInstagramOAuthCallback(code);
    } else if (error) {
      console.error('❌ [Dashboard] OAuth error detected:', error);
      toast({
        title: "Error de autorización",
        description: `Instagram authorization failed: ${error}`,
        variant: "destructive"
      });
    } else {
      console.log('🔧 [Dashboard] No OAuth params, fetching dashboard data...');
      fetchDashboardData();
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) {
        throw new Error('Missing backend URL configuration');
      }

      // Fetch Instagram account info
      try {
        const accountsResponse = await fetch(`${backendUrl}/api/instagram/accounts`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.data.accounts.length > 0) {
            const account = accountsData.data.accounts[0];
            setInstagramAccount({
              id: account.id,
              accountId: account.accountId,
              accountName: account.accountName,
              isActive: account.isActive,
              lastSync: account.metadata.lastSync
            });
          }
        }
      } catch (error) {
        console.error('Error fetching Instagram account:', error);
      }

      // Fetch queue status
      try {
        const queueResponse = await fetch(`${backendUrl}/api/instagram/queue/status`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          setStats(prev => ({
            ...prev,
            queueStatus: queueData.data
          }));
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
      }

      // Fetch conversations
      try {
        const conversationsResponse = await fetch(`${backendUrl}/api/instagram/conversations`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (conversationsResponse.ok) {
          const conversationsData = await conversationsResponse.json();
          setRecentConversations(conversationsData.data.conversations.slice(0, 5));
          
          // Calculate stats from conversations
          const totalConversations = conversationsData.data.conversations.length;
          const activeConversations = conversationsData.data.conversations.filter((c: any) => c.status === 'open').length;
          const newToday = conversationsData.data.conversations.filter((c: any) => {
            const today = new Date().toDateString();
            return new Date(c.timestamps.createdAt).toDateString() === today;
          }).length;
          
          setStats(prev => ({
            ...prev,
            totalConversations,
            activeConversations,
            newConversationsToday: newToday
          }));
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConversationStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-800">Cerrada</Badge>;
      case 'archived':
        return <Badge className="bg-blue-100 text-blue-800">Archivada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMessageStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800">Enviado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Fallido</Badge>;
      case 'received':
        return <Badge className="bg-blue-100 text-blue-800">Recibido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard | Moca - Instagram DM Agent</title>
        <meta name="description" content="Panel principal de gestión de tu agente de Instagram" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              {instagramAccount ? (
                <div className="space-y-1">
                  <p className="text-gray-600">Bienvenido de vuelta a Moca</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>📱 {instagramAccount.accountName}</span>
                    <span>🆔 {instagramAccount.accountId}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${instagramAccount.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {instagramAccount.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Bienvenido de vuelta a Moca</p>
              )}
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => navigate('/conversations')}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ver conversaciones
              </Button>
              <Button onClick={() => navigate('/instagram/setup')}>
                <Users className="w-4 h-4 mr-2" />
                Configurar Instagram
              </Button>
            </div>
          </div>

          {/* Instagram Account Info Card */}
          <Card className="border-violet-200 bg-violet-50">
            <CardHeader>
              <CardTitle className="text-violet-800 flex items-center">
                📱 Información de Instagram
              </CardTitle>
              <CardDescription className="text-violet-600">
                Tu cuenta de Instagram conectada y estado del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {instagramAccount ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-violet-200">
                      <div className="text-2xl font-bold text-violet-600">{instagramAccount.accountName}</div>
                      <div className="text-sm text-violet-500">Cuenta de Instagram</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-violet-200">
                      <div className="text-lg font-semibold text-violet-600">{instagramAccount.accountId}</div>
                      <div className="text-sm text-violet-500">Account ID</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-violet-600 hover:text-violet-700"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(instagramAccount.accountId);
                            toast({
                              title: "¡Account ID copiado!",
                              description: `${instagramAccount.accountId} ha sido copiado al portapapeles`,
                            });
                          } catch (error) {
                            toast({
                              title: "Error al copiar",
                              description: "No se pudo copiar el Account ID al portapapeles",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        📋 Copiar
                      </Button>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-violet-200">
                      <div className="text-lg font-semibold text-violet-600">
                        {formatDate(instagramAccount.lastSync)}
                      </div>
                      <div className="text-sm text-violet-500">Última sincronización</div>
                    </div>
                  </div>
                  <div className="mt-4 text-center space-y-3">
                    <Badge variant="outline" className="text-violet-600 border-violet-300">
                      {instagramAccount.isActive ? '✅ Activo' : '❌ Inactivo'}
                    </Badge>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-violet-600 border-violet-300 hover:bg-violet-50"
                        onClick={() => navigate('/instagram/accounts')}
                      >
                        ⚙️ Configurar Cuenta
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-violet-600">
                  <p>No hay cuenta de Instagram conectada</p>
                  <p className="text-sm text-violet-500 mt-2">Configura tu cuenta de Instagram para comenzar</p>
                  <Button 
                    className="mt-4 bg-violet-600 hover:bg-violet-700"
                    onClick={() => navigate('/instagram/setup')}
                  >
                    Conectar Instagram
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalConversations}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.newConversationsToday > 0 ? `+${stats.newConversationsToday} hoy` : 'Sin nuevas conversaciones'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversaciones Activas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeConversations}</div>
                <p className="text-xs text-muted-foreground">
                  de {stats.totalConversations} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cola de Mensajes</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.queueStatus.pending}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.queueStatus.failed > 0 ? `${stats.queueStatus.failed} fallidos` : 'Todos enviados'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Respuesta</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.responseRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Mensajes respondidos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Conversations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Conversaciones Recientes
                </CardTitle>
                <CardDescription>
                  Tus conversaciones de Instagram más recientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentConversations.length > 0 ? (
                  <div className="space-y-4">
                    {recentConversations.map((conversation) => (
                      <div key={conversation.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-violet-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{conversation.contactName}</p>
                            <p className="text-xs text-gray-500">{formatDate(conversation.timestamp)}</p>
                            <p className="text-xs text-gray-500 truncate max-w-48">{conversation.lastMessage}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {getConversationStatusBadge(conversation.status)}
                          {conversation.unreadCount > 0 && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay conversaciones recientes</p>
                    <p className="text-sm">Las conversaciones de Instagram aparecerán aquí</p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/conversations')}
                >
                  Ver todas las conversaciones
                </Button>
              </CardContent>
            </Card>

            {/* Queue Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Estado de la Cola
                </CardTitle>
                <CardDescription>
                  Estado de los mensajes en cola para envío
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Pendientes</p>
                        <p className="text-xs text-gray-500">Esperando envío</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {stats.queueStatus.pending}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Send className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Enviados</p>
                        <p className="text-xs text-gray-500">Mensajes entregados</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {stats.queueStatus.sent}
                    </Badge>
                  </div>
                  
                  {stats.queueStatus.failed > 0 && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Fallidos</p>
                          <p className="text-xs text-gray-500">Requieren reintento</p>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-800">
                        {stats.queueStatus.failed}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/system/queue')}
                >
                  Ver detalles de la cola
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>
                Accede rápidamente a las funciones más utilizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/conversations')}
                >
                  <MessageSquare className="w-6 h-6 mb-2" />
                  <span className="text-sm">Ver Conversaciones</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/instagram/accounts')}
                >
                  <Users className="w-6 h-6 mb-2" />
                  <span className="text-sm">Configurar Instagram</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/system/queue')}
                >
                  <Activity className="w-6 h-6 mb-2" />
                  <span className="text-sm">Estado de la Cola</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/system/logs')}
                >
                  <Clock className="w-6 h-6 mb-2" />
                  <span className="text-sm">Ver Logs</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

