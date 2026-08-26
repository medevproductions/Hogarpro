-- ==============================================================================
-- STREAMHUB PRO - ESQUEMA DE BASE DE DATOS SUPABASE (POSTGRESQL)
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('owner', 'seller', 'client');
CREATE TYPE account_status AS ENUM ('available', 'assigned', 'expired', 'suspended', 'maintenance');
CREATE TYPE code_type AS ENUM ('access_code', 'temp_code', 'household_update', 'verification', 'reset_password');
CREATE TYPE code_status AS ENUM ('pending', 'received', 'expired');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'commission');

-- 3. TABLA DE PERFILES (Vinculada a Supabase Auth)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'client',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLA DE SERVICIOS / PLATAFORMAS DE STREAMING
CREATE TABLE public.streaming_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    color_hex TEXT DEFAULT '#E50914',
    default_profiles_count INT NOT NULL DEFAULT 1,
    retail_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLA DE CUENTAS MAESTRAS DE STREAMING
CREATE TABLE public.streaming_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.streaming_services(id) ON DELETE RESTRICT,
    account_email TEXT NOT NULL,
    account_password TEXT NOT NULL,
    max_profiles INT NOT NULL DEFAULT 1,
    available_profiles INT NOT NULL DEFAULT 1,
    assigned_seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status account_status NOT NULL DEFAULT 'available',
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE NOT NULL,
    monthly_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLA DE PERFILES / PANTALLAS (Para venta de pantallas individuales)
CREATE TABLE public.account_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.streaming_accounts(id) ON DELETE CASCADE,
    profile_name TEXT NOT NULL,
    profile_pin TEXT,
    client_name TEXT,
    client_phone TEXT,
    assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    price_sold DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    expiration_date DATE NOT NULL,
    is_occupied BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLA DE SOLICITUDES Y RECEPCIÓN DE CÓDIGOS (CRÍTICA EN TIEMPO REAL)
CREATE TABLE public.code_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.streaming_accounts(id) ON DELETE CASCADE,
    account_email TEXT NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    request_type code_type NOT NULL DEFAULT 'access_code',
    extracted_code TEXT,
    raw_email_subject TEXT,
    raw_email_body TEXT,
    status code_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '5 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABLA DE FINANZAS Y TRANSACCIONES
