import { useState } from "react";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react";

const DataDeletion = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const handleDataDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      // Simular envío de solicitud (aquí conectarías con tu backend)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage("Solicitud de eliminación de datos enviada correctamente. Te contactaremos en 24-48 horas para confirmar la eliminación.");
      setMessageType("success");
      setEmail("");
    } catch (error) {
      setMessage("Error al enviar la solicitud. Por favor, inténtalo de nuevo o contáctanos directamente.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Eliminación de Datos - Moca</title>
        <meta name="description" content="Solicita la eliminación de tus datos personales de Moca" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-xl">
            <CardHeader className="text-center bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-lg">
              <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                <Trash2 className="w-8 h-8" />
                Eliminación de Datos
              </CardTitle>
              <p className="text-red-100 mt-2">Ejercer tu derecho al olvido</p>
            </CardHeader>
            
            <CardContent className="p-8 space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> La eliminación de datos es irreversible. Una vez eliminados, no podrás recuperar tu cuenta ni los datos asociados.
                </AlertDescription>
              </Alert>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">¿Qué datos eliminamos?</h2>
                <div className="space-y-3 text-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p><strong>Datos de Cuenta:</strong></p>
                      <p>• Información personal (nombre, email, teléfono)</p>
                      <p>• Datos del negocio</p>
                      <p>• Configuraciones de la cuenta</p>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Datos de Instagram:</strong></p>
                      <p>• Tokens de acceso</p>
                      <p>• Configuración de webhooks</p>
                      <p>• Configuraciones del agente IA</p>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Conversaciones:</strong></p>
                      <p>• Historial de mensajes</p>
                      <p>• Contactos y leads</p>
                      <p>• Métricas de conversación</p>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Datos de Uso:</strong></p>
                      <p>• Logs de actividad</p>
                      <p>• Estadísticas de uso</p>
                      <p>• Datos de facturación</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Proceso de Eliminación</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">1</div>
                    <div>
                      <p className="font-semibold">Solicitud</p>
                      <p className="text-gray-600">Envías tu solicitud con el email de tu cuenta</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">2</div>
                    <div>
                      <p className="font-semibold">Verificación</p>
                      <p className="text-gray-600">Verificamos tu identidad y confirmamos la solicitud</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">3</div>
                    <div>
                      <p className="font-semibold">Eliminación</p>
                      <p className="text-gray-600">Eliminamos todos tus datos de nuestros sistemas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">4</div>
                    <div>
                      <p className="font-semibold">Confirmación</p>
                      <p className="text-gray-600">Te notificamos que la eliminación se completó</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Solicitar Eliminación</h2>
                <form onSubmit={handleDataDeletionRequest} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email de tu cuenta Moca</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Debe ser el mismo email que usaste para registrarte
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading || !email}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Solicitar Eliminación de Datos
                      </>
                    )}
                  </Button>
                </form>

                {message && (
                  <Alert className={messageType === "success" ? "border-green-200 bg-green-50" : messageType === "error" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}>
                    {messageType === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription className={messageType === "success" ? "text-green-800" : messageType === "error" ? "text-red-800" : "text-blue-800"}>
                      {message}
                    </AlertDescription>
                  </Alert>
                )}
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Alternativas</h2>
                <div className="space-y-3 text-gray-700">
                  <p><strong>¿No quieres eliminar todo?</strong> También puedes:</p>
                  <p>• <strong>Desconectar Instagram:</strong> Mantener tu cuenta pero desconectar Instagram</p>
                  <p>• <strong>Pausar cuenta:</strong> Suspender temporalmente tu cuenta</p>
                  <p>• <strong>Exportar datos:</strong> Descargar una copia de tus datos antes de eliminar</p>
                  <p>• <strong>Contactar soporte:</strong> Hablar con nuestro equipo sobre opciones específicas</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tiempo de Procesamiento</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• <strong>Solicitud:</strong> Inmediata</p>
                  <p>• <strong>Verificación:</strong> 24-48 horas</p>
                  <p>• <strong>Eliminación:</strong> 7-14 días hábiles</p>
                  <p>• <strong>Confirmación:</strong> Inmediata tras completar</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contacto Directo</h2>
                <div className="space-y-3 text-gray-700">
                  <p>Si prefieres contactarnos directamente:</p>
                  <p><strong>Email:</strong> privacy@moca.com</p>
                  <p><strong>Asunto:</strong> "Solicitud de Eliminación de Datos"</p>
                  <p><strong>Incluir:</strong> Email de tu cuenta y confirmación de que deseas eliminar todos los datos</p>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default DataDeletion;
