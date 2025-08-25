import { useState, useEffect, useCallback } from "react";
import { Download, Check, RefreshCw, Image as ImageIcon, ExternalLink, Copy, Search, Volume2, LogOut, Settings, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Photo {
  id: string;
  file_url: string;
  file_path?: string;
  created_at: string;
  processed: boolean;
  name?: string;
  role?: string;
}

type FilterType = 'pending' | 'processed' | 'all';

// Module-level variables for auto-open functionality
let generatorWin: Window | null = null;
let lastAutoOpenTime = 0;

const PhotoList = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Auto-open state management
  const [autoOpenGenerator, setAutoOpenGenerator] = useState(() => {
    return localStorage.getItem('autoOpenGenerator') === 'true';
  });
  const [isArmed, setIsArmed] = useState(() => {
    return sessionStorage.getItem('generatorArmed') === 'true';
  });

  const BADGES_URL = import.meta.env.VITE_BADGES_URL || 'https://growing-badges.lovable.app';

  // Auto-open utility functions
  const getBadgeUrl = async (photo: Photo): Promise<string> => {
    const photoUrl = await getPhotoUrl(photo);
    const params = new URLSearchParams();
    params.append('photo', photoUrl);
    if (photo.name) params.append('name', photo.name);
    if (photo.role) params.append('role', photo.role);
    return `${BADGES_URL}/?${params.toString()}`;
  };

  const getOpenedPhotosSet = (): Set<string> => {
    const stored = sessionStorage.getItem('openedPhotos');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  const markPhotoAsOpened = (photoId: string) => {
    const openedPhotos = getOpenedPhotosSet();
    openedPhotos.add(photoId);
    sessionStorage.setItem('openedPhotos', JSON.stringify([...openedPhotos]));
  };

  const handleAutoOpenToggle = (checked: boolean) => {
    setAutoOpenGenerator(checked);
    localStorage.setItem('autoOpenGenerator', checked.toString());
    
    if (!checked) {
      // When disabling, also disarm and clear session data
      setIsArmed(false);
      sessionStorage.removeItem('generatorArmed');
      generatorWin = null;
    }
  };

  const armAutoOpen = () => {
    try {
      generatorWin = window.open('about:blank', '_blank');
      if (generatorWin) {
        setIsArmed(true);
        sessionStorage.setItem('generatorArmed', 'true');
        toast({
          title: "Auto-abrir armado",
          description: "Próximas fotos abrirão automaticamente no gerador",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível abrir aba. Verifique se pop-ups estão permitidos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao armar auto-abertura",
        variant: "destructive",
      });
    }
  };

  const disarmAutoOpen = () => {
    setIsArmed(false);
    sessionStorage.removeItem('generatorArmed');
    if (generatorWin && !generatorWin.closed) {
      generatorWin.close();
    }
    generatorWin = null;
    toast({
      title: "Auto-abrir desarmado",
      description: "As próximas fotos não abrirão automaticamente",
    });
  };

  const autoOpenBadgeGenerator = async (photo: Photo) => {
    // Rate limiting: minimum 2 seconds between auto-opens
    const now = Date.now();
    if (now - lastAutoOpenTime < 2000) {
      console.log('Rate limiting: skipping auto-open due to recent activity');
      return;
    }

    // Check if this photo was already opened in this session
    const openedPhotos = getOpenedPhotosSet();
    if (openedPhotos.has(photo.id)) {
      console.log('Photo already auto-opened in this session:', photo.id);
      return;
    }

    try {
      const badgeUrl = await getBadgeUrl(photo);
      
      if (generatorWin && !generatorWin.closed) {
        // Use existing armed window
        generatorWin.location.href = badgeUrl;
        generatorWin.focus();
      } else {
        // Fallback to new window
        const newWin = window.open(badgeUrl, '_blank');
        if (!newWin) {
          toast({
            title: "Bloqueio de pop-up",
            description: "Não foi possível abrir automaticamente. Clique no botão para abrir manualmente.",
            variant: "destructive",
          });
          return;
        }
        generatorWin = newWin;
      }
      
      markPhotoAsOpened(photo.id);
      lastAutoOpenTime = now;
      
      toast({
        title: "📋 Gerador aberto automaticamente",
        description: "Nova foto carregada no gerador de crachás",
      });
    } catch (error) {
      console.error('Error in auto-open:', error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir automaticamente. Clique no botão.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('list_auth_ok');
    window.location.reload();
  };

  const fetchPhotos = useCallback(async (filterType: FilterType = filter) => {
    try {
      let query = supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType === 'pending') {
        query = query.eq('processed', false);
      } else if (filterType === 'processed') {
        query = query.eq('processed', true);
      }

      const { data, error } = await query;

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
  }, [filter]);

  const getPhotoUrl = async (photo: Photo): Promise<string> => {
    // If bucket is public, use file_url directly
    if (photo.file_url) {
      return photo.file_url;
    }

    // If bucket is private and we have file_path, create signed URL
    if (photo.file_path) {
      try {
        const { data, error } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.file_path, 900); // 15 minutes

        if (error) throw error;
        return data.signedUrl;
      } catch (error) {
        console.error('Error creating signed URL:', error);
        return photo.file_url; // Fallback to file_url
      }
    }

    return photo.file_url;
  };

  const handleOpenInBadgeGenerator = async (photo: Photo) => {
    try {
      const photoUrl = await getPhotoUrl(photo);
      const params = new URLSearchParams();
      params.append('photo', photoUrl);
      if (photo.name) params.append('name', photo.name);
      if (photo.role) params.append('role', photo.role);
      const badgeUrl = `${BADGES_URL}/?${params.toString()}`;
      window.open(badgeUrl, '_blank');
    } catch (error) {
      console.error('Error opening badge generator:', error);
      toast({
        title: "Erro",
        description: "Erro ao abrir gerador de crachás",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async (photo: Photo) => {
    try {
      const photoUrl = await getPhotoUrl(photo);
      await navigator.clipboard.writeText(photoUrl);
      toast({
        title: "Link copiado",
        description: "URL da foto copiado para a área de transferência",
      });
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        title: "Erro",
        description: "Erro ao copiar link",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      const photoUrl = await getPhotoUrl(photo);
      const response = await fetch(photoUrl);
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

      // Remove from local state if viewing pending only
      if (filter === 'pending') {
        setPhotos(prev => prev.filter(photo => photo.id !== photoId));
      } else {
        // Update local state to reflect processed status
        setPhotos(prev => prev.map(photo => 
          photo.id === photoId ? { ...photo, processed: true } : photo
        ));
      }
      
      toast({
        title: "Marcado como processado",
        description: "Foto marcada como processada",
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

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const filteredPhotos = photos.filter(photo => {
    if (searchTerm) {
      const fileName = photo.file_path || photo.file_url;
      return fileName.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

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
        async (payload) => {
          const newPhoto = payload.new as Photo;
          setPhotos(prev => [newPhoto, ...prev]);
          
          // Play notification sound and show visual alert
          playNotificationSound();
          toast({
            title: "📸 Nova foto recebida!",
            description: `Foto criada em ${formatDate(newPhoto.created_at)}`,
          });

          // Auto-open badge generator if enabled and conditions are met
          if (autoOpenGenerator && !newPhoto.processed && isArmed) {
            await autoOpenBadgeGenerator(newPhoto);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPhotos]);

  useEffect(() => {
    fetchPhotos(filter);
  }, [filter, fetchPhotos]);

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

  const pendingCount = photos.filter(p => !p.processed).length;
  const processedCount = photos.filter(p => p.processed).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Área de Gestão de Fotos
            </h1>
            <p className="text-lg text-muted-foreground">
              Gestão de fotos para geração de crachás
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => fetchPhotos()}
              variant="outline"
              size="lg"
              className="h-12"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Atualizar
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="secondary"
              size="lg"
              className="h-12"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Pesquisar por nome do ficheiro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Volume2 className="w-4 h-4" />
              <span>Som ativo para novas fotos</span>
            </div>
          </div>

          {/* Auto-open Controls */}
          <Card className="p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={autoOpenGenerator}
                      onCheckedChange={handleAutoOpenToggle}
                      id="auto-open"
                    />
                    <label htmlFor="auto-open" className="text-sm font-medium cursor-pointer">
                      Auto-abrir gerador
                    </label>
                    {autoOpenGenerator && isArmed && (
                      <Badge variant="default" className="ml-2">
                        AUTO
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {autoOpenGenerator 
                      ? (isArmed 
                          ? "Próximas fotos abrirão automaticamente no gerador" 
                          : "Clique em 'Armar' para ativar abertura automática"
                        )
                      : "Desativado - fotos não abrirão automaticamente"
                    }
                  </p>
                </div>
              </div>
              
              {autoOpenGenerator && (
                <div className="flex gap-2">
                  {!isArmed ? (
                    <Button
                      onClick={armAutoOpen}
                      variant="default"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Armar auto-abrir
                    </Button>
                  ) : (
                    <Button
                      onClick={disarmAutoOpen}
                      variant="secondary"
                      size="sm"
                    >
                      <Square className="w-4 h-4 mr-1" />
                      Parar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="pending">
                A Processar ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="processed">
                Processadas ({processedCount})
              </TabsTrigger>
              <TabsTrigger value="all">
                Todas ({photos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-6">
              {filteredPhotos.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">
                      {filter === 'pending' ? 'Nenhuma foto pendente' : 
                       filter === 'processed' ? 'Nenhuma foto processada' : 
                       'Nenhuma foto encontrada'}
                    </h2>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Tente ajustar o termo de pesquisa' : 'As novas fotos aparecerão aqui automaticamente'}
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPhotos.map((photo) => (
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
                            <Badge variant={photo.processed ? "default" : "secondary"}>
                              {photo.processed ? "Processada" : "Pendente"}
                            </Badge>
                            {autoOpenGenerator && !photo.processed && isArmed && (
                              <Badge variant="default" className="ml-1">
                                AUTO
                              </Badge>
                            )}
                          </div>
                          
                          {(photo.name || photo.role) && (
                            <div className="text-sm space-y-1">
                              {photo.name && (
                                <div className="font-medium text-foreground">{photo.name}</div>
                              )}
                              {photo.role && (
                                <div className="text-muted-foreground">{photo.role}</div>
                              )}
                            </div>
                          )}
                          
                          <div className="text-xs text-muted-foreground">
                            ID: {photo.id.slice(-8)}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              onClick={() => handleOpenInBadgeGenerator(photo)}
                              variant="default"
                              className="w-full"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Abrir no Gerador de Crachás
                            </Button>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => handleCopyLink(photo)}
                                variant="outline"
                                size="sm"
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                Copiar Link
                              </Button>
                              
                              <Button
                                onClick={() => handleDownload(photo)}
                                variant="outline"
                                size="sm"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                            </div>
                            
                            {!photo.processed && (
                              <Button
                                onClick={() => handleMarkAsProcessed(photo.id)}
                                variant="secondary"
                                className="w-full"
                                disabled={processingIds.has(photo.id)}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                {processingIds.has(photo.id) ? "A processar..." : "Marcar como Processada"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Card className="mt-8 p-6 bg-muted/50">
          <h3 className="font-semibold mb-3">Fluxo de trabalho:</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>1. <strong>Abrir no Gerador de Crachás</strong> - Abre automaticamente a aplicação com a foto carregada</li>
            <li>2. <strong>Alternativa:</strong> Copiar link ou fazer download da foto</li>
            <li>3. Gerar o crachá na aplicação: <span className="font-mono bg-background px-2 py-1 rounded">{BADGES_URL}</span></li>
            <li>4. <strong>Marcar como Processada</strong> após concluir o crachá</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default PhotoList;