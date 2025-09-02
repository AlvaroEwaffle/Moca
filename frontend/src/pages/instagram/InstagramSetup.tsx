import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, CheckCircle, XCircle, ExternalLink, Copy } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  lastSync: string;
}

const InstagramSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [formData, setFormData] = useState({
    accountId: '',
    accountName: '',
    accessToken: ''
  });

  useEffect(() => {
    fetchInstagramAccount();
    testConnection();
  }, []);

  const fetchInstagramAccount = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) return;

      const response = await fetch(`${backendUrl}/api/instagram/accounts`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data.accounts.length > 0) {
          const account = data.data.accounts[0];
          setInstagramAccount({
            id: account.id,
            accountId: account.accountId,
            accountName: account.accountName,
            isActive: account.isActive,
            lastSync: account.metadata.lastSync
          });
          setFormData({
            accountId: account.accountId,
            accountName: account.accountName,
            accessToken: '••••••••••••••••' // Hide token
          });
          setConnectionStatus('connected');
        }
      }
    } catch (error) {
      console.error('Error fetching Instagram account:', error);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) return;

      const response = await fetch(`${backendUrl}/api/instagram/test-connection`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.data.connected ? 'connected' : 'error');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOAuthConnect = () => {
    // Use the Instagram Business OAuth URL provided by Meta
    const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1281735870117085&redirect_uri=https://moca.pages.dev/instagram-callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;
    
    // Redirect to Instagram Business OAuth
    window.location.href = instagramAuthUrl;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!backendUrl) throw new Error('Backend URL not configured');

      const response = await fetch(`${backendUrl}/api/instagram/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          accountId: formData.accountId,
          accountName: formData.accountName,
          accessToken: formData.accessToken,
          settings: {
            autoRespond: true,
            aiEnabled: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Instagram account');
      }

      toast({
        title: "¡Cuenta conectada!",
        description: "Tu cuenta de Instagram se ha conectado exitosamente",
      });

      // Refresh account data
      await fetchInstagramAccount();
      await testConnection();

    } catch (error) {
      console.error('Error connecting Instagram account:', error);
      toast({
        title: "Error al conectar",
        description: "No se pudo conectar la cuenta de Instagram",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "¡Copiado!",
        description: `${label} ha sido copiado al portapapeles`,
      });
    } catch (error) {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'error':
        return 'Error de conexión';
      default:
        return 'Desconectado';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Helmet>
        <title>Configuración de Instagram | Moca - Instagram DM Agent</title>
        <meta name="description" content="Configura tu cuenta de Instagram para Moca" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-pink-100 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <Instagram className="mx-auto h-16 w-16 text-violet-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración de Instagram</h1>
            <p className="text-gray-600">Conecta tu cuenta de Instagram Business para comenzar a usar Moca</p>
          </div>

          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Estado de la Conexión
                <Badge className={getStatusColor()}>
                  {getStatusIcon()}
                  <span className="ml-2">{getStatusText()}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {instagramAccount ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-violet-600">{instagramAccount.accountName}</div>
                      <div className="text-sm text-gray-500">Cuenta de Instagram</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-violet-600">{instagramAccount.accountId}</div>
                      <div className="text-sm text-gray-500">Account ID</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-violet-600">
                        {new Date(instagramAccount.lastSync).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">Última sincronización</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => testConnection()}
                      disabled={testing}
                    >
                      {testing ? 'Probando...' : 'Probar Conexión'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/instagram/accounts')}
                    >
                      Gestionar Cuenta
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No hay cuenta de Instagram conectada</p>
                  <p className="text-sm text-gray-400">Configura tu cuenta a continuación</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OAuth Connection */}
          {!instagramAccount && (
            <Card>
              <CardHeader>
                <CardTitle>Conectar con Instagram</CardTitle>
                <CardDescription>
                  Conecta tu cuenta de Instagram de forma segura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="bg-violet-50 p-6 rounded-lg">
                    <Instagram className="w-12 h-12 text-violet-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Conectar con OAuth (Recomendado)
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Conecta tu cuenta de Instagram de forma segura usando el flujo oficial de OAuth. 
                      No necesitas copiar tokens manualmente.
                    </p>
                    <Button 
                      onClick={handleOAuthConnect}
                      className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
                    >
                      <Instagram className="w-4 h-4 mr-2" />
                      Conectar con Instagram
                    </Button>
                  </div>
                  
                  <div className="text-gray-500 text-sm">
                    O continúa con la configuración manual
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Setup Form */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración Manual</CardTitle>
              <CardDescription>
                Ingresa los datos de tu cuenta de Instagram Business manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="accountName">Nombre de la cuenta de Instagram</Label>
                  <Input
                    id="accountName"
                    value={formData.accountName}
                    onChange={(e) => handleInputChange('accountName', e.target.value)}
                    placeholder="Ej: @mi_restaurante"
                  />
                </div>
                
                <div>
                  <Label htmlFor="accountId">Instagram Account ID</Label>
                  <Input
                    id="accountId"
                    value={formData.accountId}
                    onChange={(e) => handleInputChange('accountId', e.target.value)}
                    placeholder="Ej: 17841467023627361"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Puedes encontrar tu Account ID en Meta Developer Console
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="accessToken">Instagram Access Token</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    value={formData.accessToken}
                    onChange={(e) => handleInputChange('accessToken', e.target.value)}
                    placeholder="Tu Instagram User Access Token"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Genera un token en Meta Developer Console con permisos de Instagram
                  </p>
                </div>
              </div>

              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertDescription>
                  <strong>¿Cómo obtener estos datos?</strong>
                  <ol className="mt-2 space-y-1 text-sm">
                    <li>1. Ve a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline text-violet-600">Meta Developer Console</a></li>
                    <li>2. Crea una app y agrega Instagram Basic Display</li>
                    <li>3. Genera un Instagram User Access Token</li>
                    <li>4. Copia el Account ID y Access Token aquí</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSubmit}
                  disabled={loading || !formData.accountId || !formData.accountName || !formData.accessToken}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Conectando...
                    </div>
                  ) : (
                    'Conectar Cuenta'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Information */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Webhook</CardTitle>
              <CardDescription>
                Configura este webhook en Meta Developer Console
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL del Webhook</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={`${window.location.origin}/api/instagram/webhook`}
                    readOnly
                    className="bg-gray-50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/instagram/webhook`, 'URL del webhook')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value="cataleya"
                    readOnly
                    className="bg-gray-50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard('cataleya', 'Verify Token')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Configuración del Webhook:</strong>
                  <ol className="mt-2 space-y-1 text-sm">
                    <li>1. Ve a tu app en Meta Developer Console</li>
                    <li>2. Navega a Instagram Basic Display → Webhooks</li>
                    <li>3. Agrega la URL del webhook y el verify token</li>
                    <li>4. Suscríbete a los eventos: messages, comments</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => navigate('/app/dashboard')}
            >
              Volver al Dashboard
            </Button>
            <Button
              onClick={() => navigate('/conversations')}
              disabled={connectionStatus !== 'connected'}
            >
              Ver Conversaciones
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstagramSetup;
