import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, RefreshCw, Clock, User, MapPin, FileText, Users } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  patientId?: string;
  googleCalendarEventId?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

// Interface for Google Calendar events
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

interface CalendarStatus {
  isConnected: boolean;
  calendarName?: string;
  lastSync?: string;
  totalEvents?: number;
}

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'quarter'>('week');

  const backendUrl = BACKEND_URL;
  const accessToken = localStorage.getItem('accessToken');

  // Transform Google Calendar events to Appointment format
  const transformGoogleCalendarEvent = (event: GoogleCalendarEvent): Appointment => {
    return {
      id: event.id,
      title: event.summary || 'Sin título',
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      status: 'scheduled' as const, // Default status for Google Calendar events
      notes: event.description || '',
      patientId: undefined, // Will be linked later if patient info is found
      googleCalendarEventId: event.id,
      attendees: event.attendees || []
    };
  };

  // Get date range for filtering
  const getDateRange = (filterType: typeof dateFilter) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case 'today':
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        return { start: startOfDay, end: endOfDay };
      
      case 'week':
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        return { start: startOfWeek, end: endOfWeek };
      
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
        const endOfQuarter = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1);
        return { start: startOfQuarter, end: endOfQuarter };
      
      default:
        return { start: null, end: null };
    }
  };

  useEffect(() => {
    if (accessToken) {
      checkCalendarStatus();
      fetchAppointments();
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
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/api/doctors/calendar/appointments`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const googleEvents = data.data.events || [];
        
        // Transform Google Calendar events to Appointment format
        const transformedAppointments = googleEvents.map(transformGoogleCalendarEvent);
        
        console.log('📅 [AppointmentsList] Raw Google Calendar events:', googleEvents);
        console.log('🔄 [AppointmentsList] Transformed appointments:', transformedAppointments);
        
        setAppointments(transformedAppointments);
      } else {
        console.error('Failed to fetch appointments');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    try {
      setSyncing(true);
      const response = await fetch(`${backendUrl}/api/doctors/calendar/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sincronización Completada",
          description: `Se sincronizaron ${data.data.newAppointments} nuevas citas y se actualizaron ${data.data.updatedAppointments}`,
        });
        
        // Refresh appointments list
        await fetchAppointments();
        await checkCalendarStatus();
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: "Error de Sincronización",
        description: "No se pudo sincronizar el calendario",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    let filtered = appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      
      // Apply status filter
      switch (filter) {
        case 'upcoming':
          return appointmentDate >= now;
        case 'past':
          return appointmentDate < now;
        default:
          return true;
      }
    });

    // Apply date range filter
    if (dateFilter !== 'all') {
      const { start, end } = getDateRange(dateFilter);
      if (start && end) {
        filtered = filtered.filter(appointment => {
          const appointmentDate = new Date(appointment.startTime);
          return appointmentDate >= start && appointmentDate < end;
        });
      }
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmada';
      case 'scheduled':
        return 'Programada';
      case 'cancelled':
        return 'Cancelada';
      case 'completed':
        return 'Completada';
      default:
        return 'Desconocido';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-CL', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('es-CL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando citas...</p>
        </div>
      </div>
    );
  }

  if (!calendarStatus?.isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <CardTitle>Calendario No Conectado</CardTitle>
            <CardDescription>
              Para gestionar tus citas, primero necesitas conectar tu calendario de Google
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/appointments')}
              className="w-full"
            >
              Conectar Calendario
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredAppointments = getFilteredAppointments();

  return (
    <>
      <Helmet>
        <title>Gestión de Citas | Tiare - Gestión de Práctica Médica</title>
        <meta name="description" content="Gestiona tus citas sincronizadas con Google Calendar" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">Gestión de Citas</h1>
                  {/* Connection Status Indicator */}
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      calendarStatus?.isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      calendarStatus?.isConnected ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {calendarStatus?.isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600">
                  Citas sincronizadas con {calendarStatus?.calendarName || 'Google Calendar'}
                  {calendarStatus?.totalEvents !== undefined && (
                    <span className="ml-2 text-sm text-gray-500">
                      • {calendarStatus.totalEvents} eventos
                    </span>
                  )}
                  {calendarStatus?.lastSync && (
                    <span className="ml-2 text-sm text-gray-500">
                      • Última sincronización: {new Date(calendarStatus.lastSync).toLocaleDateString('es-CL')}
                    </span>
                  )}
                  {dateFilter !== 'all' && (
                    <span className="ml-2 text-sm text-blue-600 font-medium">
                      • {dateFilter === 'today' ? 'Viendo citas de hoy' :
                         dateFilter === 'week' ? 'Viendo citas de esta semana' :
                         dateFilter === 'month' ? 'Viendo citas de este mes' :
                         'Viendo citas de este trimestre'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={syncCalendar}
                  disabled={syncing}
                  variant="outline"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sincronizar
                    </>
                  )}
                </Button>
                <Button onClick={() => navigate('/appointments/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Cita
                </Button>
              </div>
            </div>



            {/* Period Indicator */}
            {dateFilter !== 'all' && (
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">
                        {dateFilter === 'today' ? 'Viendo citas de hoy' :
                         dateFilter === 'week' ? 'Viendo citas de esta semana' :
                         dateFilter === 'month' ? 'Viendo citas de este mes' :
                         'Viendo citas de este trimestre'}
                      </h3>
                      <p className="text-xs text-blue-700 mt-1">
                        {(() => {
                          const { start, end } = getDateRange(dateFilter);
                          if (start && end) {
                            const startStr = start.toLocaleDateString('es-CL', { 
                              day: 'numeric', 
                              month: 'short' 
                            });
                            const endStr = end.toLocaleDateString('es-CL', { 
                              day: 'numeric', 
                              month: 'short' 
                            });
                            return `${startStr} - ${endStr}`;
                          }
                          return '';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Filters Banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              {/* Status Filters */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Estado:</span>
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  size="sm"
                  className="text-xs"
                >
                  Todas ({appointments.length})
                </Button>
                <Button
                  variant={filter === 'upcoming' ? 'default' : 'outline'}
                  onClick={() => setFilter('upcoming')}
                  size="sm"
                  className="text-xs"
                >
                  Próximas ({appointments.filter(a => new Date(a.startTime) >= new Date()).length})
                </Button>
                <Button
                  variant={filter === 'past' ? 'default' : 'outline'}
                  onClick={() => setFilter('past')}
                  size="sm"
                  className="text-xs"
                >
                  Pasadas ({appointments.filter(a => new Date(a.startTime) < new Date()).length})
                </Button>
              </div>

              {/* Date Range Filters */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Período:</span>
                <Button
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('today')}
                  size="sm"
                  className="text-xs"
                >
                  Hoy
                </Button>
                <Button
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('week')}
                  size="sm"
                  className="text-xs"
                >
                  Esta Semana
                </Button>
                <Button
                  variant={dateFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('month')}
                  size="sm"
                  className="text-xs"
                >
                  Este Mes
                </Button>
                <Button
                  variant={dateFilter === 'quarter' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('quarter')}
                  size="sm"
                  className="text-xs"
                >
                  Este Trimestre
                </Button>
                <Button
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('all')}
                  size="sm"
                  className="text-xs"
                >
                  Todo
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>
                    <span className="font-medium">Filtros activos:</span>
                    <span className="ml-2">
                      {filter === 'all' ? 'Todas las citas' : 
                       filter === 'upcoming' ? 'Solo próximas' : 'Solo pasadas'}
                    </span>
                    {dateFilter !== 'all' && (
                      <span className="ml-2">
                        • {dateFilter === 'today' ? 'Hoy' :
                           dateFilter === 'week' ? 'Esta semana' :
                           dateFilter === 'month' ? 'Este mes' :
                           'Este trimestre'}
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {getFilteredAppointments().length} citas encontradas
                </div>
              </div>
            </div>
          </div>

          {/* Appointments Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {filter === 'upcoming' ? 'No hay citas próximas' : 
                   filter === 'past' ? 'No hay citas pasadas' : 'No hay citas'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {filter === 'upcoming' ? 'Todas tus citas programadas aparecerán aquí' :
                   filter === 'past' ? 'Las citas completadas aparecerán aquí' :
                   'Comienza creando tu primera cita'}
                </p>
                {filter === 'upcoming' && (
                  <Button onClick={() => navigate('/appointments/create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Cita
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-100">
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                    <div className="col-span-4">Cita</div>
                    <div className="col-span-2">Fecha</div>
                    <div className="col-span-2">Hora</div>
                    <div className="col-span-2">Estado</div>
                    <div className="col-span-2">Acciones</div>
                  </div>
                </div>

                {/* Table Body */}
                <div>
                  {filteredAppointments.map((appointment, index) => {
                    const { date, time } = formatDateTime(appointment.startTime);
                    const endTime = new Date(appointment.endTime).toLocaleTimeString('es-CL', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });

                    // Alternate background colors for zebra striping
                    const rowBackground = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                    return (
                      <div key={appointment.id} className={`px-6 py-4 ${rowBackground} hover:bg-blue-50 transition-colors duration-200 border-b border-gray-100`}>
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Cita Column */}
                          <div className="col-span-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                  {appointment.title}
                                </h3>
                                {appointment.notes && (
                                  <p className="text-xs text-gray-500 truncate mt-1">
                                    {appointment.notes}
                                  </p>
                                )}
                                {appointment.googleCalendarEventId && (
                                  <div className="flex items-center mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Google Calendar
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Fecha Column */}
                          <div className="col-span-2">
                            <div className="text-sm text-gray-900">{date}</div>
                          </div>

                          {/* Hora Column */}
                          <div className="col-span-2">
                            <div className="text-sm text-gray-900">
                              {time} - {endTime}
                            </div>
                          </div>

                          {/* Estado Column */}
                          <div className="col-span-2">
                            <Badge className={getStatusColor(appointment.status)}>
                              {getStatusText(appointment.status)}
                            </Badge>
                          </div>

                          {/* Acciones Column */}
                          <div className="col-span-2">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/appointments/view/${appointment.id}`)}
                                className="text-xs"
                              >
                                Ver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/appointments/edit/${appointment.id}`)}
                                className="text-xs"
                              >
                                Editar
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details for Google Calendar Events */}
                        {appointment.googleCalendarEventId && appointment.attendees && appointment.attendees.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-start space-x-2">
                              <Users className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Asistentes:</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {appointment.attendees.map((attendee, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {attendee.email}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AppointmentsList;
