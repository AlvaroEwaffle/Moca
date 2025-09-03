import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Términos de Servicio - Moca</title>
        <meta name="description" content="Términos de servicio de Moca - Condiciones de uso de nuestra plataforma" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-xl">
            <CardHeader className="text-center bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
              <CardTitle className="text-3xl font-bold">Términos de Servicio</CardTitle>
              <p className="text-green-100 mt-2">Última actualización: {new Date().toLocaleDateString('es-ES')}</p>
            </CardHeader>
            
            <CardContent className="p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Aceptación de los Términos</h2>
                <div className="space-y-3 text-gray-700">
                  <p>Al acceder y usar Moca, aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no debes usar nuestro servicio.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Descripción del Servicio</h2>
                <div className="space-y-3 text-gray-700">
                  <p>Moca es una plataforma que automatiza la gestión de mensajes de Instagram para empresas, proporcionando:</p>
                  <p>• Respuestas automáticas a mensajes de Instagram</p>
                  <p>• Gestión de conversaciones con clientes</p>
                  <p>• Análisis de leads y calificación automática</p>
                  <p>• Integración con Instagram Business API</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Cuenta de Usuario</h2>
                <div className="space-y-3 text-gray-700">
                  <p><strong>Registro:</strong> Debes proporcionar información precisa y actualizada</p>
                  <p><strong>Responsabilidad:</strong> Eres responsable de mantener la confidencialidad de tu cuenta</p>
                  <p><strong>Edad:</strong> Debes tener al menos 18 años para usar el servicio</p>
                  <p><strong>Una cuenta por persona:</strong> No puedes crear múltiples cuentas</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Uso Aceptable</h2>
                <div className="space-y-3 text-gray-700">
                  <p><strong>Permitido:</strong></p>
                  <p>• Usar el servicio para automatizar respuestas legítimas de negocio</p>
                  <p>• Conectar tu cuenta de Instagram Business</p>
                  <p>• Gestionar conversaciones con clientes reales</p>
                  
                  <p><strong>Prohibido:</strong></p>
                  <p>• Spam o mensajes no solicitados</p>
                  <p>• Contenido ilegal, ofensivo o inapropiado</p>
                  <p>• Violar términos de servicio de Instagram</p>
                  <p>• Intentar hackear o comprometer la seguridad</p>
                  <p>• Usar el servicio para actividades fraudulentas</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Integración con Instagram</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Debes cumplir con los Términos de Servicio de Instagram</p>
                  <p>• Solo puedes conectar cuentas de Instagram que poseas</p>
                  <p>• Respetamos los límites de la API de Instagram</p>
                  <p>• No somos responsables por cambios en la API de Instagram</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Facturación y Pagos</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Los precios están claramente indicados en la plataforma</p>
                  <p>• Los pagos se procesan de forma segura</p>
                  <p>• No ofrecemos reembolsos por servicios ya utilizados</p>
                  <p>• Puedes cancelar tu suscripción en cualquier momento</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Propiedad Intelectual</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Moca y su contenido son propiedad de [Tu Empresa]</p>
                  <p>• No puedes copiar, modificar o distribuir nuestro software</p>
                  <p>• Conservas los derechos sobre tu contenido y mensajes</p>
                  <p>• Nos otorgas licencia para procesar tus datos según estos términos</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Limitación de Responsabilidad</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• El servicio se proporciona "tal como está"</p>
                  <p>• No garantizamos disponibilidad 100% del servicio</p>
                  <p>• No somos responsables por pérdidas de negocio o datos</p>
                  <p>• Nuestra responsabilidad se limita al monto pagado por el servicio</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Terminación</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Puedes cancelar tu cuenta en cualquier momento</p>
                  <p>• Podemos suspender cuentas que violen estos términos</p>
                  <p>• Al cancelar, tus datos se eliminarán según nuestra política de privacidad</p>
                  <p>• Las obligaciones de pago pendientes permanecen vigentes</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Modificaciones</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Podemos modificar estos términos en cualquier momento</p>
                  <p>• Te notificaremos sobre cambios significativos</p>
                  <p>• El uso continuado implica aceptación de los nuevos términos</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Ley Aplicable</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Estos términos se rigen por las leyes de [Tu País/Estado]</p>
                  <p>• Cualquier disputa se resolverá en los tribunales competentes</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Contacto</h2>
                <div className="space-y-3 text-gray-700">
                  <p>Para preguntas sobre estos términos:</p>
                  <p><strong>Email:</strong> legal@moca.com</p>
                  <p><strong>Dirección:</strong> [Tu dirección de empresa]</p>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
