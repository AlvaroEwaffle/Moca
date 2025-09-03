import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Política de Privacidad - Moca</title>
        <meta name="description" content="Política de privacidad de Moca - Cómo recopilamos, usamos y protegemos tu información" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-xl">
            <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="text-3xl font-bold">Política de Privacidad</CardTitle>
              <p className="text-blue-100 mt-2">Última actualización: {new Date().toLocaleDateString('es-ES')}</p>
            </CardHeader>
            
            <CardContent className="p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Información que Recopilamos</h2>
                <div className="space-y-3 text-gray-700">
                  <p><strong>Información de Cuenta:</strong> Nombre, email, teléfono, nombre del negocio</p>
                  <p><strong>Datos de Instagram:</strong> Token de acceso, ID de cuenta, nombre de usuario</p>
                  <p><strong>Conversaciones:</strong> Mensajes intercambiados a través de Instagram</p>
                  <p><strong>Datos de Uso:</strong> Estadísticas de uso, logs de actividad</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Cómo Usamos tu Información</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Proporcionar y mejorar nuestros servicios de automatización de Instagram</p>
                  <p>• Procesar y responder a mensajes de clientes</p>
                  <p>• Generar respuestas automáticas usando inteligencia artificial</p>
                  <p>• Mantener la seguridad y prevenir fraudes</p>
                  <p>• Cumplir con obligaciones legales</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Compartir Información</h2>
                <div className="space-y-3 text-gray-700">
                  <p>No vendemos, alquilamos ni compartimos tu información personal con terceros, excepto:</p>
                  <p>• Con proveedores de servicios que nos ayudan a operar (como OpenAI para IA)</p>
                  <p>• Cuando sea requerido por ley</p>
                  <p>• Para proteger nuestros derechos legales</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Seguridad de Datos</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Encriptamos datos sensibles en tránsito y en reposo</p>
                  <p>• Usamos tokens de acceso seguros para Instagram</p>
                  <p>• Implementamos medidas de seguridad técnicas y organizacionales</p>
                  <p>• Acceso limitado solo a personal autorizado</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Tus Derechos</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• <strong>Acceso:</strong> Solicitar una copia de tus datos</p>
                  <p>• <strong>Rectificación:</strong> Corregir datos inexactos</p>
                  <p>• <strong>Eliminación:</strong> Solicitar la eliminación de tus datos</p>
                  <p>• <strong>Portabilidad:</strong> Exportar tus datos</p>
                  <p>• <strong>Oposición:</strong> Oponerte al procesamiento de tus datos</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Retención de Datos</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Conservamos tus datos mientras tu cuenta esté activa</p>
                  <p>• Los datos se eliminan automáticamente al cerrar tu cuenta</p>
                  <p>• Algunos datos pueden conservarse por períodos legales requeridos</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Cookies y Tecnologías Similares</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Usamos cookies para mantener tu sesión activa</p>
                  <p>• Cookies de análisis para mejorar nuestros servicios</p>
                  <p>• Puedes desactivar cookies en tu navegador</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Cambios a esta Política</h2>
                <div className="space-y-3 text-gray-700">
                  <p>• Te notificaremos sobre cambios significativos</p>
                  <p>• La fecha de actualización se muestra en la parte superior</p>
                  <p>• El uso continuado implica aceptación de los cambios</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Contacto</h2>
                <div className="space-y-3 text-gray-700">
                  <p>Para preguntas sobre esta política de privacidad:</p>
                  <p><strong>Email:</strong> privacy@moca.com</p>
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

export default PrivacyPolicy;
