import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Calendar,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  Mail,
  Save,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { BACKEND_URL } from "@/utils/config";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DayWindow {
  start: string;
  end: string;
}

type WorkingHours = Partial<Record<DayKey, DayWindow>>;

interface CalendarConfig {
  connected: boolean;
  accountId: string;
  userId?: string;
  provider?: string;
  status?: "disconnected" | "connected" | "error" | "revoked";
  googleEmail?: string;
  calendarId?: string;
  timezone?: string;
  workingHours?: WorkingHours;
  bufferMinutes?: number;
  meetingDurationMinutes?: number;
  ccEmails?: string[];
  enabled?: boolean;
  error?: string;
  lastSyncedAt?: string;
}

interface InstagramAccount {
  id: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { start: "09:00", end: "18:00" },
  tue: { start: "09:00", end: "18:00" },
  wed: { start: "09:00", end: "18:00" },
  thu: { start: "09:00", end: "18:00" },
  fri: { start: "09:00", end: "18:00" },
};

const COMMON_TIMEZONES = [
  "America/Santiago",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

const CalendarIntegration = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Form state
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [timezone, setTimezone] = useState("America/Santiago");
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [ccEmailsText, setCcEmailsText] = useState("");
  const [enabled, setEnabled] = useState(true);

  const accessToken = useMemo(() => localStorage.getItem("accessToken"), []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchConfig(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Handle OAuth callback redirect (?calendar=connected&accountId=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const calendarStatus = params.get("calendar");
    const accountIdFromQuery = params.get("accountId");

    if (calendarStatus === "connected") {
      toast({
        title: "Google Calendar conectado",
        description: "La integración se configuró correctamente.",
      });
      if (accountIdFromQuery) {
        setSelectedAccountId(accountIdFromQuery);
      }
      navigate("/app/integrations", { replace: true });
    } else if (calendarStatus === "error") {
      toast({
        title: "Error al conectar",
        description: params.get("message") || "Intenta nuevamente.",
        variant: "destructive",
      });
      navigate("/app/integrations", { replace: true });
    }
  }, [location.search]);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/instagram/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      const list: InstagramAccount[] = data?.data?.accounts || [];
      setAccounts(list);
      if (list.length > 0 && !selectedAccountId) {
        setSelectedAccountId(list[0].accountId);
      } else if (list.length === 0) {
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Error fetching accounts:", err);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas de Instagram",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchConfig = async (accountId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/calendar/config?accountId=${encodeURIComponent(accountId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || "Error al cargar configuración");
      }
      const cfg: CalendarConfig = json.data;
      setConfig(cfg);

      if (cfg.workingHours && Object.keys(cfg.workingHours).length > 0) {
        setWorkingHours(cfg.workingHours);
      } else {
        setWorkingHours(DEFAULT_WORKING_HOURS);
      }
      setTimezone(cfg.timezone || "America/Santiago");
      setMeetingDurationMinutes(cfg.meetingDurationMinutes ?? 30);
      setBufferMinutes(cfg.bufferMinutes ?? 15);
      setCcEmailsText((cfg.ccEmails || []).join(", "));
      setEnabled(cfg.enabled ?? true);
    } catch (err: any) {
      console.error("Error loading config:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo cargar la configuración",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!selectedAccountId) {
      toast({
        title: "Selecciona una cuenta",
        description: "Necesitas una cuenta de Instagram para conectar el calendario",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/calendar/google/connect?accountId=${encodeURIComponent(selectedAccountId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      if (!json?.success || !json?.data?.authUrl) {
        throw new Error(json?.error || "No se pudo obtener el URL de autorización");
      }
      window.location.href = json.data.authUrl;
    } catch (err: any) {
      console.error("Connect error:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo iniciar OAuth",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedAccountId) return;
    if (!confirm("¿Desconectar Google Calendar? Se revocarán los tokens.")) return;

    setDisconnecting(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/calendar/google?accountId=${encodeURIComponent(selectedAccountId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Error al desconectar");
      toast({ title: "Desconectado", description: "Google Calendar fue desconectado" });
      await fetchConfig(selectedAccountId);
    } catch (err: any) {
      console.error("Disconnect error:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo desconectar",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedAccountId) return;

    // Validate working hours
    for (const [day, win] of Object.entries(workingHours)) {
      if (!win) continue;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(win.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(win.end)) {
        toast({
          title: "Horario inválido",
          description: `Formato HH:mm requerido (${day})`,
          variant: "destructive",
        });
        return;
      }
      if (win.start >= win.end) {
        toast({
          title: "Horario inválido",
          description: `La hora de inicio debe ser menor que la de fin (${day})`,
          variant: "destructive",
        });
        return;
      }
    }

    const ccEmails = Array.from(
      new Set(
        ccEmailsText
          .split(/[,\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const invalidCcEmail = ccEmails.find((email) => !/^\S+@\S+\.\S+$/.test(email));
    if (invalidCcEmail) {
      toast({
        title: "Correo inválido",
        description: `Revisa el CC: ${invalidCcEmail}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/calendar/config?accountId=${encodeURIComponent(selectedAccountId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workingHours,
            timezone,
            meetingDurationMinutes,
            bufferMinutes,
            ccEmails,
            enabled,
          }),
        }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Error al guardar");
      toast({ title: "Guardado", description: "Configuración actualizada" });
      await fetchConfig(selectedAccountId);
    } catch (err: any) {
      console.error("Save error:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const toggleDay = (day: DayKey, active: boolean) => {
    setWorkingHours((prev) => {
      const next = { ...prev };
      if (active) {
        next[day] = prev[day] || { start: "09:00", end: "18:00" };
      } else {
        delete next[day];
      }
      return next;
    });
  };

  const updateDayTime = (day: DayKey, field: "start" | "end", value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || { start: "09:00", end: "18:00" }), [field]: value },
    }));
  };

  const isConnected = config?.status === "connected";

  // ── Render ───────────────────────────────────────────────────────────────────

  if (accounts.length === 0 && !loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Primero debes conectar una cuenta de Instagram en{" "}
            <a href="/app/instagram" className="underline font-medium">
              Configuración → Instagram
            </a>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <Helmet>
        <title>Integraciones - Moca</title>
      </Helmet>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
        <p className="text-sm text-gray-600 mt-1">
          Conecta Google Calendar para que el agente pueda agendar reuniones automáticamente.
        </p>
      </div>

      {/* Account selector */}
      {accounts.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cuenta Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.accountId} value={a.accountId}>
                    {a.accountName || a.accountId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Connection card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Calendar</CardTitle>
                <CardDescription>
                  OAuth 2.0 · Scopes: calendar + calendar.events
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-600">
                Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : isConnected ? (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{config?.googleEmail || "—"}</span>
              </div>
              {config?.lastSyncedAt && (
                <div className="text-xs text-gray-500">
                  Última sincronización: {new Date(config.lastSyncedAt).toLocaleString()}
                </div>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Al conectar, el agente podrá consultar disponibilidad y crear eventos con enlaces de Google Meet.
              </p>
              {config?.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{config.error}</AlertDescription>
                </Alert>
              )}
              <Button onClick={handleConnect} disabled={connecting || !selectedAccountId}>
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4 mr-2" />
                )}
                Conectar Google Calendar
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Config card (only when connected) */}
      {isConnected && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración de agenda</CardTitle>
            <CardDescription>
              Define tus horarios disponibles, duración de reuniones y zona horaria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
              <div>
                <Label className="text-sm font-medium">Integración activa</Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  Cuando está desactivada, el agente no ofrecerá agendar reuniones.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Meeting settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Duración (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={meetingDurationMinutes}
                  onChange={(e) => setMeetingDurationMinutes(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Buffer entre reuniones (min)</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Zona horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm">CC de invitación</Label>
              <Textarea
                value={ccEmailsText}
                onChange={(e) => setCcEmailsText(e.target.value)}
                placeholder="alvaro@empresa.com, operaciones@empresa.com"
                className="mt-1 min-h-20"
              />
              <p className="text-xs text-gray-600 mt-1">
                Estos correos recibirán invitación en cada reunión creada por el agente.
              </p>
            </div>

            {/* Working hours */}
            <div>
              <Label className="text-sm font-medium">Horario disponible</Label>
              <p className="text-xs text-gray-600 mt-0.5 mb-3">
                Define en qué días y horas aceptas reuniones. Los días desactivados no ofrecerán slots.
              </p>
              <div className="space-y-2">
                {DAYS.map(({ key, label }) => {
                  const win = workingHours[key];
                  const active = !!win;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-2 rounded border bg-white"
                    >
                      <div className="flex items-center gap-2 w-32">
                        <Switch
                          checked={active}
                          onCheckedChange={(v) => toggleDay(key, v)}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      {active ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={win!.start}
                            onChange={(e) => updateDayTime(key, "start", e.target.value)}
                            className="w-32"
                          />
                          <span className="text-sm text-gray-500">a</span>
                          <Input
                            type="time"
                            value={win!.end}
                            onChange={(e) => updateDayTime(key, "end", e.target.value)}
                            className="w-32"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No disponible</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Guardar configuración
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarIntegration;
