-- Add file_path column to photos table
ALTER TABLE public.photos 
ADD COLUMN file_path TEXT;