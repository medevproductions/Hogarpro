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
  CheckCircle2,
  Sparkles,
  User,
  Shield
} from "lucide-react";
import {
  getCurrentUser,
  setCurrentUser,
  SystemUser,
  StoredStreamingAccount,
  syncUsersFromCloud,
  syncAccountsFromCloud,
  getCatalogPlatforms,
  CatalogPlatform
} from "@/lib/account-manager";
import { authenticateWithFirebase, registerSellerWithFirebase } from "@/lib/firebase/auth-service";
import LatamPhoneInput from "@/components/LatamPhoneInput";
import HogarProEmailInput from "@/components/HogarProEmailInput";

export default function HomeOrSellerCatalogPage() {
  const router = useRouter();
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [, setCatalogPlatforms] = useState<CatalogPlatform[]>([]);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Form fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    // Al entrar a la página de login principal, NO auto-autenticamos ni auto-redireccionamos.
    // El usuario debe ingresar sus credenciales manualmente.
    setCatalogPlatforms(getCatalogPlatforms());
    setLoadingSession(false);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "restricted") {
        setLoginError("Acceso protegido: Ingresa tus credenciales autorizadas para consultar códigos.");
      } else if (params.get("error") === "login_required") {
        setLoginError("Inicia sesión con tu cuenta para acceder al portal.");
      }
    }

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
  }, []);

  const handleSellerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const cleanInput = loginEmail.trim().toLowerCase();
      const cleanPass = loginPassword.trim();
      if (!cleanInput || !cleanPass) {
        setLoginError("Por favor ingresa tu correo y contraseña.");
        setLoggingIn(false);
        return;
      }
      const targetEmail = cleanInput.includes("@") ? cleanInput : `${cleanInput}@hogarpro.com`;
      const result = await authenticateWithFirebase(targetEmail, cleanPass);
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

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-700 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col justify-between p-4 sm:p-8 relative selection:bg-rose-500/30 selection:text-rose-200">
        {/* Subtle, eye-friendly ambient lighting (Microsoft Fluent / Samsung One UI style) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent blur-3xl opacity-60" />
          <div className="absolute bottom-0 right-0 w-[450px] h-[300px] bg-rose-950/10 blur-3xl opacity-50" />
        </div>

        {/* Top Minimal Bar */}
        <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center shadow-sm">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-100">
                Hogar<span className="text-rose-500">Pro</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] text-slate-500 font-medium">
                Portal de Gestión
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/soporte-codigos"
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition font-medium"
            >
              Consulta de Códigos
            </Link>
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition font-medium"
            >
              Acceso Admin
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              Portal de Revendedores
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Administra cuentas asignadas, genera códigos OTP y autorizaciones en tiempo real.
            </p>
          </div>

          {/* Elevated Modern Fluent Surface */}
          <div className="bg-[#121722]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl transition-all">
            {/* Segmented Control (Pill-less, clean Fluent tabs) */}
            <div className="grid grid-cols-2 p-1 bg-[#0E121B] border border-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setLoginError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${authMode === "login"
                    ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200"
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
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${authMode === "register"
                    ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                Crear Cuenta
              </button>
            </div>

            {loginError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            {/* FORM 1: LOGIN */}
            {authMode === "login" ? (
              <form onSubmit={handleSellerLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Usuario o Correo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="usuario o usuario@hogarpro.com"
                      className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Contraseña
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !loginEmail || !loginPassword}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
                >
                  {loggingIn ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Iniciar Sesión</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORM 2: REGISTRATION */
              <form onSubmit={handleSellerRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#0E121B] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Usuario / Dirección de Correo
                  </label>
                  <HogarProEmailInput
                    value={regEmail}
                    onChange={(email) => setRegEmail(email)}
                    placeholder="ej: juanperez"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Correo oficial asignado: <span className="text-slate-200 font-mono font-medium">{regEmail || "usuario@hogarpro.com"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    WhatsApp o Teléfono (LATAM)
                  </label>
                  <LatamPhoneInput
                    value={regPhone}
                    onChange={(phone) => setRegPhone(phone)}
                    required
                    placeholder="300 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-[#0E121B] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !regName || !regEmail || !regPassword}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
                >
                  {loggingIn ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Crear Cuenta</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Enterprise Security Badge */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conexión cifrada con Firebase Cloud Security</span>
            </div>
          </div>
        </main>

        {/* Clean Footer */}
        <footer className="relative z-10 w-full max-w-5xl mx-auto py-4 text-center">
          <p className="text-xs text-slate-400">
            HogarPro Cloud © 2026. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    );
}