CREATE TABLE public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.streaming_accounts(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type transaction_type NOT NULL, -- income, expense, commission
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT, -- 'renovacion_cuenta', 'venta_pantalla', 'pago_comision', 'servidor'
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABLA DE MÉTODOS DE PAGO (Para la tienda pública)
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL, -- Ej: Binance Pay (USDT), Pago Móvil, Zelle
    type TEXT NOT NULL, -- 'crypto', 'fiat_transfer', 'p2p'
    instructions TEXT NOT NULL, -- Datos de cuenta, titular, id, número
    qr_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 10. ÍNDICES DE RENDIMIENTO Y TIEMPO REAL
-- ==============================================================================
CREATE INDEX idx_streaming_accounts_email ON public.streaming_accounts(account_email);
CREATE INDEX idx_streaming_accounts_seller ON public.streaming_accounts(assigned_seller_id);
CREATE INDEX idx_streaming_accounts_exp ON public.streaming_accounts(expiration_date);
CREATE INDEX idx_code_requests_email ON public.code_requests(account_email, status);
CREATE INDEX idx_code_requests_seller ON public.code_requests(seller_id);
CREATE INDEX idx_finances_date ON public.financial_transactions(transaction_date);

-- ==============================================================================
-- 11. HABILITAR ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 12. FUNCIONES DE APOYO Y TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner' AND is_active = true
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
BEGIN
    SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE WHEN is_first_user THEN 'owner'::user_role ELSE 'client'::user_role END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 13. POLÍTICAS DE ACCESO (RLS POLICIES)
-- ==============================================================================

-- PROFILES
CREATE POLICY "Public profile view" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Owner has full access to profiles" ON public.profiles FOR ALL USING (public.is_owner());

-- STREAMING SERVICES
CREATE POLICY "Everyone can view active services" ON public.streaming_services FOR SELECT USING (is_active = true OR public.is_owner());
CREATE POLICY "Owner can manage services" ON public.streaming_services FOR ALL USING (public.is_owner());

-- STREAMING ACCOUNTS
CREATE POLICY "Owner has full access to accounts" ON public.streaming_accounts FOR ALL USING (public.is_owner());
CREATE POLICY "Sellers can view assigned accounts" ON public.streaming_accounts FOR SELECT USING (
    public.is_owner() OR (public.is_seller() AND assigned_seller_id = auth.uid())
);
CREATE POLICY "Sellers can update assigned accounts" ON public.streaming_accounts FOR UPDATE USING (
    public.is_seller() AND assigned_seller_id = auth.uid()
);

-- ACCOUNT PROFILES
CREATE POLICY "Owner has full access to account profiles" ON public.account_profiles FOR ALL USING (public.is_owner());
CREATE POLICY "Sellers can view and edit profiles of their accounts" ON public.account_profiles FOR ALL USING (
    public.is_owner() OR EXISTS (
        SELECT 1 FROM public.streaming_accounts sa 
        WHERE sa.id = account_profiles.account_id AND sa.assigned_seller_id = auth.uid()
    )
);

-- CODE REQUESTS (TIEMPO REAL)
CREATE POLICY "Owner can see all code requests" ON public.code_requests FOR ALL USING (public.is_owner());
CREATE POLICY "Sellers can manage their own code requests" ON public.code_requests FOR ALL USING (
    public.is_seller() AND (
        seller_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.streaming_accounts sa 
            WHERE sa.id = code_requests.account_id AND sa.assigned_seller_id = auth.uid()
        )
    )
);

-- FINANCIAL TRANSACTIONS
CREATE POLICY "Owner can view and manage all finances" ON public.financial_transactions FOR ALL USING (public.is_owner());
CREATE POLICY "Sellers can view their own transactions" ON public.financial_transactions FOR SELECT USING (
    public.is_seller() AND seller_id = auth.uid()
);

-- PAYMENT METHODS
CREATE POLICY "Everyone can read active payment methods" ON public.payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "Owner can manage payment methods" ON public.payment_methods FOR ALL USING (public.is_owner());

-- ==============================================================================
-- 14. HABILITAR REALTIME EN SUPABASE
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaming_accounts;

-- ==============================================================================
-- 15. SEED DATA INICIAL
-- ==============================================================================
INSERT INTO public.streaming_services (name, slug, color_hex, default_profiles_count, retail_price, cost_price) VALUES
('Netflix Premium 4K', 'netflix', '#E50914', 5, 3.50, 2.00),
('Disney+ Standard', 'disney', '#0063E5', 4, 2.50, 1.50),
('Max (HBO Max)', 'max', '#002BE7', 5, 2.50, 1.20),
('Prime Video', 'prime-video', '#00A8E1', 3, 2.00, 1.00),
('Spotify Familiar', 'spotify', '#1DB954', 6, 2.00, 0.90),
('Crunchyroll Fan', 'crunchyroll', '#F47521', 4, 2.00, 1.10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.payment_methods (title, type, instructions, display_order) VALUES
('Binance Pay (USDT)', 'crypto', 'Pay ID: 123456789 (Nombre: StreamHub Oficial). Envía el monto exacto y adjunta captura al vendedor.', 1),
('Pago Móvil (Bs)', 'fiat_transfer', 'Banco: 0102 - Banesco\nCédula: V-28.123.456\nTeléfono: 0412-1234567\nTasa: BCV del día', 2),
('Zelle', 'fiat_transfer', 'Correo: pagos@streamhub.com\nTitular: Stream Services LLC', 3);
