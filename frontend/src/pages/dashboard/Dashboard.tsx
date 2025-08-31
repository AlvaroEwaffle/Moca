import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  newPatientsThisMonth: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  totalBilling: number;
  pendingBilling: number;
  paidBilling: number;
}

interface RecentAppointment {
  id: string;
  patientName: string;
  dateTime: string;
  type: string;
  status: string;
}

interface RecentBilling {
  id: string;
  patientName: string;
  amount: number;
  status: string;
  dueDate: string;
}

interface DoctorInfo {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    activePatients: 0,
    newPatientsThisMonth: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    totalBilling: 0,
    pendingBilling: 0,
    paidBilling: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [recentBilling, setRecentBilling] = useState<RecentBilling[]>([]);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      if (!backendUrl) {
        throw new Error('Missing backend URL configuration');
      }

      // Fetch doctor info (public endpoint, no auth required)
      try {
        const userId = userData.id || '6be302ce-9eb0-4f04-8490-4bb7a6b2063e'; // Fallback ID
        const doctorResponse = await fetch(`${backendUrl}/api/doctors/info/${userId}`);
        if (doctorResponse.ok) {
          const doctorData = await doctorResponse.json();
          setDoctorInfo(doctorData.doctor);
        } else {
          console.log('Doctor info not found, using fallback data');
          setDoctorInfo({
            id: userId,
            name: "Dr. Usuario",
            phone: "+56900000000",
            specialization: "Especialidad",
            licenseNumber: "LIC-000"
          });
        }
      } catch (error) {
        console.error('Error fetching doctor info:', error);
        setDoctorInfo({
          id: 'fallback',
          name: "Dr. Usuario",
          phone: "+56900000000",
          specialization: "Especialidad",
          licenseNumber: "LIC-000"
        });
      }

      // TODO: Implement real API calls for stats, appointments, and billing
      // For now, we'll show empty/placeholder data
      setStats({
        totalPatients: 0,
        activePatients: 0,
        newPatientsThisMonth: 0,
        totalAppointments: 0,
        pendingAppointments: 0,
        completedAppointments: 0,
        totalBilling: 0,
        pendingBilling: 0,
        paidBilling: 0
      });

      setRecentAppointments([]);
      setRecentBilling([]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">Confirmada</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Programada</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completada</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBillingStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Pagado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Vencido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard | Moca - Instagram DM Agent</title>
        <meta name="description" content="Panel principal de gestión de tu práctica médica" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              {doctorInfo ? (
                <div className="space-y-1">
                  <p className="text-gray-600">Bienvenido de vuelta, {doctorInfo.name}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>📱 {doctorInfo.phone}</span>
                    <span>🏥 {doctorInfo.specialization}</span>
                    <span>🆔 Lic. {doctorInfo.licenseNumber}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Bienvenido de vuelta, Doctor</p>
              )}
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => navigate('/appointments')}>
                <Calendar className="w-4 h-4 mr-2" />
                Ver agenda
              </Button>
              <Button onClick={() => navigate('/patients/create')}>
                <Users className="w-4 h-4 mr-2" />
                Nuevo paciente
              </Button>
            </div>
          </div>

          {/* Doctor Info Card */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center">
                👨‍⚕️ Información del Doctor
              </CardTitle>
              <CardDescription className="text-blue-600">
                Tus datos profesionales y de contacto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {doctorInfo ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">{doctorInfo.name}</div>
                      <div className="text-sm text-blue-500">Nombre</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                      <div className="text-lg font-semibold text-blue-600">{doctorInfo.phone}</div>
                      <div className="text-sm text-blue-500">Teléfono</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-blue-600 hover:text-blue-700"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(doctorInfo.phone);
                            toast({
                              title: "¡Teléfono copiado!",
                              description: `${doctorInfo.phone} ha sido copiado al portapapeles`,
                            });
                          } catch (error) {
                            toast({
                              title: "Error al copiar",
                              description: "No se pudo copiar el teléfono al portapapeles",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        📋 Copiar
                      </Button>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                      <div className="text-lg font-semibold text-blue-600">{doctorInfo.specialization}</div>
                      <div className="text-sm text-blue-500">Especialización</div>
                    </div>
                  </div>
                  <div className="mt-4 text-center space-y-3">
                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                      🆔 Licencia: {doctorInfo.licenseNumber}
                    </Badge>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={async () => {
                          const doctorInfoText = `👨‍⚕️ ${doctorInfo.name}\n📱 ${doctorInfo.phone}\n🏥 ${doctorInfo.specialization}\n🆔 Lic. ${doctorInfo.licenseNumber}`;
                          try {
                            await navigator.clipboard.writeText(doctorInfoText);
                            toast({
                              title: "¡Información copiada!",
                              description: "Toda la información del doctor ha sido copiada al portapapeles",
                            });
                          } catch (error) {
                            toast({
                              title: "Error al copiar",
                              description: "No se pudo copiar la información al portapapeles",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        📋 Copiar Información Completa
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-blue-600">
                  <p>No se pudo cargar la información del doctor</p>
                  <p className="text-sm text-blue-500 mt-2">Verifica que el ID del doctor sea correcto</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPatients}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.newPatientsThisMonth > 0 ? `+${stats.newPatientsThisMonth} este mes` : 'Sin nuevos pacientes'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Citas Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingAppointments}</div>
                <p className="text-xs text-muted-foreground">
                  de {stats.totalAppointments} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Facturación Pendiente</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.pendingBilling)}</div>
                <p className="text-xs text-muted-foreground">
                  de {formatCurrency(stats.totalBilling)} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Completación</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalAppointments > 0 
                    ? Math.round((stats.completedAppointments / stats.totalAppointments) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Citas completadas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Próximas Citas
                </CardTitle>
                <CardDescription>
                  Tus próximas consultas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {recentAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{appointment.patientName}</p>
                            <p className="text-xs text-gray-500">{formatDate(appointment.dateTime)}</p>
                            <p className="text-xs text-gray-500">{appointment.type}</p>
                          </div>
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay citas programadas</p>
                    <p className="text-sm">Las próximas citas aparecerán aquí</p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/appointments')}
                >
                  Ver todas las citas
                </Button>
              </CardContent>
            </Card>

            {/* Recent Billing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Facturación Reciente
                </CardTitle>
                <CardDescription>
                  Estado de tus facturas y pagos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentBilling.length > 0 ? (
                  <div className="space-y-4">
                    {recentBilling.map((billing) => (
                      <div key={billing.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{billing.patientName}</p>
                            <p className="text-xs text-gray-500">Vence: {billing.dueDate}</p>
                            <p className="text-sm font-semibold">{formatCurrency(billing.amount)}</p>
                          </div>
                        </div>
                        {getBillingStatusBadge(billing.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay facturas recientes</p>
                    <p className="text-sm">Las facturas aparecerán aquí</p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/billing')}
                >
                  Ver todas las facturas
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
                  onClick={() => navigate('/patients/create')}
                >
                  <Users className="w-6 h-6 mb-2" />
                  <span className="text-sm">Nuevo Paciente</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/appointments/create')}
                >
                  <Calendar className="w-6 h-6 mb-2" />
                  <span className="text-sm">Nueva Cita</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/billing/create')}
                >
                  <DollarSign className="w-6 h-6 mb-2" />
                  <span className="text-sm">Nueva Factura</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => navigate('/appointments')}
                >
                  <Clock className="w-6 h-6 mb-2" />
                  <span className="text-sm">Ver Agenda</span>
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
