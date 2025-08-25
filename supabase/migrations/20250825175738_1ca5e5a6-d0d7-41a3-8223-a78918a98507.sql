-- Add name and role columns to photos table
ALTER TABLE public.photos 
ADD COLUMN name TEXT,
ADD COLUMN role TEXT;