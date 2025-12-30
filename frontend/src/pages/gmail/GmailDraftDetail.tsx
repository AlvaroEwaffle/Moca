import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { ArrowLeft, Mail, User, Clock, CheckCircle2, XCircle, Loader2, Play, Copy, ExternalLink, AlertCircle } from 'lucide-react';

interface Draft {
  id: string;
  emailId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  originalBody: string;
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

interface GmailDraftDetailProps {
  draft: Draft;
  onBack: () => void;
  onRefresh: () => void;
}

const GmailDraftDetail = ({ draft, onBack, onRefresh }: GmailDraftDetailProps) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!accessToken) return;
    setProcessing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/${draft.id}/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process draft');
      
      toast({
        title: 'Éxito',
        description: 'Draft processing started'
      });
      
      // Refresh after a short delay
      setTimeout(() => {
        onRefresh();
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process draft',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyDraft = () => {
    if (draft.draftContent) {
      navigator.clipboard.writeText(draft.draftContent);
      toast({
        title: 'Copiado',
        description: 'Borrador copiado al portapapeles'
      });
    }
  };

  const handleOpenGmail = () => {
    if (draft.draftId) {
      window.open(`https://mail.google.com/mail/u/0/#drafts/${draft.draftId}`, '_blank');
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-8 h-8 text-violet-600" />
            Detalle del Borrador
          </h1>
        </div>
        {draft.status === 'pending' && (
          <Button onClick={handleProcess} disabled={processing}>
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Procesar Ahora
              </>
            )}
          </Button>
        )}
        {draft.status === 'completed' && draft.draftId && (
          <Button variant="outline" onClick={handleOpenGmail}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir en Gmail
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Asunto</p>
              <p className="text-sm text-gray-900">{draft.subject || 'Sin asunto'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <User className="w-4 h-4" />
                De
              </p>
              <p className="text-sm text-gray-900">{draft.fromName || draft.fromEmail}</p>
              {draft.fromName && (
                <p className="text-xs text-gray-500">{draft.fromEmail}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Estado</p>
              <div className="flex items-center gap-2">
                {getStatusBadge(draft.status)}
                {draft.priority && (
                  <Badge variant="outline">
                    Prioridad: {draft.priority}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Email ID</p>
              <p className="text-xs text-gray-500 font-mono">{draft.emailId}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Thread ID</p>
              <p className="text-xs text-gray-500 font-mono">{draft.threadId}</p>
            </div>
          </CardContent>
        </Card>

        {/* Draft Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Borrador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Estado</p>
              {getStatusBadge(draft.status)}
            </div>
            {draft.draftId && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Gmail Draft ID</p>
                <p className="text-xs text-gray-500 font-mono break-all">{draft.draftId}</p>
              </div>
            )}
            {draft.metadata?.generationTime && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Tiempo de Generación</p>
                <p className="text-sm text-gray-900">
                  {Math.round(draft.metadata.generationTime / 1000)} segundos
                </p>
              </div>
            )}
            {draft.retryCount > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Reintentos</p>
                <p className="text-sm text-gray-900">{draft.retryCount}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Creado
              </p>
              <p className="text-sm text-gray-900">{new Date(draft.createdAt).toLocaleString()}</p>
            </div>
            {draft.updatedAt !== draft.createdAt && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Actualizado</p>
                <p className="text-sm text-gray-900">{new Date(draft.updatedAt).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Original Email */}
      <Card>
        <CardHeader>
          <CardTitle>Email Original</CardTitle>
          <CardDescription>Contenido del email recibido</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded-md border">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm text-gray-900">
                {draft.originalBody || 'Sin contenido'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Draft */}
      {draft.draftContent ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Borrador Generado</CardTitle>
                <CardDescription>Respuesta generada por IA</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyDraft}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
                {draft.status === 'completed' && draft.draftId && (
                  <Button variant="outline" size="sm" onClick={handleOpenGmail}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir en Gmail
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-violet-50 rounded-md border border-violet-200">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-900">
                  {draft.draftContent}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : draft.status === 'failed' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error al Generar Borrador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">Error:</p>
                  <p className="text-sm text-red-700">{draft.error || 'Error desconocido'}</p>
                  {draft.retryCount > 0 && (
                    <p className="text-xs text-red-600 mt-2">
                      Se han realizado {draft.retryCount} intentos
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Borrador Generado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-8 text-center text-gray-500">
              {draft.status === 'generating' ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-violet-600" />
                  <p>Generando borrador...</p>
                </>
              ) : (
                <p>El borrador aún no ha sido generado</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GmailDraftDetail;


