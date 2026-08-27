-- ==============================================================================
-- TABLA DE GESTIÓN Y SOLICITUDES DE CÓDIGOS DE STREAMING (5 ACCIONES)
-- ==============================================================================

-- 1. Crear tipo ENUM para las 5 acciones solicitadas
DO $$ BEGIN
    CREATE TYPE action_code_type AS ENUM (
        'actualizar',      -- 1. Actualizar hogar / red principal
        'temporal',        -- 2. Temporal / Código Hogar (TV fuera de casa)
        'login_code',      -- 3. Código de inicio de sesión (OTP numérico)
        'login_confirm',   -- 4. Confirmación de inicio de sesión (Enlace / Aceptar acceso)
        'reset_password'   -- 5. Restablecer contraseña
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status_type AS ENUM (
        'pendiente',       -- Esperando que llegue el correo
        'completado',      -- Código / enlace recibido y asignado
        'expirado'         -- Tiempo límite alcanzado
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla code_requests
CREATE TABLE IF NOT EXISTS public.code_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_email TEXT NOT NULL,
    action_type action_code_type NOT NULL,
    extracted_code TEXT,                -- Código de 4/6/8 dígitos o URL de confirmación
    status request_status_type NOT NULL DEFAULT 'pendiente',
    seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    raw_subject TEXT,                   -- Asunto del correo (opcional, para auditoría)
    raw_body TEXT,                      -- Fragmento del cuerpo del correo (opcional)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '5 minutes')
);

-- 3. Índices de optimización para consultas rápidas por correo y estado
CREATE INDEX IF NOT EXISTS idx_code_requests_lookup 
ON public.code_requests (account_email, action_type, status);

CREATE INDEX IF NOT EXISTS idx_code_requests_created 
ON public.code_requests (created_at DESC);

-- 4. Habilitar Supabase Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_requests;

-- 5. Políticas de Seguridad RLS
ALTER TABLE public.code_requests ENABLE ROW LEVEL SECURITY;

-- Permitir lectura y creación a usuarios autenticados
CREATE POLICY "Permitir lectura general de code_requests" 
ON public.code_requests FOR SELECT USING (true);

CREATE POLICY "Permitir insercion a usuarios autenticados" 
ON public.code_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizacion a usuarios autenticados" 
ON public.code_requests FOR UPDATE USING (true);
