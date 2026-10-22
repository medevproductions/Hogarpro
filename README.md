# 🚀 HogarPro - Plataforma de Streaming y Gestión en la Nube

Plataforma integral de administración y venta de cuentas de streaming (Netflix, Disney+, Max, Prime Video, Spotify, Crunchyroll) con sincronización de códigos en tiempo real y persistencia en la nube con Google Cloud Firebase.

---

## 🛠️ Tecnologías y Arquitectura

- **Frontend / Fullstack**: [Next.js 15 (App Router)](https://nextjs.org/) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Base de Datos & Auth**: [Google Cloud Firebase Firestore](https://firebase.google.com/)
- **Automatización de Códigos**: Google Apps Script -> Webhook API en Next.js
- **Despliegue**: [Vercel](https://vercel.com/)

---

## 📦 Estructura de Roles del Sistema

1. **👑 Dueño (Owner / Administrador)**:
   - Panel Financiero (Ingresos brutos, costos de cuentas, utilidad neta y márgenes).
   - CRUD e importación masiva en Excel de cuentas maestras con asignación a vendedores.
   - Gestión de revendedores y permisos de acceso.
   - Sincronización automática con Firebase Cloud Firestore.

2. **💼 Vendedor (Seller / Revendedor)**:
   - Portal dedicado con cuentas asignadas.
   - **Terminal de Códigos en Vivo**: Botón de solicitud de códigos (OTP, Hogar, Restablecimiento) con refresco en tiempo real mediante Firestore.
   - Autenticación segura de contraseñas contra Firebase.

3. **🛍️ Cliente (Tienda Pública)**:
   - Catálogo interactivo con stock y estado en tiempo real.

---

## ⚡ Configuración de Firebase Firestore

1. Abre tu proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Ve a **Firestore Database** -> Pestaña **Reglas (Rules)**.
3. Pega las reglas de [`firestore.rules`](file:///c:/Users/Admin/Documents/Pagina%20streaming/firestore.rules) y pulsa **Publicar**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## ⚡ Configuración Local (.env.local)

Completa tus credenciales de Firebase en `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
WEBHOOK_SECRET=...
NEXT_PUBLIC_SITE_URL=https://hogarpro-xrhd.vercel.app
```

Instala las dependencias y ejecuta el servidor:

```bash
npm install
npm run dev
```

---

## ⚡ Scripts de Google Apps Script

En la carpeta [`scripts/google-apps-script/`](file:///c:/Users/Admin/Documents/Pagina%20streaming/scripts/google-apps-script/) encontrarás:
- `gas_streaming_codes.js`: Script de búsqueda bajo demanda y WebApp para Gmail.
- `google-apps-script.js`: Script periódico para webhooks de códigos entrantes.
