import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

const CalendarAuthError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);

  const error = searchParams.get('error');

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'access_denied':
        return 'Acceso denegado por el usuario';
      case 'invalid_request':
        return 'Solicitud inválida';
      case 'unauthorized_client':
        return 'Cliente no autorizado';
      case 'unsupported_response_type':
        return 'Tipo de respuesta no soportado';
      case 'invalid_scope':
        return 'Alcance inválido';
      case 'server_error':
        return 'Error del servidor de Google';
      case 'temporarily_unavailable':
        return 'Servicio temporalmente no disponible';
      case 'missing_parameters':
        return 'Parámetros faltantes en la respuesta';
      default:
        return errorCode || 'Error desconocido durante la autorización';
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Navigate back to appointments page to retry
      navigate('/appointments');
    } catch (error) {
      console.error('Error retrying:', error);
      toast({
        title: "Error al reintentar",
        description: "No se pudo volver a la página de citas",
        variant: "destructive"
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Error de Conexión | Tiare - Gestión de Práctica Médica</title>
        <meta name="description" content="Error al conectar con Google Calendar" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          {/* Error Header */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Error de Conexión
            </h1>
            <p className="text-xl text-gray-600">
              No se pudo conectar tu calendario de Google
            </p>
          </div>

          {/* Error Details Card */}
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Detalles del Error
              </CardTitle>
              <CardDescription className="text-red-600">
                Información sobre lo que salió mal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-2">
                    <strong>Error:</strong>
                  </p>
                  <p className="text-red-700 font-medium">
                    {getErrorMessage(error)}
                  </p>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-2">
                    <strong>Código de Error:</strong>
                  </p>
                  <p className="text-red-700 font-mono text-sm">
                    {error || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Solución de Problemas</CardTitle>
              <CardDescription>
                Intenta estos pasos para resolver el problema:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Verifica tu Conexión</h4>
                    <p className="text-sm text-gray-600">
                      Asegúrate de tener una conexión estable a internet
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Limpia el Cache</h4>
                    <p className="text-sm text-gray-600">
                      Intenta limpiar el cache del navegador y volver a intentar
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Verifica Permisos</h4>
                    <p className="text-sm text-gray-600">
                      Asegúrate de que Google tenga permisos para acceder a tu calendario
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Contacta Soporte</h4>
                    <p className="text-sm text-gray-600">
                      Si el problema persiste, contacta al equipo de soporte
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button 
              variant="outline" 
                              onClick={() => navigate('/app/dashboard')}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
            
            <Button 
              onClick={handleRetry}
              disabled={retrying}
              className="flex-1"
            >
              {retrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Reintentando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reintentar Conexión
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CalendarAuthError;
