import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { ArrowLeft, Save, Loader2, Calendar, Search, Clock, MessageSquare, Eye } from 'lucide-react';
import { Helmet } from 'react-helmet';

interface FetchRule {
  id: string;
  name: string;
  dateRange: {
    type: '1d' | '7d' | '30d' | '90d' | 'custom';
    days?: number;
    customStartDate?: string;
    customEndDate?: string;
  };
  maxResults: number;
  query?: string;
  labelIds?: string[];
  includeSpam: boolean;
  enabled: boolean;
  scheduleInterval?: number;
  scheduleTime?: {
    hour: number;
    minute: number;
    timezone?: string;
  };
  agentId?: string;
  systemPrompt?: string;
  draftSettings?: {
    enabled?: boolean;
    onlyIfUserNoResponse?: boolean;
    userNoResponseDays?: number;
    onlyIfOtherNoResponse?: boolean;
    otherNoResponseDays?: number;
  };
}

interface GmailFetchRuleFormProps {
  rule?: FetchRule | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const dateRangeOptions = [
  { value: '1d', label: 'Últimas 24 horas' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'custom', label: 'Personalizado' }
];

const GmailFetchRuleForm = ({ rule: propRule, onSuccess, onCancel }: GmailFetchRuleFormProps) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  
  // If used as a route, fetch the rule by ID
  const [rule, setRule] = useState<FetchRule | null>(propRule || null);
  const [loadingRule, setLoadingRule] = useState(!!id && !propRule);
  
