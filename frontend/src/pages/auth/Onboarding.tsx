import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Instagram, Bot, CheckCircle } from "lucide-react";
import { Helmet } from "react-helmet";

interface BusinessInfo {
  businessName: string;
  businessType: string;
  primaryLanguage: string;
}

interface InstagramAccount {
  accountId: string;
  accountName: string;
  accessToken: string;
  isConnected: boolean;
}

interface AgentBehavior {
  systemPrompt: string;
  toneOfVoice: 'professional' | 'friendly' | 'casual';
  keyInformation: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessInfo: {
      businessName: '',
      businessType: '',
      primaryLanguage: 'es'
    } as BusinessInfo,
    instagramAccount: {
      accountId: '',
      accountName: '',
      accessToken: '',
      isConnected: false
    } as InstagramAccount,
    agentBehavior: {
      systemPrompt: 'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.',
      toneOfVoice: 'professional' as 'professional' | 'friendly' | 'casual',
      keyInformation: ''
    } as AgentBehavior
  });

  const businessTypes = [
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'retail', label: 'Tienda/Retail' },
    { value: 'service', label: 'Servicios' },
    { value: 'beauty', label: 'Belleza/Salud' },
    { value: 'fitness', label: 'Fitness/Deportes' },
    { value: 'education', label: 'Educación' },
    { value: 'technology', label: 'Tecnología' },
    { value: 'other', label: 'Otro' }
  ];

  const languages = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Português' }
  ];

  const handleBusinessInfoChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      businessInfo: {
        ...prev.businessInfo,
        [field]: value
      }
    }));
  };

  const handleInstagramAccountChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      instagramAccount: {
        ...prev.instagramAccount,
        [field]: value
      }
    }));
  };

  const handleAgentBehaviorChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      agentBehavior: {
        ...prev.agentBehavior,
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) throw new Error('Backend URL not configured');

      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const accessToken = localStorage.getItem('accessToken');

      // Create Instagram account
      const instagramResponse = await fetch(`${backendUrl}/api/instagram/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          accountId: formData.instagramAccount.accountId,
          accountName: formData.instagramAccount.accountName,
          accessToken: formData.instagramAccount.accessToken,
          settings: {
            autoRespond: true,
            aiEnabled: true,
            systemPrompt: formData.agentBehavior.systemPrompt,
            toneOfVoice: formData.agentBehavior.toneOfVoice,
            keyInformation: formData.agentBehavior.keyInformation
          }
        }),
      });

      if (!instagramResponse.ok) {
        throw new Error('Failed to create Instagram account');
      }

      // Store business info in localStorage for later use
      localStorage.setItem('businessInfo', JSON.stringify(formData.businessInfo));
      localStorage.setItem('agentBehavior', JSON.stringify(formData.agentBehavior));

      // Redirect to dashboard
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Error setting up Instagram account:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-violet-600 mb-4" />
              <h3 className="text-lg font-semibold">Información de tu negocio</h3>
              <p className="text-gray-600">Cuéntanos sobre tu empresa para personalizar el agente</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Nombre del negocio</Label>
                <Input
                  id="businessName"
                  value={formData.businessInfo.businessName}
                  onChange={(e) => handleBusinessInfoChange('businessName', e.target.value)}
                  placeholder="Ej: Mi Restaurante"
                />
              </div>
              
              <div>
                <Label htmlFor="businessType">Tipo de negocio</Label>
                <Select
                  value={formData.businessInfo.businessType}
                  onValueChange={(value) => handleBusinessInfoChange('businessType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de negocio" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="primaryLanguage">Idioma principal</Label>
                <Select
                  value={formData.businessInfo.primaryLanguage}
                  onValueChange={(value) => handleBusinessInfoChange('primaryLanguage', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Instagram className="mx-auto h-12 w-12 text-pink-600 mb-4" />
              <h3 className="text-lg font-semibold">Conecta tu cuenta de Instagram</h3>
              <p className="text-gray-600">Conecta tu cuenta de Instagram Business para comenzar</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="accountName">Nombre de la cuenta de Instagram</Label>
                <Input
                  id="accountName"
                  value={formData.instagramAccount.accountName}
                  onChange={(e) => handleInstagramAccountChange('accountName', e.target.value)}
                  placeholder="Ej: @mi_restaurante"
                />
              </div>
              
              <div>
                <Label htmlFor="accountId">Instagram Account ID</Label>
                <Input
                  id="accountId"
                  value={formData.instagramAccount.accountId}
                  onChange={(e) => handleInstagramAccountChange('accountId', e.target.value)}
                  placeholder="Ej: 17841467023627361"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Puedes encontrar tu Account ID en Meta Developer Console
                </p>
              </div>
              
              <div>
                <Label htmlFor="accessToken">Instagram Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  value={formData.instagramAccount.accessToken}
                  onChange={(e) => handleInstagramAccountChange('accessToken', e.target.value)}
                  placeholder="Tu Instagram User Access Token"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Genera un token en Meta Developer Console con permisos de Instagram
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">¿Cómo obtener estos datos?</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Ve a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">Meta Developer Console</a></li>
                  <li>2. Crea una app y agrega Instagram Basic Display</li>
                  <li>3. Genera un Instagram User Access Token</li>
                  <li>4. Copia el Account ID y Access Token aquí</li>
                </ol>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Bot className="mx-auto h-12 w-12 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold">Comportamiento del agente</h3>
              <p className="text-gray-600">Configura cómo debe responder tu agente de Instagram</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="systemPrompt">Prompt del sistema</Label>
                <Textarea
                  id="systemPrompt"
                  value={formData.agentBehavior.systemPrompt}
                  onChange={(e) => handleAgentBehaviorChange('systemPrompt', e.target.value)}
                  placeholder="Describe cómo debe comportarse tu agente..."
                  rows={4}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Instrucciones específicas sobre cómo debe responder el agente
                </p>
              </div>
              
              <div>
                <Label htmlFor="toneOfVoice">Tono de voz</Label>
                <Select
                  value={formData.agentBehavior.toneOfVoice}
                  onValueChange={(value) => handleAgentBehaviorChange('toneOfVoice', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tono" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Profesional</SelectItem>
                    <SelectItem value="friendly">Amigable</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="keyInformation">Información clave a incluir</Label>
                <Textarea
                  id="keyInformation"
                  value={formData.agentBehavior.keyInformation}
                  onChange={(e) => handleAgentBehaviorChange('keyInformation', e.target.value)}
                  placeholder="Información importante que el agente debe mencionar..."
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Ej: horarios, precios, ubicación, servicios especiales
                </p>
              </div>
            </div>

            <div className="text-center p-6 bg-green-50 rounded-lg">
              <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
              <h4 className="font-medium text-green-800">¡Configuración completa!</h4>
              <p className="text-sm text-green-600">Tu agente de Instagram está listo para comenzar</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>Configuración inicial | Moca - Instagram DM Agent</title>
        <meta name="description" content="Configura tu agente de Instagram en Moca" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-pink-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Paso {currentStep} de 3</span>
              <span className="text-sm text-gray-500">{Math.round((currentStep / 3) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-center">Configuración de tu agente de Instagram</CardTitle>
              <CardDescription className="text-center">
                Personaliza Moca según las necesidades de tu negocio
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {renderStep()}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  Anterior
                </Button>

                {currentStep < 3 ? (
                  <Button onClick={nextStep}>
                    Siguiente
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Configurando...
                      </div>
                    ) : (
                      'Finalizar configuración'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
