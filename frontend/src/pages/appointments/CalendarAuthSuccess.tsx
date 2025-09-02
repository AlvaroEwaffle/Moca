import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, ArrowRight, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const CalendarAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<any>(null);

  const doctorId = searchParams.get('doctorId');

  useEffect(() => {
    if (doctorId) {
      checkCalendarStatus();
    } else {
      setLoading(false);
    }
  }, [doctorId]);

  const checkCalendarStatus = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const accessToken = localStorage.getItem('accessToken');
      
      if (!accessToken) {
        toast({
          title: "Error de autenticación",
          description: "No tienes acceso. Por favor, inicia sesión nuevamente",
          variant: "destructive"
        });
        navigate('/login');
        return;
      }

      // Check calendar connection status
      const response = await fetch(`${backendUrl}/api/doctors/calendar/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando conexión del calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Calendario Conectado | Tiare - Gestión de Práctica Médica</title>
        <meta name="description" content="Tu calendario de Google ha sido conectado exitosamente" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              ¡Calendario Conectado Exitosamente!
            </h1>
            <p className="text-xl text-gray-600">
              Tu calendario de Google está ahora sincronizado con Tiare
            </p>
          </div>

          {/* Success Details Card */}
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Estado de la Conexión
              </CardTitle>
              <CardDescription className="text-green-600">
                Información sobre tu calendario conectado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                  <span className="font-medium text-gray-700">Estado:</span>
                  <Badge className="bg-green-100 text-green-800">Conectado</Badge>
                </div>
                
                {calendarStatus && (
                  <>
                    {calendarStatus.calendarName && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                        <span className="font-medium text-gray-700">Calendario:</span>
                        <span className="text-gray-900">{calendarStatus.calendarName}</span>
                      </div>
                    )}
                    
                    {calendarStatus.lastSync && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                        <span className="font-medium text-gray-700">Última Sincronización:</span>
                        <span className="text-gray-900">
                          {new Date(calendarStatus.lastSync).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Steps Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Próximos Pasos</CardTitle>
              <CardDescription>
                Ahora que tu calendario está conectado, puedes:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Gestionar Citas</h4>
                    <p className="text-sm text-gray-600">
                      Crea y programa citas que se sincronizarán automáticamente con Google Calendar
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Configurar Horarios</h4>
                    <p className="text-sm text-gray-600">
                      Define tus horarios de trabajo y disponibilidad
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Sincronización Automática</h4>
                    <p className="text-sm text-gray-600">
                      Las citas se sincronizan automáticamente entre Tiare y Google Calendar
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
              onClick={() => navigate('/appointments')}
              className="flex-1"
            >
              Gestionar Citas
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CalendarAuthSuccess;
