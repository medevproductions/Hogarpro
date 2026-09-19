"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Tv, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  LogOut, 
  CheckCircle2, 
  ExternalLink,
  Flame,
  Zap,
  Clock,
  Sparkles,
  ShoppingBag,
  Layers,
  KeyRound
} from "lucide-react";
import { 
  getCurrentUser, 
  setCurrentUser, 
  SystemUser, 
  getStoredAccounts, 
  StoredStreamingAccount,
  getSystemUsers,
  saveSystemUser
} from "@/lib/account-manager";
import { formatCurrency } from "@/lib/utils";

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  stock: number;
  color: string;
  features: string[];
  badge?: string;
  popular?: boolean;
}

const SERVICES: ServiceItem[] = [
  {
    id: "netflix-4k",
    name: "Netflix Premium Ultra HD",
    category: "4K HDR • 1 Pantalla",
    price: 3.50,
    originalPrice: 7.99,
    stock: 14,
    color: "from-red-600 to-red-900",
    badge: "Más Vendido",
    popular: true,
    features: [
      "Calidad 4K Ultra HD + HDR",
      "Perfil individual con PIN exclusivo",
      "Códigos de acceso al instante 24/7",
      "Garantía total de 30 días"
    ]
  },
  {
    id: "disney-std",
    name: "Disney+ & Star+ Combo",
    category: "Full HD • 1 Pantalla",
    price: 2.50,
    originalPrice: 5.99,
    stock: 8,
    color: "from-blue-600 to-indigo-900",
    features: [
      "Catálogo Disney, Marvel, Star & ESPN",
      "Sin interrupciones ni caídas",
      "Descargas offline disponibles",
      "Soporte inmediato por WhatsApp"
    ]
  },
  {
    id: "max-plat",
    name: "Max (HBO) Platino 4K",
    category: "4K UHD • 3 Dispositivos",
    price: 2.80,
    originalPrice: 6.50,
    stock: 12,
    color: "from-purple-600 to-violet-950",
    badge: "Estreno House of Dragon",
    features: [
      "Series HBO, Warner Bros, Discovery & DC",
      "Perfiles simultáneos activos",
      "Audio Dolby Atmos envolvente",
      "Activación inmediata al pagar"
    ]
  },
  {
    id: "prime-video",
    name: "Amazon Prime Video",
    category: "4K HDR • 2 Pantallas",
    price: 1.80,
    originalPrice: 4.99,
    stock: 20,
    color: "from-sky-500 to-blue-900",
    features: [
      "Envíos Prime + Video streaming",
      "Contenido original exclusivo Amazon",
      "Modo niños y control parental",
      "Acceso garantizado mes a mes"
    ]
  },
  {
    id: "spotify-prem",
    name: "Spotify Individual Premium",
    category: "Música Sin Límites",
    price: 2.20,
    originalPrice: 5.99,
    stock: 15,
    color: "from-emerald-600 to-green-950",
    badge: "A tu propio correo",
    features: [
      "Sin anuncios, música offline",
      "Máxima calidad de audio (320kbps)",
      "Saltos de canción ilimitados",
      "Renovación limpia mes a mes"
    ]
  },
  {
    id: "crunchy-mega",
    name: "Crunchyroll Mega Fan",
    category: "Anime HD • Sin Anuncios",
    price: 2.00,
    originalPrice: 3.99,
    stock: 11,
    color: "from-orange-500 to-amber-800",
    features: [
      "Simulcast estreno 1h después de Japón",
      "Visionado sin anuncios ni restricciones",
      "Acceso ilimitado a manga",
      "Garantía mes completo"
    ]
  }
];

