import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { FileText, RefreshCw, Eye, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Play, Mail, User } from 'lucide-react';
import { Helmet } from 'react-helmet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GmailDraftDetail from './GmailDraftDetail';

interface Draft {
  id: string;
  emailId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  draftContent?: string;
  draftId?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    generationTime?: number;
    tags?: string[];
  };
}

const GmailDrafts = () => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts?status=${statusFilter === 'all' ? '' : statusFilter}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch drafts');
      setDrafts(data.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load drafts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast, statusFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleProcess = async (draftId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draftId}/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process draft');
      
      toast({
        title: 'Éxito',
        description: 'Draft processing started'
      });
      fetchDrafts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process draft',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      generating: 'default',
      completed: 'default',
      failed: 'destructive'
    };
    
    const icons = {
      pending: Clock,
      generating: Loader2,
      completed: CheckCircle2,
      failed: XCircle
    };
    
    const labels = {
      pending: 'Pendiente',
      generating: 'Generando',
      completed: 'Completado',
      failed: 'Fallido'
    };
    
    const Icon = icons[status as keyof typeof icons] || Clock;
    const isAnimating = status === 'generating';
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {isAnimating ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Icon className="w-3 h-3 mr-1" />
        )}
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    
    const labels = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente'
    };
    
    return (
      <Badge variant="outline" className={colors[priority] || colors.medium}>
        {labels[priority as keyof typeof labels] || priority}
      </Badge>
    );
  };

  if (selectedDraft) {
    return (
      <GmailDraftDetail
        draft={selectedDraft}
        onBack={() => setSelectedDraft(null)}
        onRefresh={fetchDrafts}
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>Borradores Gmail | Moca</title>
      </Helmet>
      
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-8 h-8 text-violet-600" />
              Borradores de Email
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona los borradores de email generados por IA
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="generating">Generando</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchDrafts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-600" />
              <p className="text-gray-600 mt-4">Cargando borradores...</p>
            </CardContent>
          </Card>
        ) : drafts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay borradores
              </h3>
              <p className="text-gray-600">
                {statusFilter === 'all' 
                  ? 'No se han generado borradores aún'
                  : `No hay borradores con estado "${statusFilter}"`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {drafts.map((draft) => (
              <Card key={draft.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 mb-2">
                        <Mail className="w-5 h-5 text-violet-600" />
                        {draft.subject || 'Sin asunto'}
                      </CardTitle>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4" />
                          {draft.fromName || draft.fromEmail}
                          {draft.fromName && (
                            <span className="text-gray-400">({draft.fromEmail})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(draft.status)}
                          {getPriorityBadge(draft.priority)}
                          {draft.retryCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Reintentos: {draft.retryCount}
                            </Badge>
                          )}
                        </div>
                        {draft.metadata?.generationTime && (
                          <div className="text-xs text-gray-500">
                            Tiempo de generación: {Math.round(draft.metadata.generationTime / 1000)}s
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {draft.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProcess(draft.id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Procesar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDraft(draft)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {draft.error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">Error:</p>
                          <p className="text-sm text-red-700">{draft.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.draftContent && draft.status === 'completed' && (
                    <div className="p-4 bg-gray-50 rounded-md border">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Borrador generado:</p>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {draft.draftContent}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <span>Creado: {new Date(draft.createdAt).toLocaleString()}</span>
                    {draft.updatedAt !== draft.createdAt && (
                      <span>Actualizado: {new Date(draft.updatedAt).toLocaleString()}</span>
                    )}
                    {draft.draftId && (
                      <Badge variant="outline" className="text-xs">
                        Draft ID: {draft.draftId.slice(0, 8)}...
                      </Badge>
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

export default GmailDrafts;


