import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { Mail, Plus, Edit, Trash2, Play, Pause, Loader2, Clock, Calendar, Filter, ChevronDown, ChevronUp, User, Eye, Sparkles, FileText } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import GmailFetchRuleForm from './GmailFetchRuleForm';
import ExecutionLogsViewer from '@/components/gmail/ExecutionLogsViewer';

interface EmailItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: Date | string;
  snippet: string;
  labels: string[];
}

interface FetchRule {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  enabled: boolean;
  dateRange: {
    type: '1d' | '7d' | '30d' | '90d' | 'custom';
    days?: number;
    customStartDate?: string;
    customEndDate?: string;
  };
  maxResults: number;
  query?: string;
  scheduleInterval?: number;
  scheduleTime?: {
    hour: number;
    minute: number;
    timezone?: string;
  };
  lastRunAt?: string;
  nextRunAt?: string;
  metadata: {
    totalRuns: number;
    totalEmailsFetched: number;
    lastError?: string;
  };
  createdAt: string;
}

const GmailFetchRules = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();
  
  const [rules, setRules] = useState<FetchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<FetchRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [ruleEmails, setRuleEmails] = useState<Record<string, EmailItem[]>>({});
  const [loadingEmails, setLoadingEmails] = useState<Record<string, boolean>>({});
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null);
  const [generatingDraftEmailId, setGeneratingDraftEmailId] = useState<string | null>(null);
  const [viewingLogsRuleId, setViewingLogsRuleId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch rules');
      setRules(data.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load fetch rules',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleCreate = () => {
    setSelectedRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule: FetchRule) => {
    setSelectedRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (!accessToken) return;
    if (!confirm('¿Estás seguro de que quieres eliminar esta regla?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete rule');
      
      toast({ title: 'Éxito', description: 'Regla eliminada correctamente' });
      fetchRules();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rule',
        variant: 'destructive'
      });
    }
  };

  const handleToggle = async (rule: FetchRule) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ enabled: !rule.enabled })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to toggle rule');
      
      toast({
        title: 'Éxito',
        description: `Regla ${!rule.enabled ? 'habilitada' : 'deshabilitada'} correctamente`
      });
      fetchRules();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle rule',
        variant: 'destructive'
      });
    }
  };

  const handleExecute = async (ruleId: string) => {
    if (!accessToken) return;
    
    setExecutingRuleId(ruleId);
    try {
      // Show loading toast
      const loadingToast = toast({
        title: 'Ejecutando regla...',
        description: 'Procesando emails y generando borradores. Esto puede tomar unos momentos.',
        duration: 0 // Don't auto-dismiss
      });

      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${ruleId}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute rule');
      }
      
      const result = data.data;
      
      // Dismiss loading toast
      loadingToast.dismiss();
      
      // Show success toast with detailed information
      toast({
        title: '✅ Regla ejecutada exitosamente',
        description: `Emails procesados: ${result.emailsFetched || 0} | Contactos: ${result.contacts || 0} | Conversaciones: ${result.conversations || 0} | Mensajes: ${result.messages || 0}`,
        duration: 6000
      });
      
      // Refresh rules to update metadata
      await fetchRules();
      
      // If emails are expanded for this rule, refresh the email list
      if (expandedRuleId === ruleId) {
        await fetchRuleEmails(ruleId);
      }
    } catch (error: any) {
      toast({
        title: '❌ Error al ejecutar la regla',
        description: error.message || 'No se pudo ejecutar la regla. Por favor, intenta nuevamente.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setExecutingRuleId(null);
    }
  };

  const formatDateRange = (rule: FetchRule) => {
    const { type, days, customStartDate, customEndDate } = rule.dateRange;
    if (type === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate).toLocaleDateString();
        const end = new Date(customEndDate).toLocaleDateString();
        return `${start} - ${end}`;
      }
      return 'Personalizado';
    }
    const labels: Record<string, string> = {
      '1d': 'Últimas 24 horas',
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días',
      '90d': 'Últimos 90 días'
    };
    return labels[type] || type;
  };

  const fetchRuleEmails = async (ruleId: string) => {
    if (!accessToken) return;
    
    setLoadingEmails(prev => ({ ...prev, [ruleId]: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${ruleId}/emails`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch emails');
      
      setRuleEmails(prev => ({ ...prev, [ruleId]: data.data?.emails || [] }));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load emails',
        variant: 'destructive'
      });
    } finally {
      setLoadingEmails(prev => ({ ...prev, [ruleId]: false }));
    }
  };

  const handleToggleEmails = (ruleId: string) => {
    if (expandedRuleId === ruleId) {
      setExpandedRuleId(null);
    } else {
      setExpandedRuleId(ruleId);
      // Fetch emails if not already loaded
      if (!ruleEmails[ruleId]) {
        fetchRuleEmails(ruleId);
      }
    }
  };

  const handleGenerateDraft = async (email: EmailItem) => {
    if (!accessToken) return;
    
    setGeneratingDraftEmailId(email.id);
    try {
      // Extract email address from "Name <email@domain.com>" format
      const extractEmail = (emailStr: string) => {
        const match = emailStr.match(/<([^>]+)>/);
        return match ? match[1] : emailStr;
      };

      const fromEmail = extractEmail(email.from);
      const displayName = email.from.replace(/<[^>]+>/g, '').trim() || fromEmail;

      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          emailId: email.id,
          threadId: email.threadId,
          subject: email.subject || '(Sin asunto)',
          fromEmail: fromEmail,
          fromName: displayName !== fromEmail ? displayName : undefined,
          originalBody: email.snippet || email.subject || '',
          priority: 'medium'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to queue draft');
      
      toast({
        title: '✅ Borrador encolado',
        description: 'El borrador se generará automáticamente en breve. Puedes revisarlo en la cola de borradores.',
        duration: 4000
      });
    } catch (error: any) {
      toast({
        title: '❌ Error al generar borrador',
        description: error.message || 'No se pudo encolar el borrador. Por favor, intenta nuevamente.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setGeneratingDraftEmailId(null);
    }
  };

  if (showForm) {
    return (
      <GmailFetchRuleForm
        rule={selectedRule}
        onSuccess={() => {
          setShowForm(false);
          setSelectedRule(null);
          fetchRules();
        }}
        onCancel={() => {
          setShowForm(false);
          setSelectedRule(null);
        }}
      />
    );
  }

  const selectedRuleForLogs = viewingLogsRuleId ? rules.find(r => r.id === viewingLogsRuleId) : null;

  if (viewingLogsRuleId && selectedRuleForLogs) {
    return (
      <div className="p-6">
        <ExecutionLogsViewer
          ruleId={viewingLogsRuleId}
          ruleName={selectedRuleForLogs.name}
          onClose={() => setViewingLogsRuleId(null)}
        />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Reglas de Búsqueda Gmail | Moca</title>
      </Helmet>
      
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-8 h-8 text-violet-600" />
              Reglas de Búsqueda Gmail
            </h1>
            <p className="text-gray-600 mt-1">
              Configura reglas automáticas para obtener emails de Gmail
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Regla
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-600" />
              <p className="text-gray-600 mt-4">Cargando reglas...</p>
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay reglas configuradas
              </h3>
              <p className="text-gray-600 mb-4">
                Crea tu primera regla para obtener emails automáticamente
              </p>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Regla
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.enabled ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {rule.name}
                        <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
                          {rule.status}
                        </Badge>
                        {rule.enabled ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Habilitada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Deshabilitada
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          {formatDateRange(rule)}
                        </div>
                        {rule.query && (
                          <div className="flex items-center gap-2 text-sm">
                            <Filter className="w-4 h-4" />
                            {rule.query}
                          </div>
                        )}
                        {rule.scheduleInterval && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4" />
                            Cada {rule.scheduleInterval} minutos
                          </div>
                        )}
                        {rule.scheduleTime && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4" />
                            Todos los días a las {String(rule.scheduleTime.hour).padStart(2, '0')}:{String(rule.scheduleTime.minute).padStart(2, '0')}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingLogsRuleId(rule.id)}
                        title="Ver logs de ejecución"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExecute(rule.id)}
                        disabled={!rule.enabled || rule.status !== 'active' || executingRuleId === rule.id}
                        title="Ejecutar regla ahora"
                      >
                        {executingRuleId === rule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(rule)}
                      >
                        {rule.enabled ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Máximo de emails</p>
                      <p className="font-semibold">{rule.maxResults}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Ejecuciones</p>
                      <p className="font-semibold">{rule.metadata.totalRuns}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Emails obtenidos</p>
                      <p className="font-semibold">{rule.metadata.totalEmailsFetched}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Última ejecución</p>
                      <p className="font-semibold">
                        {rule.lastRunAt
                          ? new Date(rule.lastRunAt).toLocaleDateString()
                          : 'Nunca'}
                      </p>
                    </div>
                  </div>
                  {rule.metadata.lastError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>Último error:</strong> {rule.metadata.lastError}
                      </p>
                    </div>
                  )}

                  {/* Email List Section */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="ghost"
                        onClick={() => handleToggleEmails(rule.id)}
                        className="flex-1 justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Ver Emails ({rule.metadata.totalEmailsFetched || 0})
                        </span>
                        {expandedRuleId === rule.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      {expandedRuleId === rule.id && ruleEmails[rule.id] && ruleEmails[rule.id].length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleExecute(rule.id)}
                          disabled={executingRuleId === rule.id || !rule.enabled || rule.status !== 'active'}
                          className="ml-2"
                        >
                          {executingRuleId === rule.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Ejecutando...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Ejecutar Regla
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {expandedRuleId === rule.id && (
                      <div className="mt-4">
                        {loadingEmails[rule.id] ? (
                          <div className="p-8 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-600 mb-2" />
                            <p className="text-sm text-gray-600">Cargando emails...</p>
                          </div>
                        ) : ruleEmails[rule.id] && ruleEmails[rule.id].length > 0 ? (
                          <div className="space-y-4">
                            {/* Info banner when rule is executing */}
                            {executingRuleId === rule.id && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <p className="text-sm text-blue-800">
                                  Ejecutando regla... Procesando emails y generando borradores. Los resultados se actualizarán automáticamente.
                                </p>
                              </div>
                            )}
                            
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[200px]">De</TableHead>
                                  <TableHead>Asunto</TableHead>
                                  <TableHead className="w-[300px]">Vista previa</TableHead>
                                  <TableHead className="w-[150px]">Fecha</TableHead>
                                  <TableHead className="w-[100px]">Etiquetas</TableHead>
                                  <TableHead className="w-[150px]">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ruleEmails[rule.id].map((email) => {
                                  const emailDate = email.date ? new Date(email.date) : new Date();
                                  const formattedDate = emailDate.toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                  
                                  // Extract email address from "Name <email@domain.com>" format
                                  const extractEmail = (emailStr: string) => {
                                    const match = emailStr.match(/<([^>]+)>/);
                                    return match ? match[1] : emailStr;
                                  };

                                  const fromEmail = extractEmail(email.from);
                                  const displayName = email.from.replace(/<[^>]+>/g, '').trim() || fromEmail;

                                  return (
                                    <TableRow key={email.id} className="hover:bg-gray-50">
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <User className="w-4 h-4 text-gray-400" />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {displayName}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                              {fromEmail}
                                            </p>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <p className="text-sm font-medium text-gray-900">
                                          {email.subject || '(Sin asunto)'}
                                        </p>
                                      </TableCell>
                                      <TableCell>
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                          {email.snippet || '(Sin contenido)'}
                                        </p>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                          <Clock className="w-4 h-4" />
                                          <span>{formattedDate}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                          {email.labels && email.labels.slice(0, 2).map((label, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">
                                              {label}
                                            </Badge>
                                          ))}
                                          {email.labels && email.labels.length > 2 && (
                                            <Badge variant="outline" className="text-xs">
                                              +{email.labels.length - 2}
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleGenerateDraft(email)}
                                          disabled={generatingDraftEmailId === email.id}
                                          className="w-full"
                                        >
                                          {generatingDraftEmailId === email.id ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Generando...
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-4 h-4 mr-2" />
                                              Generar Borrador
                                            </>
                                          )}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                            </div>
                          </div>
                        ) : (
                          <div className="p-8 text-center border rounded-lg">
                            <Mail className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 mb-4">
                              No se encontraron emails para esta regla. Ejecuta la regla para buscar y procesar emails.
                            </p>
                            <Button
                              variant="default"
                              size="sm"
                              className="mt-4"
                              onClick={() => handleExecute(rule.id)}
                              disabled={executingRuleId === rule.id || !rule.enabled || rule.status !== 'active'}
                            >
                              {executingRuleId === rule.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Ejecutando...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Ejecutar Regla
                                </>
                              )}
                            </Button>
                            {executingRuleId === rule.id && (
                              <p className="text-xs text-gray-500 mt-2">
                                Procesando emails y generando borradores...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default GmailFetchRules;

