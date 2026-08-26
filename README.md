# 🚀 StreamHub Pro - Guía de Configuración y Despliegue Rápido

Plataforma integral de administración y venta de cuentas de streaming (Netflix, Disney+, Max, etc.) con sincronización de códigos en tiempo real.

---

## 🛠️ Tecnologías y Arquitectura

- **Frontend / Fullstack**: [Next.js 15 (App Router)](https://nextjs.org/) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) (PostgreSQL con Row Level Security y Realtime WebSockets)
- **Automatización de Códigos**: Google Apps Script / IMAP Worker -> Webhook API en Next.js
- **Despliegue Recomendado**: [Vercel](https://vercel.com/) (Frontend/API) + [Supabase](https://supabase.com/) (Capa gratuita)

---

## 📦 Estructura de Roles del Sistema

1. **👑 Dueño (Owner)**:
   - Panel Financiero (Ingresos brutos, costos de cuentas, utilidad neta y márgenes).
   - CRUD de cuentas maestras con asignación a vendedores.
   - Control de vencimientos y métricas de vendedores.

2. **💼 Vendedor (Seller)**:
   - Vista exclusiva de sus cuentas asignadas y estado de clientes.
   - **Terminal de Códigos en Vivo**: Botón de solicitud de códigos (OTP, Hogar, Restablecimiento) con refresco automático en pantalla.

3. **🛍️ Cliente (Tienda Pública)**:
   - Catálogo interactivo con precios, stock en tiempo real y métodos de pago (Binance Pay, Pago Móvil, Zelle).

---

## ⚡ Paso 1: Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Ve a **SQL Editor** y ejecuta todo el contenido de [`supabase/schema.sql`](file:///c:/Users/Admin/Documents/Pagina%20streaming/supabase/schema.sql).
3. Obtén tus claves en **Project Settings -> API**:
   - `Project URL`
   - `anon public key`
   - `service_role secret key`

---

## ⚡ Paso 2: Configuración Local (.env.local)

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

Instala las dependencias y ejecuta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la aplicación.

---

## ⚡ Paso 3: Configurar Google Apps Script para los Códigos

1. Abre [Google Apps Script](https://script.google.com/).
2. Crea un nuevo proyecto y copia el código de [`supabase/google-apps-script.js`](file:///c:/Users/Admin/Documents/Pagina%20streaming/supabase/google-apps-script.js).
3. Ajusta `WEBHOOK_URL` con tu dominio de Vercel y define tu `WEBHOOK_SECRET`.
4. Crea un activador (Trigger) basado en tiempo para que se ejecute cada 1 minuto.

---

## 🚀 Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Importa el proyecto en [Vercel](https://vercel.com/).
3. Configura las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`).
4. Haz clic en **Deploy**.
