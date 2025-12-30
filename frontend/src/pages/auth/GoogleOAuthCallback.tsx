import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BACKEND_URL } from "@/utils/config";

type StatusState = "pending" | "success" | "error";

const parseScopeFromState = (stateParam: string | null): "gmail" | "calendar" => {
  if (!stateParam) return "calendar";
  try {
    const decoded = JSON.parse(atob(stateParam));
    return decoded.scope === "gmail" ? "gmail" : "calendar";
  } catch {
    return "calendar";
  }
};

const deriveScope = (locationSearch: string): "gmail" | "calendar" => {
  const params = new URLSearchParams(locationSearch);
  const scopeParams = params.getAll("scope");

  if (scopeParams.some((scope) => scope.includes("mail.google") || scope.includes("gmail"))) {
    return "gmail";
  }

  return parseScopeFromState(params.get("state"));
};

const GoogleOAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [status, setStatus] = useState<StatusState>("pending");
  const [message, setMessage] = useState("Procesando la conexión con Google...");

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const code = query.get("code");
  const oauthError = query.get("error");
  const scope = deriveScope(location.search);

  useEffect(() => {
    const connect = async () => {
      if (oauthError) {
        setStatus("error");
        setMessage(`Google rechazó la conexión: ${oauthError}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("No recibimos el código de autorización de Google.");
        return;
      }

      if (!accessToken) {
        setStatus("error");
        setMessage("Tu sesión expiró. Inicia sesión y vuelve a intentar.");
        return;
      }

      try {
        setStatus("pending");
        setMessage("Conectando tu cuenta de Google...");
        const response = await fetch(`${BACKEND_URL}/api/integrations/google/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ code, scope })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No pudimos completar la conexión.");
        }

        setStatus("success");
        setMessage("¡Tu cuenta de Google se conectó correctamente!");
      } catch (error) {
        console.error("Error completing Google OAuth:", error);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
      }
    };

    connect();
  }, [accessToken, code, oauthError, scope]);

  const handleGoToIntegrations = () => {
    if (scope === "gmail") {
      navigate("/app/gmail");
    } else {
      navigate("/app/settings/integrations");
    }
  };

  // Auto-redirect to Gmail after successful connection
  useEffect(() => {
    if (status === "success" && scope === "gmail") {
      const timer = setTimeout(() => {
        navigate("/app/gmail");
      }, 2000); // 2 second delay to show success message
      return () => clearTimeout(timer);
    }
  }, [status, scope, navigate]);

  return (
    <>
      <Helmet>
        <title>Conectando Google | Moca</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Finalizando conexión con Google
            </CardTitle>
            <p className="text-sm text-gray-600">Esperando la confirmación de tus permisos.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === "pending" && (
              <div className="flex flex-col items-center text-gray-600 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                <p>{message}</p>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <AlertDescription className="text-green-800">{message}</AlertDescription>
                </Alert>
                <Button className="w-full" onClick={handleGoToIntegrations}>
                  {scope === "gmail" ? "Ir a Gmail" : "Volver a Integraciones"}
                </Button>
                {scope === "gmail" && (
                  <p className="text-xs text-center text-gray-500">
                    Redirigiendo automáticamente en unos segundos...
                  </p>
                )}
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
                    Ir al inicio
                  </Button>
                  <Button className="flex-1" onClick={handleGoToIntegrations}>
                    Reintentar conexión
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default GoogleOAuthCallback;

