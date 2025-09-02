import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";

const InstagramAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (code) {
      handleInstagramCallback(code);
    } else if (errorParam) {
      setError(`Instagram authorization failed: ${errorParam}`);
    }
  }, [code, errorParam]);

  const handleInstagramLogin = () => {
    setLoading(true);
    setError(null);

    // Use the Instagram Business OAuth URL provided by Meta
    const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=2160534791106844&redirect_uri=https://moca.pages.dev/app/dashboard&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;

    // Redirect to Instagram Business OAuth
    window.location.href = instagramAuthUrl;
  };

  const handleInstagramCallback = async (authCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = BACKEND_URL;
      
      // Get stored business info and agent behavior from onboarding
      const businessInfo = JSON.parse(localStorage.getItem('businessInfo') || '{}');
      const agentBehavior = JSON.parse(localStorage.getItem('agentBehavior') || '{}');

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

      if (response.ok) {
        setSuccess(true);
        // Clear stored onboarding data
        localStorage.removeItem('businessInfo');
        localStorage.removeItem('agentBehavior');
        // Redirect to dashboard after successful connection
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 2000);
      } else {
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
          <title>Connecting Instagram... | Moca - Instagram DM Agent</title>
        </Helmet>
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-100 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting to Instagram...
              </h2>
              <p className="text-gray-600">
                Please wait while we connect your Instagram account
              </p>
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
          <title>Instagram Connected! | Moca - Instagram DM Agent</title>
        </Helmet>
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-100 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Instagram Connected Successfully!
              </h2>
              <p className="text-gray-600 mb-4">
                Your Instagram account has been connected to Moca. You can now start automating your messages.
              </p>
              <Button onClick={() => navigate('/app/dashboard')} className="w-full">
                Go to Dashboard
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
        <title>Connect Instagram | Moca - Instagram DM Agent</title>
        <meta name="description" content="Connect your Instagram account to start automating messages" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
              <Instagram className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Connect Instagram
            </CardTitle>
            <CardDescription className="text-gray-600">
              Connect your Instagram account to start automating your messages
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="bg-violet-50 p-4 rounded-lg">
                <h3 className="font-medium text-violet-900 mb-2">What you'll get:</h3>
                <ul className="text-sm text-violet-700 space-y-1">
                  <li>• Automatic message responses</li>
                  <li>• AI-powered conversation management</li>
                  <li>• Message queue and delivery tracking</li>
                  <li>• Real-time conversation monitoring</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Permissions we need:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Read your profile information</li>
                  <li>• Send messages on your behalf</li>
                  <li>• Access your media (for context)</li>
                </ul>
              </div>
            </div>

            <Button 
              onClick={handleInstagramLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-medium py-3"
            >
              {loading ? (
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center">
                  <Instagram className="w-4 h-4 mr-2" />
                  Connect with Instagram
                </div>
              )}
            </Button>

            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/app/instagram')}
                className="text-gray-600 hover:text-gray-800"
              >
                Or connect manually instead
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default InstagramAuth;
