import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Calendar, ArrowLeft, Clock, User, MapPin, FileText, Save } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface CreateAppointmentForm {
  patientId: string;
  dateTime: string;
  duration: number;
  type: 'presential' | 'remote' | 'home';
  notes: string;
}

const CreateAppointmentPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [formData, setFormData] = useState<CreateAppointmentForm>({
    patientId: '',
    dateTime: '',
    duration: 60,
    type: 'presential',
    notes: ''
  });

  const backendUrl = BACKEND_URL;
  const accessToken = localStorage.getItem('accessToken');

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }
    fetchPatients();
  }, [accessToken, navigate]);

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/patients`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPatients(data.patients || []);
      } else {
        console.error('Failed to fetch patients');
        toast({
          title: "Error",
          description: "No se pudieron cargar los pacientes",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "Error al cargar los pacientes",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: keyof CreateAppointmentForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patientId || !formData.dateTime) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Get current date and time for validation
      const selectedDateTime = new Date(formData.dateTime);
      const now = new Date();

      if (selectedDateTime <= now) {
        toast({
          title: "Error",
          description: "La fecha y hora de la cita debe ser en el futuro",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`${backendUrl}/api/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: formData.patientId,
          dateTime: selectedDateTime.toISOString(),
          duration: formData.duration,
          type: formData.type,
          notes: formData.notes
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Éxito",
          description: "Cita creada exitosamente",
        });
        
        // Redirect to appointments list
        navigate('/appointments');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la cita');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error al crear la cita',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // Minimum 30 minutes from now
    return now.toISOString().slice(0, 16);
  };

  if (!accessToken) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Crear Nueva Cita | Tiare - Gestión de Práctica Médica</title>
        <meta name="description" content="Crea una nueva cita para tu paciente" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Button
                variant="outline"
                onClick={() => navigate('/appointments')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Crear Nueva Cita</h1>
                <p className="text-gray-600 mt-2">Programa una nueva consulta para tu paciente</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Información de la Cita</span>
              </CardTitle>
              <CardDescription>
                Completa los detalles para programar la consulta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Patient Selection */}
                <div className="space-y-2">
                  <Label htmlFor="patientId" className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Paciente *</span>
                  </Label>
                  <Select
                    value={formData.patientId}
                    onValueChange={(value) => handleInputChange('patientId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{patient.name}</span>
                            <span className="text-sm text-gray-500">{patient.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateTime" className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Fecha y Hora *</span>
                    </Label>
                    <Input
                      id="dateTime"
                      type="datetime-local"
                      value={formData.dateTime}
                      onChange={(e) => handleInputChange('dateTime', e.target.value)}
                      min={getMinDateTime()}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration" className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Duración (minutos)</span>
                    </Label>
                    <Select
                      value={formData.duration.toString()}
                      onValueChange={(value) => handleInputChange('duration', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1.5 horas</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Consultation Type */}
                <div className="space-y-2">
                  <Label htmlFor="type" className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Tipo de Consulta</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'presential' | 'remote' | 'home') => handleInputChange('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presential">Presencial</SelectItem>
                      <SelectItem value="remote">Remota</SelectItem>
                      <SelectItem value="home">A domicilio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Notas</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Agrega notas adicionales sobre la consulta..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/appointments')}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Crear Cita</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default CreateAppointmentPage;
