-- Create photos table for badge capture system
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read photos (for public access)
CREATE POLICY "Anyone can view photos" 
ON public.photos 
FOR SELECT 
USING (true);

-- Create policy to allow anyone to insert photos (for tablet capture)
CREATE POLICY "Anyone can insert photos" 
ON public.photos 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to update photos (for marking as processed)
CREATE POLICY "Anyone can update photos" 
ON public.photos 
FOR UPDATE 
USING (true);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true);

-- Create storage policies for photo uploads
CREATE POLICY "Anyone can view photos in bucket" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'photos');

CREATE POLICY "Anyone can upload photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'photos');

-- Add index for better performance
CREATE INDEX idx_photos_created_at ON public.photos(created_at DESC);
CREATE INDEX idx_photos_processed ON public.photos(processed);

-- Enable realtime for photos table
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;