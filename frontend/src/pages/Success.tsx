import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { BACKEND_URL } from "@/utils/config";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

const Success = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [showRedirectMsg, setShowRedirectMsg] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let redirectTimeout: NodeJS.Timeout;
    const backendUrl = BACKEND_URL;
    if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');

    const fetchStatus = () => {
      if (!sessionId) return;
      fetch(`${backendUrl}/api/sessions/${sessionId}/payment-status`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'paid') {
            setPaymentStatus('paid');
            setShowRedirectMsg(true);
            // Redirigir en 3 segundos
            redirectTimeout = setTimeout(() => {
              navigate(`/premium-result/${sessionId}`);
            }, 3000);
          } else {
            setPaymentStatus('pending');
            setShowRedirectMsg(false);
          }
        })
        .catch(err => {
          console.error('[Success] Error fetching payment status:', err);
        });
    };

    fetchStatus(); // Primer fetch inmediato
    interval = setInterval(fetchStatus, 15000); // Polling cada 15s

    return () => {
      clearInterval(interval);
      clearTimeout(redirectTimeout);
    };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
      <div className="max-w-md mx-auto text-center px-4 animate-scale-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          ¡Pago exitoso!
        </h1>

        {paymentStatus === 'pending' && (
          <p className="text-lg text-gray-600 mb-8">
            El pago no se ha confirmado aún. Vamos a actualizar automáticamente.
          </p>
        )}
        {paymentStatus === 'paid' && showRedirectMsg && (
          <p className="text-lg text-green-600 mb-8">
            ¡Pago confirmado! Serás redirigido en 3 segundos...
          </p>
        )}

        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">ComoUsarChatGPT.cl</span>
        </div>
      </div>
    </div>
  );
};

export default Success;
