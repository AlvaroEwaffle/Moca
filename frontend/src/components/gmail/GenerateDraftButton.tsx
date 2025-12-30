import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { BACKEND_URL } from '@/utils/config';
import { FileText, Loader2 } from 'lucide-react';

interface GenerateDraftButtonProps {
  messageId: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const GenerateDraftButton = ({
  messageId,
  priority = 'medium',
  onSuccess,
  variant = 'outline',
  size = 'default'
}: GenerateDraftButtonProps) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!accessToken) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado para generar borradores',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/gmail/drafts/queue-from-message/${messageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ priority })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to queue draft');
      }

      toast({
        title: 'Éxito',
        description: 'Borrador encolado. Se generará automáticamente en breve.'
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo encolar el borrador',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4 mr-2" />
          Generar Borrador
        </>
      )}
    </Button>
  );
};

export default GenerateDraftButton;


