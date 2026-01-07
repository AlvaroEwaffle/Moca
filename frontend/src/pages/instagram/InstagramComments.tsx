import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/utils/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Loader2
} from "lucide-react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";

interface InstagramComment {
  _id: string;
  commentId: string;
  accountId: string;
  mediaId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'replied' | 'failed';
  replyText?: string;
  replyTimestamp?: string;
  createdAt: string;
  updatedAt: string;
}

interface InstagramAccount {
  accountId: string;
  accountName: string;
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

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchComments();
    }
  }, [selectedAccountId, page, statusFilter]);

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
      replied: { label: 'Respondido', color: 'bg-green-100 text-green-800', icon: CheckCircle },
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
        (comment.replyText && comment.replyText.toLowerCase().includes(searchLower))
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

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
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
                    <SelectItem value="replied">Respondido</SelectItem>
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
                    placeholder="Buscar por texto, usuario..."
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

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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

