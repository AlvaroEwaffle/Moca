import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { Mail, Download, Loader2, CheckCircle2, AlertCircle, Calendar, Search, RefreshCw, Eye, Clock, User, Settings, FileText, Sparkles } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Helmet } from 'react-helmet';

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

interface FetchResult {
  processed: number;
  contacts: number;
  conversations: number;
  messages: number;
  errors: string[];
  emails?: EmailItem[];
}

const dateRangeOptions = [
  { value: '1d', label: 'Últimas 24 horas', days: 1 },
  { value: '7d', label: '7 días', days: 7 },
  { value: '30d', label: '30 días', days: 30 },
  { value: '90d', label: '90 días', days: 90 },
  { value: 'custom', label: 'Personalizado', days: 0 }
];

const GmailFetcher = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [dateRange, setDateRange] = useState('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [query, setQuery] = useState('');
  const [includeSpam, setIncludeSpam] = useState(false);
  
  // Build Gmail query from date range
  const buildQuery = (): string => {
    let gmailQuery = query.trim();
    
    // Add date filter
    const option = dateRangeOptions.find(opt => opt.value === dateRange);
    if (option && option.value !== 'custom') {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - option.days * 24 * 60 * 60 * 1000);
      const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
      
      if (gmailQuery) {
        gmailQuery += ` after:${dateStr}`;
      } else {
        gmailQuery = `after:${dateStr}`;
      }
    } else if (dateRange === 'custom' && customStartDate) {
      const dateStr = customStartDate.split('T')[0].replace(/-/g, '/');
      if (gmailQuery) {
        gmailQuery += ` after:${dateStr}`;
      } else {
        gmailQuery = `after:${dateStr}`;
      }
      
      if (customEndDate) {
        const endDateStr = customEndDate.split('T')[0].replace(/-/g, '/');
        gmailQuery += ` before:${endDateStr}`;
      }
    }
    
    return gmailQuery;
  };
  
  const handleFetch = async () => {
    if (!accessToken) {
      toast({
        title: 'Error',
        description: 'No hay sesión activa. Por favor, inicia sesión.',
        variant: 'destructive'
      });
      return;
    }
    
    setFetching(true);
    setError(null);
    setResult(null);
    
    try {
      const gmailQuery = buildQuery();
      
      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          maxResults,
          query: gmailQuery,
          includeSpam,
          labelIds: ['INBOX']
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener emails');
      }
      
      setResult(data.data);
      toast({
        title: 'Éxito',
        description: `Se procesaron ${data.data.processed} emails correctamente.`,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Error desconocido al obtener emails';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setFetching(false);
    }
  };
  
  const handleViewLeads = () => {
    navigate('/app/leads');
  };
  
  // Initialize custom dates for today and 7 days ago
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setCustomEndDate(today.toISOString().slice(0, 16));
    setCustomStartDate(sevenDaysAgo.toISOString().slice(0, 16));
  }, []);
  
  return (
    <>
      <Helmet>
        <title>Gmail Fetcher | Moca</title>
      </Helmet>
      
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="w-8 h-8 text-violet-600" />
              Gmail Fetcher
            </h1>
            <p className="text-gray-600 mt-1">
              Obtén y procesa emails de tu cuenta de Gmail
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/app/gmail/drafts')}>
              <FileText className="w-4 h-4 mr-2" />
              Borradores
            </Button>
            <Button variant="outline" onClick={() => navigate('/app/gmail/rules')}>
              <Settings className="w-4 h-4 mr-2" />
              Reglas
            </Button>
          </div>
        </div>
        
        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Búsqueda</CardTitle>
            <CardDescription>
              Configura los parámetros para obtener emails de Gmail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="dateRange" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Rango de Fechas
              </Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="customStartDate">Fecha de Inicio</Label>
                  <Input
                    id="customStartDate"
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customEndDate">Fecha de Fin</Label>
                  <Input
                    id="customEndDate"
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            {/* Max Results */}
            <div className="space-y-2">
              <Label htmlFor="maxResults">Número Máximo de Emails</Label>
              <Select value={maxResults.toString()} onValueChange={(value) => setMaxResults(parseInt(value))}>
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
                placeholder="Ej: label:important, label:work, is:unread, from:example@gmail.com"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Usa sintaxis de búsqueda de Gmail. La búsqueda por fecha se agregará automáticamente.
                <br />
                <span className="font-semibold">Ejemplos:</span> <code className="text-xs bg-gray-100 px-1 rounded">label:important</code>, <code className="text-xs bg-gray-100 px-1 rounded">label:work</code>, <code className="text-xs bg-gray-100 px-1 rounded">is:unread</code>, <code className="text-xs bg-gray-100 px-1 rounded">from:example@gmail.com</code>
              </p>
            </div>
            
            {/* Include Spam */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeSpam"
                checked={includeSpam}
                onChange={(e) => setIncludeSpam(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <Label htmlFor="includeSpam" className="cursor-pointer">
                Incluir spam y eliminados
              </Label>
            </div>
            
            {/* Fetch Button */}
            <Button
              onClick={handleFetch}
              disabled={fetching || loading}
              className="w-full"
              size="lg"
            >
              {fetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Obteniendo emails...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Obtener Emails
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        
        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Results Display */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Resultados del Procesamiento
              </CardTitle>
              <CardDescription>
                Resumen de los emails procesados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-violet-50 rounded-lg">
                  <p className="text-sm text-gray-600">Emails Procesados</p>
                  <p className="text-2xl font-bold text-violet-600">{result.processed}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Contactos Creados</p>
                  <p className="text-2xl font-bold text-blue-600">{result.contacts}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Conversaciones</p>
                  <p className="text-2xl font-bold text-green-600">{result.conversations}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">Mensajes Creados</p>
                  <p className="text-2xl font-bold text-orange-600">{result.messages}</p>
                </div>
              </div>
              
              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Errores encontrados ({result.errors.length}):</p>
                    <ul className="list-disc list-inside space-y-1">
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx} className="text-sm">{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-sm">... y {result.errors.length - 5} más</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Email List */}
              {result.emails && result.emails.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Emails Obtenidos</h3>
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
                        {result.emails.map((email) => {
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
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/queue`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${accessToken}`
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
                                      if (!response.ok) {
                                        throw new Error(data.error || 'Failed to queue draft');
                                      }

                                      toast({
                                        title: 'Éxito',
                                        description: 'Borrador encolado. Se generará automáticamente en breve.'
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: 'Error',
                                        description: error.message || 'No se pudo encolar el borrador',
                                        variant: 'destructive'
                                      });
                                    }
                                  }}
                                  className="w-full"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Generar Borrador
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleViewLeads} variant="outline" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />
                  Ver en Leads
                </Button>
                <Button onClick={handleFetch} variant="outline" className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Obtener Más
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default GmailFetcher;