export default function HomeOrSellerCatalogPage() {
  const router = useRouter();
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  
  // Campos de formulario
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Cuentas del vendedor logueado
  const [userAccounts, setUserAccounts] = useState<StoredStreamingAccount[]>([]);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUserState(user);
    if (user) {
      // Redirigir directamente al panel de vendedor
      router.push("/dashboard/seller");
      return;
    }
    setLoadingSession(false);
  }, [router]);

  // Manejador de Login de Vendedor
  const handleSellerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    setTimeout(() => {
      const cleanEmail = loginEmail.trim().toLowerCase();
      // Buscar usuario en el sistema o crear sesión
      const allUsers = getSystemUsers();
      const found = allUsers.find(u => u.email.toLowerCase() === cleanEmail);

      const sellerUser: SystemUser = found || {
        id: `s-${Date.now().toString().slice(-4)}`,
        email: cleanEmail,
        name: cleanEmail.split("@")[0].toUpperCase(),
        role: "seller",
        status: "active"
      };

      // Guardar sesión y redirigir DIRECTO al panel de vendedor
      setCurrentUser(sellerUser);
      router.push("/dashboard/seller");
      setLoggingIn(false);
    }, 500);
  };

  // Manejador de Registro de Nuevo Vendedor
  const handleSellerRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    setTimeout(() => {
      const cleanEmail = regEmail.trim().toLowerCase();
      if (!cleanEmail || !regName.trim() || !regPassword) {
        setLoginError("Por favor completa todos los campos requeridos.");
        setLoggingIn(false);
        return;
      }

      const allUsers = getSystemUsers();
      const exists = allUsers.some(u => u.email.toLowerCase() === cleanEmail);
      if (exists) {
        setLoginError("Este correo ya se encuentra registrado. Por favor inicia sesión.");
        setLoggingIn(false);
        return;
      }

      // Crear y guardar el nuevo vendedor con contraseña
      const newSeller: SystemUser = {
        id: `s-${Date.now().toString().slice(-4)}`,
        name: regName.trim(),
        email: cleanEmail,
        password: regPassword,
        phone: regPhone.trim() || "Sin teléfono",
        role: "seller",
        status: "active",
        activeAccountsCount: 0
      };

      saveSystemUser(newSeller);
      setCurrentUser(newSeller);
      router.push("/dashboard/seller");
      setLoggingIn(false);
    }, 600);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setUserAccounts([]);
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 1: SI NO ESTÁ LOGUEADO -> MOSTRAR LOGIN / REGISTRO DE VENDEDORES
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070a12] flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
        {/* Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Logo & Encabezado */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                STREAM<span className="text-indigo-400">HUB</span>
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-white tracking-tight">Portal de Revendedores</h1>
            <p className="text-xs text-gray-400 mt-1">
              Accede a precios mayoristas y gestiona las cuentas autorizadas
            </p>
          </div>

          {/* Tarjeta de Autenticación */}
          <div className="bg-[#0f1422]/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Pestañas Iniciar Sesión / Registrarse */}
            <div className="grid grid-cols-2 p-1 bg-[#070a12] border border-gray-800 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setLoginError(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  authMode === "login"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setLoginError(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  authMode === "register"
                    ? "bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md shadow-indigo-900/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Registrarme
              </button>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* FORMULARIO 1: INICIAR SESIÓN */}
            {authMode === "login" ? (
              <form onSubmit={handleSellerLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Correo de Vendedor
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="tucorreo@ventas.com"
                      className="w-full bg-[#070a12] border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Contraseña de Acceso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#070a12] border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !loginEmail || !loginPassword}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                  {loggingIn ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Entrar al Catálogo</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORMULARIO 2: REGISTRO DE NUEVO VENDEDOR */
              <form onSubmit={handleSellerRegister} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#070a12] border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="juan@ventas.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-[#070a12] border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Número de Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+58 412 1234567"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-[#070a12] border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Crear Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-[#070a12] border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !regName || !regEmail || !regPassword}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-pink-900/30 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                  {loggingIn ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Crear mi Cuenta de Revendedor</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Plataforma privada para revendedores autorizados</span>
            </div>
          </div>

          {/* Enlace discreto a /admin */}
          <div className="mt-8 text-center">
            <Link href="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition">
              ¿Eres el Administrador? Inicia sesión en /admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 2: USUARIO LOGUEADO -> MOSTRAR CATÁLOGO Y PANEL DE VENDEDOR
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-gray-100 selection:bg-indigo-500 selection:text-white">
      {/* NAVBAR AUTENTICADA */}
      <header className="sticky top-0 z-40 border-b border-gray-800/80 bg-[#090d16]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-indigo-300 bg-clip-text text-transparent">
                STREAM<span className="text-indigo-400">HUB</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 rounded-full">
                VENDEDOR ACTIVO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/seller"
              className="px-4 py-2 text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-xl transition flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mis Códigos y Cuentas ({userAccounts.length})</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* BANNER DE BIENVENIDA */}
      <section className="relative overflow-hidden py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-gray-900/60 border border-indigo-500/20 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Panel Mayorista</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Bienvenido, {currentUser.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
              Aquí puedes ver los servicios disponibles para venta y consultar los códigos de acceso de tus cuentas autorizadas.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl px-5 py-3 text-center">
              <div className="text-xl font-extrabold text-indigo-400">{userAccounts.length}</div>
              <div className="text-[11px] text-gray-500 uppercase font-semibold">Cuentas Asignadas</div>
            </div>
          </div>
        </div>
      </section>

      {/* CATÁLOGO DE SERVICIOS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              <span>Catálogo de Servicios Disponibles</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Precios preferenciales para revendedores</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <div 
              key={s.id}
              className="bg-[#121826]/90 border border-gray-800/80 rounded-2xl p-6 hover:border-indigo-500/40 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-800/80 text-gray-300">
                    {s.category}
                  </span>
                  {s.badge && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {s.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-white group-hover:text-indigo-300 transition">
                  {s.name}
                </h3>

                <div className="my-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{formatCurrency(s.price)}</span>
                  <span className="text-xs text-gray-500 line-through">{formatCurrency(s.originalPrice)}</span>
                  <span className="text-[11px] text-emerald-400 font-semibold ml-auto">
                    Stock: {s.stock} disponibles
                  </span>
                </div>

                <ul className="space-y-2 border-t border-gray-800/80 pt-4 mb-6">
                  {s.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/dashboard/seller"
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider text-center transition flex items-center justify-center gap-2 shadow-md shadow-indigo-900/30"
              >
                <span>Ver Mis Cuentas de este Servicio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-8 text-center text-xs text-gray-500 border-t border-gray-800/80 mt-12">
        © 2026 StreamHub Pro • Portal Privado de Distribución de Streaming
      </footer>
    </div>
  );
}
