import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL, INSTAGRAM_REDIRECT_URI } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

const InstagramCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (code) {
      handleInstagramCallback(code);
    } else if (errorParam) {
      setError(`Instagram authorization failed: ${errorParam}`);
      setLoading(false);
    } else {
      setError('No authorization code received');
      setLoading(false);
    }
  }, [code, errorParam]);

  const handleInstagramCallback = async (authCode: string) => {
    setLoading(true);
    setError(null);
    
    console.log('🔧 [Instagram Callback] Processing OAuth callback with code:', authCode);

    try {
      const backendUrl = BACKEND_URL;
      console.log('🔧 [Instagram Callback] Using backend URL:', backendUrl);
      
      // Get stored business info and agent behavior from onboarding
      const businessInfo = JSON.parse(localStorage.getItem('businessInfo') || '{}');
      const agentBehavior = JSON.parse(localStorage.getItem('agentBehavior') || '{}');
      
      console.log('🔧 [Instagram Callback] Business info:', businessInfo);
      console.log('🔧 [Instagram Callback] Agent behavior:', agentBehavior);

      // Check if access token exists and is valid
      const accessToken = localStorage.getItem('accessToken');
      console.log('🔧 [Instagram Callback] Access token exists:', !!accessToken);
      console.log('🔧 [Instagram Callback] Access token preview:', accessToken ? `${accessToken.substring(0, 20)}...` : 'none');

      if (!accessToken) {
        throw new Error('No access token found. Please login again.');
      }

      // Check if token looks valid (JWT should have 3 parts)
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        console.error('❌ [Instagram Callback] Invalid token format, clearing localStorage');
        localStorage.clear();
        throw new Error('Invalid token format. Please login again.');
      }

      const response = await fetch(`${backendUrl}/api/instagram/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          code: authCode,
          redirectUri: INSTAGRAM_REDIRECT_URI,
          businessInfo,
          agentBehavior
        })
      });

      const data = await response.json();
      console.log('🔧 [Instagram Callback] Response status:', response.status);
      console.log('🔧 [Instagram Callback] Response data:', data);

      if (response.ok) {
        console.log('✅ [Instagram Callback] Instagram account connected successfully');
        setSuccess(true);
        
        toast({
          title: "¡Instagram conectado!",
          description: "Tu cuenta de Instagram se ha conectado exitosamente",
        });
        
        // Clear stored onboarding data
        localStorage.removeItem('businessInfo');
        localStorage.removeItem('agentBehavior');
        
        // Redirect to dashboard after successful connection
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 2000);
      } else {
        console.error('❌ [Instagram Callback] Failed to connect Instagram account:', data);
        setError(data.error || 'Failed to connect Instagram account');
      }
    } catch (error) {
      console.error('Error handling Instagram callback:', error);
      setError('Failed to connect Instagram account');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Conectando Instagram - Moca</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Instagram className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">Conectando Instagram</CardTitle>
              <CardDescription>
                Procesando la autorización de tu cuenta de Instagram...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Helmet>
          <title>Instagram Conectado - Moca</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-green-600">¡Instagram Conectado!</CardTitle>
              <CardDescription>
                Tu cuenta de Instagram se ha conectado exitosamente. Redirigiendo al dashboard...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button 
                onClick={() => navigate('/app/dashboard')}
                className="w-full"
              >
                Ir al Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Error de Conexión - Moca</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Error de Conexión</CardTitle>
            <CardDescription>
              No se pudo conectar tu cuenta de Instagram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/app/instagram-setup')}
                className="flex-1"
              >
                Intentar de Nuevo
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/app/dashboard')}
                className="flex-1"
              >
                Ir al Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default InstagramCallback;
