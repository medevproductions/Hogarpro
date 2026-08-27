-- Ejecuta esto en Supabase SQL Editor para asegurar que la columna action_type exista:
ALTER TABLE IF EXISTS public.code_requests 
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'login_code';

ALTER TABLE IF EXISTS public.code_requests 
ADD COLUMN IF NOT EXISTS extracted_code TEXT;

ALTER TABLE IF EXISTS public.code_requests 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente';
