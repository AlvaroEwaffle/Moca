import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Zap, Target } from "lucide-react";
import { BACKEND_URL } from "@/utils/config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";

const Form = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "",
    strengths: "",
    targetAudience: "",
    results: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate form
    if (!formData.name || !formData.email || !formData.service || !formData.strengths || !formData.targetAudience || !formData.results) {
      toast({
        title: "Faltan campos por completar",
        description: "Por favor completa todos los campos para continuar.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor ingresa un email válido.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Store form data in localStorage
    localStorage.setItem('serviceFormData', JSON.stringify(formData));

    try {
      const backendUrl = BACKEND_URL;
      if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
      const response = await fetch(`${backendUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la sesión');
      }

      // Navigate to preview with session ID
      navigate(`/preview/${data.sessionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar tu solicitud';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <>
      <Helmet>
        <title>Completa tu experiencia | Ewaffle - Crea tu curso e-learning</title>
        <meta name="description" content="Cuéntanos sobre tu experiencia y fortalezas para generar una propuesta de curso e-learning profesional, potenciada con IA." />
      </Helmet>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center">
          <img src="/logoprimario.png" alt="Ewaffle Logo" className="w-80 object-contain mt-8" />
        </div>

        {/* Headline */}
        <h1 className="text-center text-4xl md:text-6xl font-bold leading-tight mb-4 text-white">
          Cuéntanos sobre tu <span className="bg-gradient-to-r from-white via-secondary to-accent bg-clip-text text-transparent">expertise</span>
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white bg-opacity-90 rounded-2xl shadow-xl p-8 md:p-12 space-y-8 w-full max-w-2xl">
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900">
              Nombre completo
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 text-base"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              placeholder="Ej: juan@email.com"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 text-base"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary-400" />
              Describe tu conocimiento experto *
            </label>
            <Textarea
              value={formData.service}
              onChange={(e) => handleInputChange('service', e.target.value)}
              placeholder="Ej: Soy especialista en marketing digital con 10 años de experiencia ayudando a empresas a aumentar sus ventas online..."
              className="min-h-[100px] text-base"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-secondary-400" />
              ¿Cuáles son tus fortalezas únicas y diferenciadoras? *
            </label>
            <Textarea
              value={formData.strengths}
              onChange={(e) => handleInputChange('strengths', e.target.value)}
              placeholder="Ej: Mi enfoque práctico combina estrategias probadas con herramientas de automatización que he desarrollado personalmente..."
              className="min-h-[100px] text-base"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-accent-400" />
              ¿Quién es tu audiencia objetivo? *
            </label>
            <Textarea
              value={formData.targetAudience}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              placeholder="Ej: Emprendedores y dueños de pequeñas empresas que quieren mejorar su presencia digital pero no tienen conocimientos técnicos..."
              className="min-h-[100px] text-base"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-primary-400" />
              ¿Qué resultados esperan obtener tus estudiantes? *
            </label>
            <Textarea
              value={formData.results}
              onChange={(e) => handleInputChange('results', e.target.value)}
              placeholder="Ej: Al finalizar el curso, podrán crear y ejecutar campañas de marketing digital que generen al menos un 300% de ROI..."
              className="min-h-[100px] text-base"
            />
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full py-5 text-lg font-bold rounded-xl shadow-xl bg-gradient-to-r from-secondary-500 to-accent-500 hover:from-secondary-600 hover:to-accent-600 border-0 text-white flex items-center justify-center gap-2 animate-scale-in"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Generando...
                </>
              ) : (
                <>
                  Comenzar mi diseño gratis <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
            <div className="mt-3 text-center text-sm text-primary-100">
              <span className="inline-block align-middle">✨ Sin tarjeta de crédito requerida · Resultados en minutos</span>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default Form;
