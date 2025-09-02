import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserPlus, MessageSquare, Copy, Check, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
  doctorPhone: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  doctorPhone?: string;
}

const CreatePatient = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    notes: "",
    doctorPhone: ""
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [createdPatient, setCreatedPatient] = useState<any>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Get access token from localStorage
    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast({
        title: "Autenticación requerida",
        description: "Debes iniciar sesión para crear pacientes",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }
    setAccessToken(token);

    // Get doctor phone from user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.phone) {
      setFormData(prev => ({
        ...prev,
        doctorPhone: userData.phone
      }));
    }
  }, [navigate, toast]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = "El nombre es obligatorio";
    } else if (formData.name.trim().length < 2) {
      errors.name = "El nombre debe tener al menos 2 caracteres";
    }

    // Phone validation
    if (!formData.phone.trim()) {
      errors.phone = "El teléfono es obligatorio";
    } else if (!/^[\+]?[0-9\s\-\(\)]{8,}$/.test(formData.phone.trim())) {
      errors.phone = "El teléfono debe tener al menos 8 dígitos";
    }

    // Doctor phone validation
    if (!formData.doctorPhone.trim()) {
      errors.doctorPhone = "El teléfono del doctor es obligatorio";
    } else if (!/^[\+]?[0-9\s\-\(\)]{8,}$/.test(formData.doctorPhone.trim())) {
      errors.doctorPhone = "El teléfono del doctor debe tener al menos 8 dígitos";
    }

    // Email validation (optional but if provided, must be valid)
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "El email debe tener un formato válido";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Error de validación",
        description: "Por favor, corrige los errores en el formulario",
        variant: "destructive"
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: "Error de autenticación",
        description: "No tienes acceso. Por favor, inicia sesión nuevamente",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/patients/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setCreatedPatient(result);
      
      toast({
        title: "¡Paciente creado exitosamente!",
        description: `${result.patient.name} ha sido agregado al sistema`,
      });

    } catch (error) {
      console.error("Error creating patient:", error);
      toast({
        title: "Error al crear paciente",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (createdPatient?.whatsappLink) {
      try {
        await navigator.clipboard.writeText(createdPatient.whatsappLink);
        setLinkCopied(true);
        toast({
          title: "¡Enlace copiado!",
          description: "El enlace de WhatsApp ha sido copiado al portapapeles",
        });
        
        // Reset the copied state after 3 seconds
        setTimeout(() => setLinkCopied(false), 3000);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast({
          title: "Error al copiar",
          description: "No se pudo copiar el enlace al portapapeles",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      notes: "",
      doctorPhone: formData.doctorPhone // Keep doctor phone
    });
    setFormErrors({});
    setCreatedPatient(null);
    setLinkCopied(false);
  };

  if (!accessToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (createdPatient) {
    return (
      <>
        <Helmet>
          <title>Paciente Creado | Moca - Instagram DM Agent</title>
          <meta name="description" content="Paciente creado exitosamente en el sistema" />
        </Helmet>
        
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-2xl mx-auto">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Paciente Creado Exitosamente!</h1>
              <p className="text-gray-600">El paciente ha sido agregado al sistema y está listo para recibir citas</p>
            </div>

            {/* Patient Details Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Detalles del Paciente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Nombre</Label>
                    <p className="text-lg font-semibold">{createdPatient.patient.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Teléfono</Label>
                    <p className="text-lg font-semibold">{createdPatient.patient.phone}</p>
                  </div>
                  {createdPatient.patient.email && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <p className="text-lg font-semibold">{createdPatient.patient.email}</p>
                    </div>
                  )}
                  {createdPatient.patient.notes && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Notas</Label>
                      <p className="text-lg font-semibold">{createdPatient.patient.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Integration Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Integración con WhatsApp
                </CardTitle>
                <CardDescription>
                  Enlace personalizado para iniciar la comunicación con el paciente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">
                    <strong>Mensaje predefinido:</strong>
                  </p>
                  <p className="text-green-700">{createdPatient.whatsappMessage}</p>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={handleCopyLink}
                    disabled={linkCopied}
                    className={`flex-1 ${linkCopied ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        ¡Enlace Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar Enlace
                      </>
                    )}
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  Copia este enlace y compártelo con el paciente para iniciar la comunicación
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => navigate('/app/dashboard')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Dashboard
              </Button>
              <Button onClick={resetForm} className="flex-1">
                <UserPlus className="w-4 h-4 mr-2" />
                Crear Otro Paciente
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Crear Paciente | Moca - Instagram DM Agent</title>
        <meta name="description" content="Agregar un nuevo paciente al sistema" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Crear Nuevo Paciente</h1>
              <p className="text-gray-600">Agrega un nuevo paciente a tu práctica médica</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/app/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Información del Paciente
              </CardTitle>
              <CardDescription>
                Completa los campos requeridos para registrar al paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Nombre Completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej: María González"
                    className={formErrors.name ? "border-red-500" : ""}
                  />
                  {formErrors.name && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{formErrors.name}</span>
                    </div>
                  )}
                </div>

                {/* Phone Field */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Teléfono del Paciente <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Ej: +56912345678"
                    className={formErrors.phone ? "border-red-500" : ""}
                  />
                  {formErrors.phone && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{formErrors.phone}</span>
                    </div>
                  )}
                </div>

                {/* Doctor Phone Field */}
                <div className="space-y-2">
                  <Label htmlFor="doctorPhone" className="text-sm font-medium">
                    Teléfono del Doctor <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="doctorPhone"
                    name="doctorPhone"
                    type="tel"
                    value={formData.doctorPhone}
                    onChange={handleInputChange}
                    placeholder="Ej: +56920115198"
                    className={formErrors.doctorPhone ? "border-red-500" : ""}
                  />
                  {formErrors.doctorPhone && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{formErrors.doctorPhone}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Este número se usará para asociar al paciente con tu perfil
                  </p>
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email del Paciente
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Ej: maria.gonzalez@email.com"
                    className={formErrors.email ? "border-red-500" : ""}
                  />
                  {formErrors.email && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{formErrors.email}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Campo opcional para comunicación por email
                  </p>
                </div>

                {/* Notes Field */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">
                    Notas Adicionales
                  </Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Información adicional sobre el paciente, motivo de consulta, etc."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    Campo opcional para información adicional
                  </p>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creando Paciente...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Crear Paciente
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default CreatePatient;
