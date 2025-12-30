import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { Loader2, X, Filter, Search, Calendar, AlertCircle, CheckCircle, Info, AlertTriangle, Download } from 'lucide-react';
// import { format } from 'date-fns';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

interface LogSession {
  sessionId: string;
  startTime: string;
  endTime: string;
  logs: LogEntry[];
  summary: {
    totalLogs: number;
    errors: number;
    warnings: number;
    emailsProcessed?: number;
    draftsCreated?: number;
    decisions?: Array<{ type: string; count: number }>;
  };
}

interface ExecutionLogsViewerProps {
  ruleId: string;
  ruleName: string;
  onClose?: () => void;
}

const ExecutionLogsViewer = ({ ruleId, ruleName, onClose }: ExecutionLogsViewerProps) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchLogs = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        limit: '500'
      });
      if (filterLevel !== 'all') {
        params.append('level', filterLevel);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`${BACKEND_URL}/api/gmail/fetch-rules/${ruleId}/logs?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch logs');
      
      setLogs(data.data.logs || []);
      setSessions(data.data.sessions || []);
      
      // Auto-select most recent session
      if (data.data.sessions && data.data.sessions.length > 0) {
        setSelectedSession(data.data.sessions[0].sessionId);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [ruleId, selectedDate, filterLevel, searchQuery, accessToken]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      error: 'destructive',
      warn: 'outline',
      info: 'default',
      debug: 'secondary'
    };
    
    return (
      <Badge variant={variants[level] || 'secondary'} className="text-xs">
        {level.toUpperCase()}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return timestamp;
    }
  };

  const displayLogs = selectedSession 
    ? sessions.find(s => s.sessionId === selectedSession)?.logs || []
    : logs;

  const filteredLogs = displayLogs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !JSON.stringify(log.metadata || {}).toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const exportLogs = () => {
    const logText = filteredLogs.map(log => {
      const metadataStr = log.metadata ? ` | ${JSON.stringify(log.metadata)}` : '';
      return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.service}] ${log.message}${metadataStr}`;
    }).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gmail-logs-${ruleId}-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Logs de Ejecución: {ruleName}
            </CardTitle>
            <CardDescription>
              Detalles de emails procesados y decisiones tomadas
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="error">Errores</SelectItem>
              <SelectItem value="warn">Advertencias</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar en logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Sessions Summary */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card
                key={session.sessionId}
                className={`cursor-pointer transition-all ${
                  selectedSession === session.sessionId
                    ? 'ring-2 ring-violet-500'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedSession(session.sessionId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {formatTimestamp(session.startTime)}
                    </span>
                    {selectedSession === session.sessionId && (
                      <CheckCircle className="w-4 h-4 text-violet-500" />
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Logs:</span>
                      <span className="font-medium">{session.summary.totalLogs}</span>
                    </div>
                    {session.summary.emailsProcessed !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Emails:</span>
                        <span className="font-medium">{session.summary.emailsProcessed}</span>
                      </div>
                    )}
                    {session.summary.draftsCreated !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Borradores:</span>
                        <span className="font-medium text-green-600">{session.summary.draftsCreated}</span>
                      </div>
                    )}
                    {session.summary.errors > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Errores:</span>
                        <span className="font-medium text-red-600">{session.summary.errors}</span>
                      </div>
                    )}
                    {session.summary.warnings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Advertencias:</span>
                        <span className="font-medium text-yellow-600">{session.summary.warnings}</span>
                      </div>
                    )}
                    {session.summary.decisions && session.summary.decisions.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs text-gray-500 mb-1">Decisiones:</div>
                        {session.summary.decisions.map((d, i) => (
                          <div key={i} className="text-xs">
                            <Badge variant="outline" className="text-xs mr-1">
                              {d.type}: {d.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedSession ? 'Logs de Sesión' : 'Todos los Logs'} ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No se encontraron logs para los filtros seleccionados
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-4">
                  {filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        log.level === 'error'
                          ? 'bg-red-50 border-red-200'
                          : log.level === 'warn'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getLevelBadge(log.level)}
                            <Badge variant="outline" className="text-xs">
                              {log.service}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {log.message}
                          </p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                                Ver detalles
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default ExecutionLogsViewer;

