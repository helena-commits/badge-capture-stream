import { useState, useEffect } from "react";
import { Download, Check, RefreshCw, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Photo {
  id: string;
  file_url: string;
  created_at: string;
  processed: boolean;
}

const PhotoList = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar fotos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      const response = await fetch(photo.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `badge_photo_${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download concluído",
        description: "Foto descarregada com sucesso",
      });
    } catch (error) {
      console.error('Error downloading photo:', error);
      toast({
        title: "Erro",
        description: "Erro ao descarregar a foto",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsProcessed = async (photoId: string) => {
    setProcessingIds(prev => new Set(prev).add(photoId));
    
    try {
      const { error } = await supabase
        .from('photos')
        .update({ processed: true })
        .eq('id', photoId);

      if (error) {
        throw error;
      }

      // Remove from local state
      setPhotos(prev => prev.filter(photo => photo.id !== photoId));
      
      toast({
        title: "Marcado como processado",
        description: "Foto removida da lista",
      });
    } catch (error) {
      console.error('Error marking as processed:', error);
      toast({
        title: "Erro",
        description: "Erro ao marcar como processado",
        variant: "destructive",
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchPhotos();

    // Set up realtime subscription
    const channel = supabase
      .channel('photos-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos'
        },
        (payload) => {
          const newPhoto = payload.new as Photo;
          if (!newPhoto.processed) {
            setPhotos(prev => [newPhoto, ...prev]);
            toast({
              title: "Nova foto!",
              description: "Foi recebida uma nova foto",
            });
          }
        }
      )
      .subscribe();

    // Auto-refresh every 5 seconds as fallback
    const interval = setInterval(fetchPhotos, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">A carregar fotos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Lista de Fotos para Crachás
            </h1>
            <p className="text-lg text-muted-foreground">
              {photos.length} foto(s) pendente(s) de processamento
            </p>
          </div>
          
          <Button
            onClick={fetchPhotos}
            variant="outline"
            size="lg"
            className="h-12"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Atualizar
          </Button>
        </div>

        {photos.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nenhuma foto pendente</h2>
              <p className="text-muted-foreground">
                As novas fotos aparecerão aqui automaticamente
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((photo) => (
              <Card key={photo.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={photo.file_url}
                      alt="Foto do participante"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {formatDate(photo.created_at)}
                      </Badge>
                      <Badge variant="secondary">
                        ID: {photo.id.slice(-8)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        onClick={() => handleDownload(photo)}
                        variant="outline"
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      
                      <Button
                        onClick={() => handleMarkAsProcessed(photo.id)}
                        variant="default"
                        className="w-full"
                        disabled={processingIds.has(photo.id)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {processingIds.has(photo.id) ? "A processar..." : "Marcar como Processado"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-8 p-6 bg-muted/50">
          <h3 className="font-semibold mb-3">Próximos passos:</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>1. Clique em "Download" para descarregar a foto</li>
            <li>2. Aceda a: <span className="font-mono bg-background px-2 py-1 rounded">https://growing-badges.lovable.app/</span></li>
            <li>3. Carregue a foto na aplicação de crachás</li>
            <li>4. Após gerar o crachá, clique em "Marcar como Processado"</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default PhotoList;