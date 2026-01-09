import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  MessageCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  User, 
  Calendar,
  Reply,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  Key,
  Bot
} from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InstagramComment {
  _id: string;
  commentId: string;
  accountId: string;
  mediaId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'detected' | 'replied' | 'omitted' | 'failed';
  matchedKeyword?: string;
  matchedRuleId?: string;
  replyText?: string;
  replyTimestamp?: string;
  dmSent?: boolean;
  dmTimestamp?: string;
  dmFailed?: boolean;
  dmFailureReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface InstagramAccount {
  accountId: string;
  accountName: string;
}

interface CommentAutoReplyRule {
  _id: string;
  accountId: string;
  userId: string;
  keyword: string;
  responseMessage: string;
  enabled: boolean;
  sendDM: boolean;
  dmMessage?: string;
  createdAt: string;
  updatedAt: string;
}

const InstagramComments = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  
  // Auto-reply configuration state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [rules, setRules] = useState<CommentAutoReplyRule[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  // Rule management state
  const [editingRule, setEditingRule] = useState<CommentAutoReplyRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ 
    keyword: '', 
    responseMessage: '', 
    enabled: true,
    sendDM: false,
    dmMessage: ''
  });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchComments();
      fetchConfig();
      fetchRules();
      // Reset form when account changes
      setEditingRule(null);
      setRuleForm({ keyword: '', responseMessage: '', enabled: true, sendDM: false, dmMessage: '' });
      setShowRuleForm(false);
      setPage(1); // Reset to first page
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchComments();
    }
  }, [page, statusFilter]);

  const fetchConfig = async () => {
    if (!selectedAccountId) return;
    
    setLoadingConfig(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/instagram/comments/settings/${selectedAccountId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAutoReplyEnabled(data.data?.enabled || false);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchRules = async () => {
    if (!selectedAccountId) return;
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/instagram/comments/rules/${selectedAccountId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRules(data.data?.rules || []);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las reglas",
        variant: "destructive"
      });
    }
  };

  const saveConfig = async () => {
    if (!selectedAccountId) return;
    
    setSavingConfig(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/instagram/comments/settings/${selectedAccountId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({ enabled: autoReplyEnabled })
        }
      );

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Configuración guardada correctamente"
        });
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const saveRule = async () => {
    if (!selectedAccountId || !ruleForm.keyword.trim() || !ruleForm.responseMessage.trim()) {
      toast({
        title: "Error",
        description: "Keyword y mensaje de respuesta son requeridos",
        variant: "destructive"
      });
      return;
    }

    // Validate DM message if sendDM is enabled
    if (ruleForm.sendDM && !ruleForm.dmMessage.trim()) {
      toast({
        title: "Error",
        description: "Mensaje de DM es requerido cuando 'Enviar DM' está activado",
        variant: "destructive"
      });
      return;
    }

    setSavingConfig(true);
    try {
        const url = editingRule
        ? `${BACKEND_URL}/api/instagram/comments/rules/${editingRule._id}`
        : `${BACKEND_URL}/api/instagram/comments/rules/${selectedAccountId}`;
      
      const method = editingRule ? 'PUT' : 'POST';

      const body = editingRule 
        ? { 
            keyword: ruleForm.keyword, 
            responseMessage: ruleForm.responseMessage, 
            enabled: ruleForm.enabled,
            sendDM: ruleForm.sendDM,
            dmMessage: ruleForm.sendDM ? ruleForm.dmMessage : undefined
          }
        : { 
            keyword: ruleForm.keyword, 
            responseMessage: ruleForm.responseMessage, 
            enabled: ruleForm.enabled,
            sendDM: ruleForm.sendDM,
            dmMessage: ruleForm.sendDM ? ruleForm.dmMessage : undefined
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: editingRule ? "Regla actualizada correctamente" : "Regla creada correctamente"
        });
        setRuleForm({ keyword: '', responseMessage: '', enabled: true, sendDM: false, dmMessage: '' });
        setEditingRule(null);
        setShowRuleForm(false);
        fetchRules();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save rule');
      }
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la regla",
        variant: "destructive"
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta regla?')) return;

    setSavingConfig(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/instagram/comments/rules/${ruleId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Regla eliminada correctamente"
        });
        fetchRules();
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la regla",
        variant: "destructive"
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const startEditingRule = (rule: CommentAutoReplyRule) => {
    setEditingRule(rule);
    setRuleForm({
      keyword: rule.keyword,
      responseMessage: rule.responseMessage,
      enabled: rule.enabled,
      sendDM: rule.sendDM || false,
      dmMessage: rule.dmMessage || ''
    });
    setShowRuleForm(true);
  };

  const cancelRuleForm = () => {
    setEditingRule(null);
    setRuleForm({ keyword: '', responseMessage: '', enabled: true, sendDM: false, dmMessage: '' });
    setShowRuleForm(false);
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/instagram/accounts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedAccounts = data.data?.accounts || [];
        setAccounts(fetchedAccounts);
        
        // Auto-select first account if available
        if (fetchedAccounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(fetchedAccounts[0].accountId);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas de Instagram",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!selectedAccountId) return;
    
    setFetching(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }

      const response = await fetch(
        `${BACKEND_URL}/api/instagram/comments/comments/${selectedAccountId}?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(data.data?.comments || []);
        setTotalPages(data.data?.pagination?.pages || 1);
        setTotal(data.data?.pagination?.total || 0);
      } else {
        throw new Error('Failed to fetch comments');
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los comentarios",
        variant: "destructive"
      });
    } finally {
      setFetching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { label: 'Procesando', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
      detected: { label: 'Detectado', color: 'bg-purple-100 text-purple-800', icon: Eye },
      replied: { label: 'Respondido', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      omitted: { label: 'Omitido', color: 'bg-gray-100 text-gray-800', icon: EyeOff },
      failed: { label: 'Error', color: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };


  const filteredComments = comments.filter(comment => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        comment.text.toLowerCase().includes(searchLower) ||
        comment.username.toLowerCase().includes(searchLower) ||
        (comment.replyText && comment.replyText.toLowerCase().includes(searchLower)) ||
        (comment.matchedKeyword && comment.matchedKeyword.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const selectedAccount = accounts.find(acc => acc.accountId === selectedAccountId);

  return (
    <>
      <Helmet>
        <title>Comentarios de Instagram - Moca</title>
      </Helmet>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-8 h-8 text-violet-600" />
              Comentarios de Instagram
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona y visualiza todos los comentarios recibidos en tus publicaciones
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchComments}
              disabled={fetching || !selectedAccountId}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Configuration Section */}
        {selectedAccountId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-600" />
                  <CardTitle className="text-lg">Respuestas Automáticas a Comentarios</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfig(!showConfig)}
                >
                  {showConfig ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            {showConfig && (
              <CardContent className="space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="autoReplyToggle" className="text-base font-medium cursor-pointer">
                      Auto-respuestas a comentarios
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Activa las respuestas automáticas basadas en palabras clave
                    </p>
                  </div>
                  <Switch
                    id="autoReplyToggle"
                    checked={autoReplyEnabled}
                    onCheckedChange={async (checked) => {
                      setAutoReplyEnabled(checked);
                      // Save immediately when toggled
                      setSavingConfig(true);
                      try {
                        const response = await fetch(
                          `${BACKEND_URL}/api/instagram/comments/settings/${selectedAccountId}`,
                          {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                            },
                            body: JSON.stringify({ enabled: checked })
                          }
                        );

                        if (response.ok) {
                          toast({
                            title: "Éxito",
                            description: checked ? "Auto-respuestas activadas" : "Auto-respuestas desactivadas"
                          });
                        } else {
                          throw new Error('Failed to save config');
                        }
                      } catch (error) {
                        console.error('Error saving config:', error);
                        toast({
                          title: "Error",
                          description: "No se pudo guardar la configuración",
                          variant: "destructive"
                        });
                        // Revert on error
                        setAutoReplyEnabled(!checked);
                      } finally {
                        setSavingConfig(false);
                      }
                    }}
                    disabled={savingConfig || loadingConfig}
                  />
                </div>

                {autoReplyEnabled && (
                  <>
                    {/* Rules List */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Label className="text-base font-medium">Reglas de Respuesta</Label>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingRule(null);
                            setRuleForm({ keyword: '', responseMessage: '', enabled: true, sendDM: false, dmMessage: '' });
                            setShowRuleForm(true);
                          }}
                          disabled={rules.length >= 10}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Regla
                        </Button>
                      </div>

                      {rules.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                          <Key className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No hay reglas configuradas</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Agrega al menos una regla para activar las respuestas automáticas
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rules.map((rule) => (
                            <div
                              key={rule._id}
                              className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-violet-300 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge variant={rule.enabled ? "default" : "secondary"}>
                                    {rule.enabled ? "Activa" : "Inactiva"}
                                  </Badge>
                                  {rule.sendDM && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      <Reply className="w-3 h-3 mr-1" />
                                      DM
                                    </Badge>
                                  )}
                                  <span className="font-medium text-gray-900">
                                    Si contiene: <span className="text-violet-600">"{rule.keyword}"</span>
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  → {rule.responseMessage}
                                </p>
                                {rule.sendDM && rule.dmMessage && (
                                  <p className="text-xs text-blue-600 mt-1 line-clamp-1">
                                    💬 DM: {rule.dmMessage}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingRule(rule)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteRule(rule._id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {showRuleForm && (
                        <Card className="mt-4 border-violet-200">
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingRule ? 'Editar Regla' : 'Nueva Regla'}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label htmlFor="keyword">Palabra Clave</Label>
                              <Input
                                id="keyword"
                                placeholder="Ej: precio, horario, contacto"
                                value={ruleForm.keyword}
                                onChange={(e) => setRuleForm(prev => ({ ...prev, keyword: e.target.value.toLowerCase().trim() }))}
                                className="mt-2"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                El sistema buscará esta palabra en los comentarios (sin distinguir mayúsculas/minúsculas)
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="responseMessage">Mensaje de Respuesta</Label>
                              <Textarea
                                id="responseMessage"
                                placeholder="Mensaje que se enviará cuando se detecte la palabra clave"
                                value={ruleForm.responseMessage}
                                onChange={(e) => setRuleForm(prev => ({ ...prev, responseMessage: e.target.value }))}
                                className="mt-2"
                                rows={3}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Respuesta pública al comentario
                              </p>
                            </div>

                            {/* Send DM Section */}
                            <div className="border-t pt-4 space-y-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="sendDM"
                                  checked={ruleForm.sendDM}
                                  onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, sendDM: checked, dmMessage: checked ? prev.dmMessage : '' }))}
                                />
                                <Label htmlFor="sendDM" className="cursor-pointer font-medium">
                                  Enviar DM después de responder al comentario
                                </Label>
                              </div>
                              {ruleForm.sendDM && (
                                <div>
                                  <Label htmlFor="dmMessage">Mensaje de DM</Label>
                                  <Textarea
                                    id="dmMessage"
                                    placeholder="Mensaje privado que se enviará por DM después de responder al comentario"
                                    value={ruleForm.dmMessage}
                                    onChange={(e) => setRuleForm(prev => ({ ...prev, dmMessage: e.target.value }))}
                                    className="mt-2"
                                    rows={3}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Este mensaje se enviará automáticamente por mensaje directo después de responder al comentario
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 border-t pt-4">
                              <Switch
                                id="ruleEnabled"
                                checked={ruleForm.enabled}
                                onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, enabled: checked }))}
                              />
                              <Label htmlFor="ruleEnabled" className="cursor-pointer">
                                Regla activa
                              </Label>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={saveRule}
                                disabled={
                                  savingConfig || 
                                  !ruleForm.keyword.trim() || 
                                  !ruleForm.responseMessage.trim() ||
                                  (ruleForm.sendDM && !ruleForm.dmMessage.trim())
                                }
                                size="sm"
                              >
                                {savingConfig ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                {editingRule ? 'Actualizar' : 'Crear'} Regla
                              </Button>
                              <Button
                                variant="outline"
                                onClick={cancelRuleForm}
                                size="sm"
                                disabled={savingConfig}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtros</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  Tabla
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  Tarjetas
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Account Selector */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Cuenta de Instagram</label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.accountId} value={account.accountId}>
                        {account.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="sm:w-48">
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="processing">Procesando</SelectItem>
                    <SelectItem value="detected">Detectado</SelectItem>
                    <SelectItem value="replied">Respondido</SelectItem>
                    <SelectItem value="omitted">Omitido</SelectItem>
                    <SelectItem value="failed">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por texto, usuario, keyword..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments List */}
        {!selectedAccountId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Selecciona una cuenta de Instagram para ver los comentarios</p>
            </CardContent>
          </Card>
        ) : fetching && comments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-violet-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Cargando comentarios...</p>
            </CardContent>
          </Card>
        ) : filteredComments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No se encontraron comentarios</p>
              {searchTerm && (
                <p className="text-sm text-gray-500 mt-2">
                  Intenta con otros términos de búsqueda o filtros
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === 'table' ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Comentario</TableHead>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Respuesta</TableHead>
                          <TableHead>DM</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredComments.map((comment) => (
                          <TableRow key={comment._id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">@{comment.username}</span>
                                </div>
                                <p className="text-sm text-gray-600 max-w-md line-clamp-2">
                                  {comment.text}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {comment.matchedKeyword ? (
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                                  <Key className="w-3 h-3 mr-1" />
                                  {comment.matchedKeyword}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {comment.replyText ? (
                                <div className="max-w-md">
                                  <p className="text-sm text-gray-900 line-clamp-3">
                                    {comment.replyText}
                                  </p>
                                  {comment.replyTimestamp && (
                                    <span className="text-xs text-gray-500 mt-1 block">
                                      {formatDate(comment.replyTimestamp)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {comment.dmSent ? (
                                <div className="space-y-1">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Enviado
                                  </Badge>
                                  {comment.dmTimestamp && (
                                    <span className="text-xs text-gray-500 block">
                                      {formatDate(comment.dmTimestamp)}
                                    </span>
                                  )}
                                </div>
                              ) : comment.dmFailed ? (
                                <div className="space-y-1">
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Fallido
                                  </Badge>
                                  {comment.dmFailureReason && (
                                    <span className="text-xs text-red-600 block" title={comment.dmFailureReason}>
                                      {comment.dmFailureReason.length > 30 
                                        ? comment.dmFailureReason.substring(0, 30) + '...' 
                                        : comment.dmFailureReason}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(comment.status)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-600">
                                {formatDate(comment.timestamp)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredComments.map((comment) => (
                  <Card key={comment._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Header: User, Status, Date */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-violet-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 truncate">
                                  @{comment.username}
                                </p>
                                {getStatusBadge(comment.status)}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(comment.timestamp)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Comment Text */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-start gap-2">
                            <MessageCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-900 flex-1 whitespace-pre-wrap">{comment.text}</p>
                          </div>
                        </div>

                        {/* Keyword Match Info */}
                        {comment.matchedKeyword && (
                          <div className="flex items-center gap-2 text-sm">
                            <Key className="w-4 h-4 text-violet-600" />
                            <span className="text-gray-600">Keyword detectada:</span>
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                              {comment.matchedKeyword}
                            </Badge>
                          </div>
                        )}

                        {/* Reply from Moca */}
                        {comment.replyText && (
                          <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
                            <div className="flex items-start gap-2">
                              <Reply className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-violet-900">Respuesta de Moca</span>
                                  {comment.replyTimestamp && (
                                    <span className="text-xs text-violet-600">
                                      {formatDate(comment.replyTimestamp)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-900 whitespace-pre-wrap">{comment.replyText}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* DM Status */}
                        {(comment.dmSent || comment.dmFailed) && (
                          <div className={`rounded-lg p-4 border ${
                            comment.dmSent 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-start gap-2">
                              <Bot className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                comment.dmSent ? 'text-green-600' : 'text-red-600'
                              }`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-sm font-medium ${
                                    comment.dmSent ? 'text-green-900' : 'text-red-900'
                                  }`}>
                                    Mensaje Directo (DM)
                                  </span>
                                  {comment.dmSent && comment.dmTimestamp && (
                                    <span className="text-xs text-green-600">
                                      {formatDate(comment.dmTimestamp)}
                                    </span>
                                  )}
                                  {comment.dmFailed && comment.dmFailureTimestamp && (
                                    <span className="text-xs text-red-600">
                                      {formatDate(comment.dmFailureTimestamp)}
                                    </span>
                                  )}
                                </div>
                                {comment.dmSent ? (
                                  <p className="text-sm text-green-700">
                                    ✅ DM enviado exitosamente
                                  </p>
                                ) : comment.dmFailed ? (
                                  <div>
                                    <p className="text-sm text-red-700 font-medium">
                                      ❌ DM falló al enviar
                                    </p>
                                    {comment.dmFailureReason && (
                                      <p className="text-xs text-red-600 mt-1">
                                        Razón: {comment.dmFailureReason}
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total} comentarios
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || fetching}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || fetching}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default InstagramComments;

