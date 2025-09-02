import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { ArrowLeft, Lock, Sparkles, Check, Target, Users, TrendingUp, XCircle, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface FormData {
  service: string;
  strengths: string;
  targetAudience: string;
  results: string;
}

interface PreviewContent {
  propuesta_valor: string;
  descripcion_potencia_ia: string;
  ideas_IA: string[];
}

interface ProContent {
  propuesta_valor_pro: {
    bio: string;
    imagen_alt: string;
  };
  mapa_servicio: {
    titulo_servicio: string;
    etapas: {
      nombre: string;
    }[];
    modulos?: {
      nombre: string;
      descripcion: string;
    }[];
  };
  prompt_ejemplo: {
    etapa: string;
    prompt: string;
  }[];
}

interface SessionData {
  sessionId: string;
  preview: PreviewContent;
  pro: ProContent;
  isPaid: boolean;
}

const Preview = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [isPromoCodeValid, setIsPromoCodeValid] = useState(false);
  const [isPromoCodeDialogOpen, setIsPromoCodeDialogOpen] = useState(false);
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number | null>(null);
  const [isFreeAccess, setIsFreeAccess] = useState(false);

  useEffect(() => {
    const fetchSessionData = async () => {
      let data;
      try {
        const backendUrl = BACKEND_URL;
        if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
        const response = await fetch(`${backendUrl}/api/sessions/${sessionId}`);
        if (!response.ok) {
          throw new Error('Error al cargar la sesión');
        }
        data = await response.json();

        // Use the new API response structure directly
        const sessionDataObj: SessionData = {
          sessionId: data.sessionId,
          isPaid: data.isPaid,
          preview: data.preview,
          pro: data.pro
        };

        setSessionData(sessionDataObj);
        setFormData(JSON.parse(localStorage.getItem('serviceFormData') || '{}'));
      } catch (error) {
        console.error('Error fetching session:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar la sesión. Por favor, intenta nuevamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchSessionData();
    } else {
      setLoading(false);
      navigate('/');
    }
  }, [sessionId, navigate]);

  const handlePayment = async () => {
    try {
      const backendUrl = BACKEND_URL;
      if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
      
      const paymentData: any = { sessionId };
      if (isPromoCodeValid && promoCode) {
        paymentData.promoCode = promoCode;
      }
      
      const response = await fetch(`${backendUrl}/api/sessions/pago`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      // Check if this is a free access (100% discount)
      if (data.freeAccess) {
        toast({
          title: "¡Acceso gratuito activado!",
          description: "Serás redirigido a tu resultado premium...",
        });
        
        // Redirect directly to premium result after a short delay
        setTimeout(() => {
          navigate(`/premium-result/${sessionId}`);
        }, 2000);
        
        return;
      }

      // Redirect to MercadoPago checkout for normal payments
      window.location.href = data.init_point;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar el pago';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código promocional",
        variant: "destructive"
      });
      return;
    }

    setIsValidatingPromoCode(true);
    try {
      const backendUrl = BACKEND_URL;
      if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
      
      const response = await fetch(`${backendUrl}/api/sessions/validate-promo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId,
          promoCode: promoCode.trim() 
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setIsPromoCodeValid(true);
        setDiscountedPrice(data.discountedPrice);
        setDiscountPercentage(data.discountPercentage);
        setIsFreeAccess(data.isFreeAccess || false);
        setIsPromoCodeDialogOpen(false);
        toast({
          title: "¡Código válido!",
          description: data.message || "Tu código promocional ha sido aplicado",
        });
      } else {
        setIsPromoCodeValid(false);
        setDiscountedPrice(null);
        setDiscountPercentage(null);
        setIsFreeAccess(false);
        toast({
          title: "Código inválido",
          description: data.error || "El código promocional no es válido",
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al validar el código';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Vista previa de tu curso | Ewaffle - Propuesta e-learning con IA</title>
          <meta name="description" content="Previsualiza la propuesta de tu curso e-learning generada con IA. Descubre cómo tu conocimiento experto se transforma en una estructura profesional y atractiva." />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !formData || !sessionData) {
    return (
      <>
        <Helmet>
          <title>Vista previa de tu curso | Ewaffle - Propuesta e-learning con IA</title>
          <meta name="description" content="Previsualiza la propuesta de tu curso e-learning generada con IA. Descubre cómo tu conocimiento experto se transforma en una estructura profesional y atractiva." />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Error
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              {error || 'No se pudo cargar la sesión'}
            </p>
            <Button
              onClick={() => navigate('/')}
              size="lg"
              className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Vista previa de tu curso | Ewaffle - Propuesta e-learning con IA</title>
        <meta name="description" content="Previsualiza la propuesta de tu curso e-learning generada con IA. Descubre cómo tu conocimiento experto se transforma en una estructura profesional y atractiva." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
        <main className="w-full max-w-3xl bg-white bg-opacity-90 rounded-2xl shadow-xl p-6 md:p-12 my-12 flex flex-col items-center">
          {/* Logo */}
          <img src="/logoprimario.png" alt="Ewaffle Logo" className="w-64 object-contain mb-6" />

          {/* Page Title */}
          <h1 className="text-3xl md:text-5xl font-bold text-primary mb-2 text-center">
            Tu propuesta de curso personalizada
          </h1>
          <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl">
            ¡Listo! Tu curso ya tiene una propuesta clara y profesional para destacarte y atraer más estudiantes, ahora potenciada con IA.
          </p>

          {/* Value Proposition Section */}
          <div className="w-full bg-gradient-to-r from-secondary-100 to-accent-100 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-6 h-6 text-primary-500" />
              <h2 className="text-xl font-bold text-primary">Descripción del curso</h2>
            </div>
            <p className="text-lg text-gray-800 leading-relaxed">
              {sessionData?.preview.propuesta_valor}
            </p>
          </div>

          {/* Módulos Section (if present) */}
          {sessionData?.pro?.mapa_servicio?.modulos && (
            <div className="w-full bg-primary-50 rounded-2xl p-8 mb-8 shadow flex flex-col">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Sparkles className="w-7 h-7 text-primary-500" />
                <h2 className="text-2xl font-bold text-primary text-center">Módulos recomendados para tu curso</h2>
              </div>
              <ul className="space-y-6">
                {sessionData.pro.mapa_servicio.modulos.map((modulo, idx) => (
                  <li key={idx} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-600 text-lg shadow">{idx + 1}</div>
                    <div>
                      <div className="font-semibold text-primary-800 text-lg mb-1">{modulo.nombre}</div>
                      <div className="text-gray-700 text-base mb-1">{modulo.descripcion}</div>
                      {/* Optionally add content suggestions and resource types here if available in data */}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Enhancement Section */}
          <div className="w-full bg-blue-50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-blue-700">¿Cómo podrías potenciar tu curso con IA?</h2>
            </div>
            <p className="text-lg text-gray-800 leading-relaxed">
              {sessionData?.preview.descripcion_potencia_ia}
            </p>
          </div>

          {/* Ideas List Section */}
          <div className="w-full bg-accent-50 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-accent-500" />
              <h2 className="text-xl font-bold text-accent-700">Recomendaciones para potenciar con IA</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {sessionData?.preview.ideas_IA.map((idea, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm flex items-start gap-2">
                  <Sparkles className="w-5 h-5 text-accent-400 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">{idea}</span>
                </div>
              ))}
            </div>
          </div>



          {/* Pro Benefits Section */}
          <div className="w-full bg-gradient-to-r from-secondary-50 to-accent-50 rounded-2xl p-8 mb-8 border-2 border-secondary-200 text-center shadow">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Crown className="w-7 h-7 text-secondary-500" />
              <h2 className="text-2xl font-bold text-secondary-700">¿Te gustaría desarrollar la totalidad de tu curso?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-8 text-left">
              Si te gusta esta propuesta, puedes desarrollar la totalidad de tu curso en el siguiente paso.
              <br /><br />
              Qué vas a obtener:
            </p>
            <ul className="mb-6 text-left max-w-lg mx-auto space-y-4">
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Propuesta de valor del curso para bio, redes y presentaciones</li>
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Módulos y estructura del curso listos para usar</li>
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Prompts IA para cada módulo</li>
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Checklist de evaluación descargables</li>
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Sugerencias de contenido por módulo</li>
              <li className="flex items-center gap-3"><Check className="w-5 h-5 text-green-500" /> Tipos de recurso por cada módulo (Video masterclass, ebook, etc.)</li>
            </ul>
            {/* Incluir Precio Original 29,970, por Lanzamiento 19,970 */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="text-xl text-gray-500 line-through">
                Original $29.970 CLP
              </div>
              <div className="text-3xl font-bold text-primary-500">
                Por lanzamiento {discountedPrice ? `$${discountedPrice.toLocaleString('es-CL')}` : '$19.970'} CLP
              </div>
              {discountedPrice && discountPercentage && !isFreeAccess && (
                <div className="text-sm text-green-600 font-medium">
                  ¡Descuento del {discountPercentage}% aplicado!
                </div>
              )}
              {isFreeAccess && (
                <div className="text-sm text-green-600 font-bold">
                  🎁 ¡ACCESO GRATUITO ACTIVADO!
                </div>
              )}
            </div>
            <Button
              onClick={handlePayment}
              size="lg"
              className={`w-full max-w-xs py-4 text-lg font-bold rounded-xl shadow-xl border-0 text-white flex items-center justify-center gap-2 animate-scale-in mx-auto mb-2 ${
                isFreeAccess 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                  : 'bg-gradient-to-r from-secondary-500 to-accent-500 hover:from-secondary-600 hover:to-accent-600'
              }`}
            >
              {isFreeAccess ? 'Obtener acceso gratuito' : 'Desbloquear ahora'} <ArrowRight className="w-5 h-5" />
            </Button>
            <div className="text-center text-sm text-primary-400 mt-2">
              <span>✨ Pago 100% seguro con MercadoPago</span>
            </div>
            <div className="text-center mt-3">
              <Dialog open={isPromoCodeDialogOpen} onOpenChange={setIsPromoCodeDialogOpen}>
                <DialogTrigger asChild>
                  <button className="text-sm text-primary-600 hover:text-primary-700 underline">
                    ¿Tienes un código promocional?
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Código Promocional</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="promoCode" className="block text-sm font-medium text-gray-700 mb-2">
                        Ingresa tu código promocional
                      </label>
                      <Input
                        id="promoCode"
                        type="text"
                        placeholder="Ej: DESCUENTO20"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="w-full"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            validatePromoCode();
                          }
                        }}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsPromoCodeDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={validatePromoCode}
                        disabled={isValidatingPromoCode}
                      >
                        {isValidatingPromoCode ? "Validando..." : "Aplicar"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {isPromoCodeValid && (
                <div className="mt-2 text-sm text-green-600 font-medium">
                  ✓ Código aplicado: {promoCode}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Preview;