  // Update form data when rule is loaded
  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        dateRangeType: (rule.dateRange?.type || '7d') as '1d' | '7d' | '30d' | '90d' | 'custom',
        customStartDate: rule.dateRange?.customStartDate || '',
        customEndDate: rule.dateRange?.customEndDate || '',
        maxResults: rule.maxResults || 50,
        query: rule.query || '',
        includeSpam: rule.includeSpam || false,
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        scheduleInterval: rule.scheduleInterval || undefined,
        scheduleTime: rule.scheduleTime || undefined,
        agentId: rule.agentId || '',
        systemPrompt: rule.systemPrompt || '',
        draftOnlyIfUserNoResponse: rule.draftSettings?.onlyIfUserNoResponse || false,
        userNoResponseDays: rule.draftSettings?.userNoResponseDays || 3,
        draftOnlyIfOtherNoResponse: rule.draftSettings?.onlyIfOtherNoResponse || false,
        otherNoResponseDays: rule.draftSettings?.otherNoResponseDays || 3
      });
    }
  }, [rule]);
  
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmails, setPreviewEmails] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    dateRangeType: (rule?.dateRange?.type || '7d') as '1d' | '7d' | '30d' | '90d' | 'custom',
    customStartDate: rule?.dateRange?.customStartDate || '',
    customEndDate: rule?.dateRange?.customEndDate || '',
    maxResults: rule?.maxResults || 50,
    query: rule?.query || '',
    includeSpam: rule?.includeSpam || false,
    enabled: rule?.enabled !== undefined ? rule.enabled : true,
    scheduleInterval: rule?.scheduleInterval || undefined,
    scheduleTime: rule?.scheduleTime || undefined,
    agentId: rule?.agentId || '',
    systemPrompt: rule?.systemPrompt || '',
    draftOnlyIfUserNoResponse: rule?.draftSettings?.onlyIfUserNoResponse || false,
    userNoResponseDays: rule?.draftSettings?.userNoResponseDays || 3,
    draftOnlyIfOtherNoResponse: rule?.draftSettings?.onlyIfOtherNoResponse || false,
    otherNoResponseDays: rule?.draftSettings?.otherNoResponseDays || 3
  });

  // Fetch rule if used as route with ID
  useEffect(() => {
    const fetchRule = async () => {
      if (!id || propRule || !accessToken) return;
      setLoadingRule(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (response.ok && data.data) {
          setRule(data.data);
        }
      } catch (error) {
        console.error('Error fetching rule:', error);
      } finally {
        setLoadingRule(false);
      }
    };
    fetchRule();
  }, [id, propRule, accessToken]);

  useEffect(() => {
    // Fetch agents for selection
    const fetchAgents = async () => {
      if (!accessToken) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/agents`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (response.ok && data.data) {
          setAgents(data.data.map((a: any) => ({ id: a.id, name: a.name })));
        }
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };
    fetchAgents();
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      toast({
        title: 'Sesión requerida',
        description: 'Inicia sesión para crear o editar reglas de Gmail.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la regla es requerido',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const dateRange: any = {
        type: formData.dateRangeType
      };
      
      if (formData.dateRangeType === 'custom') {
        if (!formData.customStartDate) {
          throw new Error('La fecha de inicio es requerida para rangos personalizados');
        }
        dateRange.customStartDate = new Date(formData.customStartDate);
        if (formData.customEndDate) {
          dateRange.customEndDate = new Date(formData.customEndDate);
        }
      }

      const payload: any = {
        name: formData.name,
        dateRange,
        maxResults: formData.maxResults,
        query: formData.query || undefined,
        includeSpam: formData.includeSpam,
        enabled: formData.enabled,
        scheduleInterval: formData.scheduleInterval || undefined,
        scheduleTime: formData.scheduleTime || undefined,
        systemPrompt: formData.systemPrompt || undefined,
        labelIds: ['INBOX'],
        draftSettings: {
          enabled: true,
          onlyIfUserNoResponse: formData.draftOnlyIfUserNoResponse || false,
          userNoResponseDays: formData.draftOnlyIfUserNoResponse ? formData.userNoResponseDays : undefined,
          onlyIfOtherNoResponse: formData.draftOnlyIfOtherNoResponse || false,
          otherNoResponseDays: formData.draftOnlyIfOtherNoResponse ? formData.otherNoResponseDays : undefined
        }
      };

      if (formData.agentId) {
        payload.agentId = formData.agentId;
      }

      const url = rule
        ? `${BACKEND_URL}/api/gmail/fetch-rules/${rule.id}`
        : `${BACKEND_URL}/api/gmail/fetch-rules`;
      const method = rule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save rule');
      }

      toast({
        title: 'Éxito',
        description: `Regla ${rule ? 'actualizada' : 'creada'} correctamente`
      });

      if (onSuccess) {
        onSuccess();
      } else {
        // If used as route, navigate back to dashboard
        navigate('/app/gmail');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save rule',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingRule) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{rule ? 'Editar Agente Gmail' : 'Crear Agente Gmail'} | Moca</title>
      </Helmet>
      
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                navigate('/app/gmail');
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {rule ? 'Editar Agente Gmail' : 'Crear Agente Gmail'}
            </h1>
            <p className="text-gray-600 mt-1">
              Configura un agente para gestionar y procesar emails automáticamente de Gmail
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Agente</CardTitle>
              <CardDescription>
                Define los parámetros para obtener emails automáticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Rule Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Agente *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Emails de Leads - Última Semana"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Agent Selection */}
              {agents.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="agentId">Agente (Opcional)</Label>
                  <Select
                    value={formData.agentId}
                    onValueChange={(value) => setFormData({ ...formData, agentId: value })}
                  >
                    <SelectTrigger id="agentId">
                      <SelectValue placeholder="Selecciona un agente (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ninguno</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Range */}
              <div className="space-y-2">
                <Label htmlFor="dateRangeType" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Rango de Fechas
                </Label>
                <Select
                  value={formData.dateRangeType}
                  onValueChange={(value: any) => setFormData({ ...formData, dateRangeType: value })}
                >
                  <SelectTrigger id="dateRangeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {formData.dateRangeType === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="customStartDate">Fecha de Inicio *</Label>
                    <Input
                      id="customStartDate"
                      type="datetime-local"
                      value={formData.customStartDate}
                      onChange={(e) => setFormData({ ...formData, customStartDate: e.target.value })}
                      required={formData.dateRangeType === 'custom'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customEndDate">Fecha de Fin</Label>
                    <Input
                      id="customEndDate"
                      type="datetime-local"
                      value={formData.customEndDate}
                      onChange={(e) => setFormData({ ...formData, customEndDate: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Max Results */}
              <div className="space-y-2">
                <Label htmlFor="maxResults">Número Máximo de Emails</Label>
                <Select
                  value={formData.maxResults.toString()}
                  onValueChange={(value) => setFormData({ ...formData, maxResults: parseInt(value) })}
                >
                  <SelectTrigger id="maxResults">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 emails</SelectItem>
                    <SelectItem value="50">50 emails</SelectItem>
                    <SelectItem value="100">100 emails</SelectItem>
                    <SelectItem value="200">200 emails</SelectItem>
                    <SelectItem value="500">500 emails</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Query Filter */}
              <div className="space-y-2">
                <Label htmlFor="query" className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Consulta de Búsqueda (Opcional)
                </Label>
                <Input
                  id="query"
                  placeholder="Ej: label:Lead, is:unread, from:example@gmail.com"
                  value={formData.query}
                  onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                />
                <p className="text-sm text-gray-500">
                  Usa sintaxis de búsqueda de Gmail (ej: <code className="text-xs bg-gray-100 px-1 rounded">label:Lead</code>)
                </p>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label htmlFor="systemPrompt" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Prompt del Sistema (Opcional)
                </Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="Ej: Eres un asistente especializado en gestionar emails de leads. Prioriza la identificación de oportunidades comerciales y proporciona respuestas profesionales y orientadas a la conversión."
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className="min-h-[120px]"
                  rows={6}
                />
                <p className="text-sm text-gray-500">
                  Instrucciones personalizadas para la IA que procesará estos emails (usado para generación de borradores, categorización, etc.)
                </p>
              </div>

              {/* Draft Settings */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Configuración de Borradores</Label>
                  <p className="text-sm text-gray-600">
                    Controla cuándo se generan borradores automáticamente
                  </p>
                </div>

                {/* Case 1: If user hasn't responded */}
                <div className="space-y-3 p-3 border rounded-lg bg-white">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="draftOnlyIfUserNoResponse"
                      checked={formData.draftOnlyIfUserNoResponse}
                      onCheckedChange={(checked) => setFormData({ ...formData, draftOnlyIfUserNoResponse: checked })}
                    />
                    <Label htmlFor="draftOnlyIfUserNoResponse" className="cursor-pointer font-medium">
                      Si YO no he respondido en X días
                    </Label>
                  </div>
                  <p className="text-sm text-gray-600 pl-8">
                    Crear borrador si no has respondido al email recibido
                  </p>
                  {formData.draftOnlyIfUserNoResponse && (
                    <div className="space-y-2 pl-8">
                      <Label htmlFor="userNoResponseDays">Días sin que respondas</Label>
                      <Input
                        id="userNoResponseDays"
                        type="number"
                        min="1"
                        max="90"
                        value={formData.userNoResponseDays}
                        onChange={(e) => setFormData({ ...formData, userNoResponseDays: parseInt(e.target.value) || 3 })}
                        className="w-32"
                      />
                      <p className="text-sm text-gray-500">
                        Se creará un borrador si no has respondido en {formData.userNoResponseDays} días
                      </p>
                    </div>
                  )}
                </div>

                {/* Case 2: If other party hasn't responded after user replied */}
                <div className="space-y-3 p-3 border rounded-lg bg-white">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="draftOnlyIfOtherNoResponse"
                      checked={formData.draftOnlyIfOtherNoResponse}
                      onCheckedChange={(checked) => setFormData({ ...formData, draftOnlyIfOtherNoResponse: checked })}
                    />
                    <Label htmlFor="draftOnlyIfOtherNoResponse" className="cursor-pointer font-medium">
                      Si la otra parte NO ha respondido en X días (después de que respondí)
                    </Label>
                  </div>
                  <p className="text-sm text-gray-600 pl-8">
                    Crear borrador de seguimiento si la otra parte no responde después de tu respuesta
                  </p>
                  {formData.draftOnlyIfOtherNoResponse && (
                    <div className="space-y-2 pl-8">
                      <Label htmlFor="otherNoResponseDays">Días sin respuesta de la otra parte</Label>
                      <Input
                        id="otherNoResponseDays"
                        type="number"
                        min="1"
                        max="90"
                        value={formData.otherNoResponseDays}
                        onChange={(e) => setFormData({ ...formData, otherNoResponseDays: parseInt(e.target.value) || 3 })}
                        className="w-32"
                      />
                      <p className="text-sm text-gray-500">
                        Se creará un borrador de seguimiento si no responden en {formData.otherNoResponseDays} días después de tu respuesta
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Configuration */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Ejecución Automática (Opcional)
                </Label>
                <p className="text-sm text-gray-600">
                  Configura cómo y cuándo se ejecutará automáticamente esta regla
                </p>

                {/* Schedule Type Selection */}
                <div className="space-y-2">
                  <Label>Tipo de Programación</Label>
                  <Select
                    value={
                      formData.scheduleTime 
                        ? 'time' 
                        : formData.scheduleInterval 
                        ? 'interval' 
                        : 'none'
                    }
                    onValueChange={(value) => {
                      if (value === 'none') {
                        setFormData({ 
                          ...formData, 
                          scheduleInterval: undefined,
                          scheduleTime: undefined
                        });
                      } else if (value === 'interval') {
                        setFormData({ 
                          ...formData, 
                          scheduleInterval: 60, // Default 1 hour
                          scheduleTime: undefined
                        });
                      } else if (value === 'time') {
                        setFormData({ 
                          ...formData, 
                          scheduleInterval: undefined,
                          scheduleTime: { hour: 9, minute: 0 } // Default 9:00 AM
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Manual (no automático)</SelectItem>
                      <SelectItem value="interval">Por Intervalo (cada X minutos/horas)</SelectItem>
                      <SelectItem value="time">Hora Específica (ej: 9:00 AM, 4:00 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Schedule Interval (if interval selected) */}
                {formData.scheduleInterval && (
                  <div className="space-y-2">
                    <Label htmlFor="scheduleInterval">Intervalo</Label>
                    <Select
                      value={formData.scheduleInterval.toString()}
                      onValueChange={(value) => {
                        setFormData({ ...formData, scheduleInterval: parseInt(value) });
                      }}
                    >
                      <SelectTrigger id="scheduleInterval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Cada 15 minutos</SelectItem>
                        <SelectItem value="30">Cada 30 minutos</SelectItem>
                        <SelectItem value="60">Cada 1 hora</SelectItem>
                        <SelectItem value="120">Cada 2 horas</SelectItem>
                        <SelectItem value="240">Cada 4 horas</SelectItem>
                        <SelectItem value="480">Cada 8 horas</SelectItem>
                        <SelectItem value="1440">Una vez al día</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500">
                      La regla se ejecutará automáticamente cada {formData.scheduleInterval} minutos
                    </p>
                  </div>
                )}

                {/* Schedule Time (if time selected) */}
                {formData.scheduleTime && (
                  <div className="space-y-2">
                    <Label htmlFor="scheduleTime">Hora de Ejecución</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={`${String(formData.scheduleTime.hour).padStart(2, '0')}:${String(formData.scheduleTime.minute).padStart(2, '0')}`}
                        onChange={(e) => {
                          const [hour, minute] = e.target.value.split(':').map(Number);
                          setFormData({
                            ...formData,
                            scheduleTime: {
                              hour: hour || 9,
                              minute: minute || 0,
                              timezone: formData.scheduleTime?.timezone
                            }
                          });
                        }}
                        className="w-40"
                      />
                      <span className="text-sm text-gray-600">
                        {formData.scheduleTime.hour.toString().padStart(2, '0')}:
                        {formData.scheduleTime.minute.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      La regla se ejecutará automáticamente todos los días a las {formData.scheduleTime.hour.toString().padStart(2, '0')}:{formData.scheduleTime.minute.toString().padStart(2, '0')}
                    </p>
                  </div>
                )}
              </div>

              {/* Include Spam */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeSpam"
                  checked={formData.includeSpam}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeSpam: checked })}
                />
                <Label htmlFor="includeSpam" className="cursor-pointer">
                  Incluir spam y eliminados
                </Label>
              </div>

              {/* Enabled */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  Regla habilitada
                </Label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      navigate('/app/gmail');
                    }
                  }} 
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {rule ? 'Actualizar Regla' : 'Crear Regla'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
};

export default GmailFetchRuleForm;

