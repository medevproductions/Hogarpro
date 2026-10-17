-- ==============================================================================
-- HOGARPRO - SCRIPT DE BLINDAJE Y HARDENING DE SEGURIDAD (RLS POLICIES)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase para cerrar
-- cualquier brecha de lectura o escritura anónima desde el navegador.

-- 1. ACTIVAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS CRÍTICAS
ALTER TABLE IF EXISTS public.code_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streaming_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR POLÍTICAS PERMISIVAS ANTERIORES (QUE USABAN "USING (true)")
DROP POLICY IF EXISTS "Permitir lectura general de code_requests" ON public.code_requests;
DROP POLICY IF EXISTS "Permitir insercion a usuarios autenticados" ON public.code_requests;
DROP POLICY IF EXISTS "Permitir actualizacion a usuarios autenticados" ON public.code_requests;
DROP POLICY IF EXISTS "Public profile view" ON public.profiles;

-- 3. FUNCIONES DE AYUDA DE AUTORIZACIÓN (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'owner' OR role = 'admin') AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'seller' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. POLÍTICAS ESTRICTAS PARA "code_requests" (Protección de Códigos OTP y Enlaces)
-- Solo el Owner o el Vendedor asignado pueden ver las solicitudes de código
CREATE POLICY "RLS_code_requests_select" ON public.code_requests
FOR SELECT USING (
    public.is_owner() 
    OR (
        public.is_seller() AND (
            seller_id = auth.uid() 
            OR account_email IN (
                SELECT email FROM public.streaming_accounts 
                WHERE assigned_seller_id = auth.uid()
            )
        )
    )
);

-- Solo usuarios autenticados autorizados pueden insertar solicitudes
CREATE POLICY "RLS_code_requests_insert" ON public.code_requests
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    OR auth.role() = 'service_role'
);

-- Las actualizaciones (recepción de códigos de Google Apps Script) se ejecutan mediante service_role en el backend
CREATE POLICY "RLS_code_requests_update" ON public.code_requests
FOR UPDATE USING (
    public.is_owner() 
    OR auth.role() = 'service_role'
);

-- 5. POLÍTICAS ESTRICTAS PARA "streaming_accounts" (Cuentas Maestras)
-- Los vendedores solo ven sus cuentas asignadas, el Owner ve todas
CREATE POLICY "RLS_streaming_accounts_select" ON public.streaming_accounts
FOR SELECT USING (
    public.is_owner() 
    OR (public.is_seller() AND assigned_seller_id = auth.uid())
);

CREATE POLICY "RLS_streaming_accounts_all_owner" ON public.streaming_accounts
FOR ALL USING (
    public.is_owner()
);

-- 6. POLÍTICAS PARA "profiles"
CREATE POLICY "RLS_profiles_select" ON public.profiles
FOR SELECT USING (
    auth.uid() = id OR public.is_owner()
);

CREATE POLICY "RLS_profiles_update_self" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id
);

-- 7. REVOCAR PERMISOS DIRECTOS A USUARIOS ANÓNIMOS
REVOKE ALL ON public.code_requests FROM anon;
REVOKE ALL ON public.streaming_accounts FROM anon;
REVOKE ALL ON public.financial_transactions FROM anon;

-- Notificar éxito de blindaje
DO $$ BEGIN
    RAISE NOTICE '¡Políticas de Hardening RLS aplicadas con éxito en Supabase!';
END $$;
