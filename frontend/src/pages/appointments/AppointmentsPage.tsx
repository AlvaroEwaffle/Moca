import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Shield, Clock, Users, Zap } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import AppointmentsList from "./AppointmentsList";

interface CalendarStatus {
  isConnected: boolean;
  calendarName?: string;
  lastSync?: string;
  totalEvents?: number;
}

const AppointmentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const backendUrl = BACKEND_URL;
  const accessToken = localStorage.getItem('accessToken');

  useEffect(() => {
    if (accessToken) {
      checkCalendarStatus();
    } else {
      setLoading(false);
    }
  }, [accessToken]);

  const checkCalendarStatus = async () => {
    try {
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

  const handleConnectGoogleCalendar = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/doctors/calendar/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to generate auth URL');
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast({
        title: "Error de Conexión",
        description: "No se pudo conectar con Google Calendar",
        variant: "destructive"
      });
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/doctors/calendar/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        toast({
          title: "Calendario Desconectado",
          description: "Tu calendario de Google ha sido desconectado exitosamente"
        });
        await checkCalendarStatus();
      } else {
        throw new Error('Failed to disconnect calendar');
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: "Error",
        description: "No se pudo desconectar el calendario",
        variant: "destructive"
      });
    }
  };

  const handleRefreshConnection = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/doctors/calendar/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        toast({
          title: "Conexión Refrescada",
          description: "Tu conexión con Google Calendar ha sido refrescada"
        });
        await checkCalendarStatus();
      } else {
        throw new Error('Failed to refresh connection');
      }
    } catch (error) {
      console.error('Error refreshing connection:', error);
      toast({
        title: "Error",
        description: "No se pudo refrescar la conexión",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando estado del calendario...</p>
        </div>
      </div>
    );
  }

  // Si el calendario está conectado, mostrar la lista de citas
  if (calendarStatus?.isConnected) {
    return <AppointmentsList />;
  }

  // Si no hay token de acceso, redirigir al login
  if (!accessToken) {
    navigate('/login');
    return null;
  }

  // Mostrar pantalla de conexión con Google Calendar
  return (
    <>
      <Helmet>
        <title>Conectar Calendario | Tiare - Gestión de Práctica Médica</title>
        <meta name="description" content="Conecta tu calendario de Google para gestionar citas" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Conecta tu Calendario de Google
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Sincroniza tu agenda de Google Calendar con Tiare para gestionar citas, 
              horarios y recordatorios de manera centralizada
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sincronización Automática</h3>
              <p className="text-gray-600">
                Tus citas se sincronizan automáticamente entre Google Calendar y Tiare
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión Centralizada</h3>
              <p className="text-gray-600">
                Administra pacientes, citas y facturación desde una sola plataforma
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Recordatorios Inteligentes</h3>
              <p className="text-gray-600">
                Sistema automático de recordatorios y notificaciones para pacientes
              </p>
            </Card>
          </div>

          {/* Connection Card */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">¿Listo para Conectar?</CardTitle>
              <CardDescription>
                Haz clic en el botón de abajo para autorizar la conexión con tu cuenta de Google
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button 
                onClick={handleConnectGoogleCalendar}
                size="lg"
                className="w-full"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Conectar con Google Calendar
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              {/* Security Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <h4 className="font-medium mb-1">Seguridad y Privacidad</h4>
                    <p>
                      Solo accedemos a tu calendario principal para sincronizar citas. 
                      No compartimos tu información con terceros y puedes desconectar 
                      la integración en cualquier momento.
                    </p>
                  </div>
                </div>
              </div>

              {/* What Happens Next */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">¿Qué sucede después?</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Serás redirigido a Google para autorizar el acceso</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Google te devolverá a Tiare con la autorización</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Tu calendario se sincronizará automáticamente</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Podrás gestionar citas desde Tiare</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AppointmentsPage;
