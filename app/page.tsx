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
  saveSystemUser,
  syncUsersFromCloud,
  syncAccountsFromCloud,
  getCatalogPlatforms,
  CatalogPlatform
} from "@/lib/account-manager";
import { authenticateWithFirebase, registerSellerWithFirebase } from "@/lib/firebase/auth-service";
import { formatCurrency } from "@/lib/utils";
import LatamPhoneInput from "@/components/LatamPhoneInput";
import HogarProEmailInput from "@/components/HogarProEmailInput";

export default function HomeOrSellerCatalogPage() {
  const router = useRouter();
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [catalogPlatforms, setCatalogPlatforms] = useState<CatalogPlatform[]>([]);

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

    setCatalogPlatforms(getCatalogPlatforms());
    setLoadingSession(false);

    // Sincronizar usuarios y cuentas desde la nube en segundo plano
    syncUsersFromCloud(true).catch(console.warn);
    syncAccountsFromCloud(true).catch(console.warn);

    const handleCatalogUpdate = () => {
      setCatalogPlatforms(getCatalogPlatforms());
    };
    window.addEventListener("streamhub_catalog_updated", handleCatalogUpdate);
    window.addEventListener("storage", handleCatalogUpdate);

    return () => {
      window.removeEventListener("streamhub_catalog_updated", handleCatalogUpdate);
      window.removeEventListener("storage", handleCatalogUpdate);
    };
  }, [router]);

  // Manejador de Login de Vendedor con Firebase
  const handleSellerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const cleanInput = loginEmail.trim().toLowerCase();
      const targetEmail = cleanInput.includes("@") ? cleanInput : `${cleanInput}@hogarpro.com`;
      const result = await authenticateWithFirebase(targetEmail, loginPassword);
      if (result.success && result.user) {
        if (result.user.role === "owner" || (result.user.role as string) === "admin") {
          router.push("/dashboard/owner");
        } else {
          router.push("/dashboard/seller");
        }
      } else {
        setLoginError(result.error || "Credenciales incorrectas.");
        setLoggingIn(false);
      }
    } catch (err: any) {
      setLoginError(err?.message || "Error al autenticar. Por favor verifica tus datos.");
      setLoggingIn(false);
    }
  };

  // Manejador de Registro de Nuevo Vendedor en Firebase Cloud Firestore
  const handleSellerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const result = await registerSellerWithFirebase({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone
      });

      if (result.success && result.user) {
        router.push("/dashboard/seller");
      } else {
        setLoginError(result.error || "No se pudo registrar.");
        setLoggingIn(false);
      }
    } catch (err: any) {
      setLoginError(err?.message || "Error al registrarse. Por favor verifica los datos ingresados.");
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setUserAccounts([]);
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 1: SI NO ESTÁ LOGUEADO -> MOSTRAR LOGIN / REGISTRO DE VENDEDORES
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4 relative overflow-hidden selection:bg-[#E50914] selection:text-white">
        {/* Cinematic Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[380px] bg-[#E50914]/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-red-950/20 blur-[130px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Logo & Encabezado */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E50914] flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-red-600/40">
                H
              </div>
              <span className="text-3xl font-black tracking-wider text-white">
                HOGAR<span className="text-[#E50914]">PRO</span>
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-black text-white tracking-tight">Portal de Revendedores</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Accede a precios mayoristas y gestiona las cuentas autorizadas
            </p>
          </div>

          {/* Tarjeta de Autenticación HogarPro */}
          <div className="bg-black/80 border border-[#2f2f2f] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Pestañas Iniciar Sesión / Registrarse */}
            <div className="grid grid-cols-2 p-1 bg-[#161616] border border-[#2a2a2a] rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setLoginError(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  authMode === "login"
                    ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                    : "text-zinc-400 hover:text-white"
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
                    ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Registrarme
              </button>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* FORMULARIO 1: INICIAR SESIÓN */}
            {authMode === "login" ? (
              <form onSubmit={handleSellerLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    Correo o Usuario de Vendedor
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="usuario o usuario@hogarpro.com"
                      className="w-full bg-[#161616] border border-[#333333] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    Contraseña de Acceso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#161616] border border-[#333333] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !loginEmail || !loginPassword}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-sm uppercase tracking-wider shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                  {loggingIn ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Iniciar Sesión como Revendedor</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORMULARIO 2: REGISTRO DE NUEVO VENDEDOR */
              <form onSubmit={handleSellerRegister} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Usuario / Dirección de Correo
                  </label>
                  <HogarProEmailInput
                    value={regEmail}
                    onChange={(email) => setRegEmail(email)}
                    placeholder="ej: juanperez"
                    required
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Tu correo oficial será: <span className="text-red-400 font-mono font-medium">{regEmail || "usuario@hogarpro.com"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Número de Teléfono / WhatsApp (LATAM)
                  </label>
                  <LatamPhoneInput
                    value={regPhone}
                    onChange={(phone) => setRegPhone(phone)}
                    required
                    placeholder="300 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Crear Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !regName || !regEmail || !regPassword}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-sm uppercase tracking-wider shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
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

            <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-center gap-2 text-[11px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Plataforma privada para revendedores autorizados</span>
            </div>
          </div>

          {/* Enlace discreto a /admin */}
          <div className="mt-8 text-center">
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              ¿Eres el Administrador? Inicia sesión en /admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 2: USUARIO LOGUEADO -> REDIRIGIR AL PANEL (CATÁLOGO OCULTO)
  // =========================================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#141414] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Ingresando a tu panel de revendedor...</p>
      </div>
    </div>
  );
}
