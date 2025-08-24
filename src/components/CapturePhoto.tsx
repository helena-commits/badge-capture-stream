import { useState, useRef } from "react";
import { Camera, Check, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CapturePhoto = () => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!capturedImage || !fileInputRef.current?.files?.[0]) {
      toast({
        title: "Erro",
        description: "Nenhuma foto foi capturada",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const file = fileInputRef.current.files[0];
      const fileName = `photo_${Date.now()}.${file.type.split('/')[1]}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Insert record into database
      const { error: dbError } = await supabase
        .from('photos')
        .insert([
          {
            file_url: publicUrl,
          }
        ]);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Sucesso!",
        description: "Foto guardada com sucesso",
        variant: "default",
      });

      // Reset for next photo
      setCapturedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Erro",
        description: "Erro ao guardar a foto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Captura de Crachás
            </h1>
            <p className="text-lg text-muted-foreground">
              Tire uma foto para criar o crachá
            </p>
          </div>

          {!capturedImage ? (
            <div className="text-center">
              <div className="mb-8">
                <Camera className="w-24 h-24 mx-auto text-primary mb-4" />
              </div>
              
              <Button
                onClick={handleTakePhoto}
                size="lg"
                variant="tablet"
                className="w-full h-24 text-xl"
              >
                <Camera className="w-8 h-8 mr-3" />
                Tirar Foto
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Pré-visualização</h2>
                <div className="relative max-w-md mx-auto">
                  <img
                    src={capturedImage}
                    alt="Foto capturada"
                    className="w-full rounded-lg shadow-md"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Button
                  onClick={handleRetake}
                  variant="outline"
                  size="lg"
                  className="h-16 text-lg"
                  disabled={isUploading}
                >
                  <RotateCcw className="w-6 h-6 mr-2" />
                  Tirar Novamente
                </Button>
                
                <Button
                  onClick={handleSave}
                  size="lg"
                  variant="tablet"
                  className="h-16 text-lg"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Upload className="w-6 h-6 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-6 h-6 mr-2" />
                  )}
                  {isUploading ? "A guardar..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Instruções:</h3>
            <ol className="text-sm text-muted-foreground space-y-1">
              <li>1. Clique em "Tirar Foto" para abrir a câmara</li>
              <li>2. Tire uma foto clara do participante</li>
              <li>3. Clique em "Guardar" para enviar para a equipa</li>
              <li>4. A equipa irá gerar o crachá em: <br/>
                  <span className="font-mono text-xs">https://growing-badges.lovable.app/</span>
              </li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CapturePhoto;