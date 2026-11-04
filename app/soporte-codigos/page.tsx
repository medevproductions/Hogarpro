"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { 
  Tv, 
  Mail, 
  Search, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Home,
  Plane,
  ShieldCheck,
  KeyRound,
  Lock,
  User,
  UserCheck,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Clock,
  Zap,
  X
} from "lucide-react";
import CodigoHelpGuide from "@/components/soporte/CodigoHelpGuide";
import { 
  getCurrentUser, 
  setCurrentUser, 
  getStoredAccounts, 
  checkAccountAuthorization,
  getSessionToken,
  SystemUser, 
  StoredStreamingAccount,
  syncAccountsFromCloud,
  syncUsersFromCloud
} from "@/lib/account-manager";
import { authenticateWithFirebase } from "@/lib/firebase/auth-service";

type ActionType = "auto" | "actualizar_hogar" | "acceso_temporal" | "login_code" | "verification_code" | "reset_password";

interface ActionOption {
  id: ActionType;
  label: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "login_code",
    label: "Código de Inicio",
    subtitle: "4 dígitos en pantalla TV",
    badge: "4 dígitos",
    icon: <Zap className="w-4 h-4 text-emerald-400" />
  },
  {
    id: "verification_code",
    label: "Código de Confirmación",
    subtitle: "6 dígitos de verificación",
    badge: "6 dígitos",
    icon: <Clock className="w-4 h-4 text-sky-400" />
  },
  {
    id: "actualizar_hogar",
    label: "Actualizar Hogar",
    subtitle: "Confirmar red doméstica",
    badge: "Enlace",
    icon: <Home className="w-4 h-4 text-blue-400" />
  },
  {
    id: "acceso_temporal",
    label: "Acceso de Viaje",
    subtitle: "TV fuera del hogar",
    badge: "Enlace",
    icon: <Plane className="w-4 h-4 text-indigo-400" />
  },
  {
    id: "reset_password",
    label: "Cambiar Clave",
    subtitle: "Restablecer contraseña",
    badge: "Enlace",
    icon: <KeyRound className="w-4 h-4 text-rose-400" />
  },
  {
    id: "auto",
    label: "Detección Automática",
    subtitle: "Cualquier solicitud reciente",
    badge: "Automático",
    icon: <Sparkles className="w-4 h-4 text-amber-400" />
  }
];

export default function SoporteCodigosPage() {
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [loadingInitialSession, setLoadingInitialSession] = useState(true);

  // In-Page Authentication State
  const [loginRole, setLoginRole] = useState<"seller" | "admin">("seller");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Code Query State
  const [email, setEmail] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionType>("login_code");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    code?: string;
    actionType?: string;
    isLink?: boolean;
    message?: string;
    success?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Sincronizar sesión activa si el usuario ya inició sesión previamente en la plataforma
    const active = getCurrentUser();
    if (active) {
      setCurrentUserState(active);
    }
    setLoadingInitialSession(false);

    // Leer posibles parámetros de consulta de la URL (ej: ?email=cuenta@gmail.com&action=login_code)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam.trim());
      }
      const actionParam = params.get("action") || params.get("actionType");
      if (actionParam && ["login_code", "verification_code", "actualizar_hogar", "acceso_temporal", "reset_password", "auto"].includes(actionParam)) {
        setSelectedAction(actionParam as ActionType);
      }
    }

    syncAccountsFromCloud(true).catch(console.warn);
    syncUsersFromCloud(true).catch(console.warn);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSearching) {
      setSecondsElapsed(0);
      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  // Cuentas asignadas al usuario actual
  const assignedAccounts = useMemo(() => {
    if (!currentUser) return [];
    const all = getStoredAccounts();
    if (currentUser.role === "owner" || (currentUser.role as string) === "admin") {
      return all;
    }
    const uName = (currentUser.name || "").toLowerCase().trim();
    const uEmail = (currentUser.email || "").toLowerCase().trim();
    const uId = (currentUser.id || "").toLowerCase().trim();

    return all.filter((a) => {
      const sId = (a.sellerId || "").toLowerCase().trim();
      const sName = (a.sellerName || (a as any).seller || "").toLowerCase().trim();
      return (sId && (sId === uId || sId === uEmail)) || 
             (sName && (sName === uName || sName === uEmail || uName.includes(sName) || sName.includes(uName)));
    });
  }, [currentUser]);

  // Si el revendedor tiene cuentas asignadas y aún no ha seleccionado ninguna, auto-seleccionar la primera
  useEffect(() => {
    if (currentUser && currentUser.role !== "owner" && (currentUser.role as string) !== "admin") {
      if (assignedAccounts.length > 0 && !email) {
        setEmail((assignedAccounts[0].email || "").trim().replace(/\s+/g, ""));
      }
    }
  }, [currentUser, assignedAccounts, email]);

  // Manejador de Login Directo en la Página
  const handleInPageLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const cleanId = loginIdentifier.trim();
      const cleanPass = loginPassword.trim();
      if (!cleanId || !cleanPass) {
        setLoginError("Por favor ingresa tus credenciales completas.");
        setLoginLoading(false);
        return;
      }

      let targetEmail = cleanId.toLowerCase();
      if (loginRole === "seller" && !targetEmail.includes("@")) {
        targetEmail = `${targetEmail}@hogarpro.com`;
      }

      const res = await authenticateWithFirebase(targetEmail, cleanPass);
      if (res.success && res.user) {
        if (loginRole === "admin") {
          if (res.user.role === "owner" || (res.user.role as string) === "admin") {
            setCurrentUserState(res.user);
            setLoginPassword("");
            setLoginError(null);
          } else {
            setLoginError("Esta cuenta no tiene permisos de Administrador. Cambia a la pestaña 'Revendedor' para iniciar sesión.");
            setLoginLoading(false);
            return;
          }
        } else {
          setCurrentUserState(res.user);
          setLoginPassword("");
          setLoginError(null);
        }
      } else {
        setLoginError(res.error || "Credenciales incorrectas. Verifica tus datos de acceso.");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Error al autenticar. Por favor verifica tus credenciales.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Cerrar Sesión Directo en la Página
  const handleLogout = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setCurrentUser(null);
    setCurrentUserState(null);
    setResult(null);
    setIsSearching(false);
    setEmail("");
  };

  // Consulta de Código
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setResult({
        success: false,
        message: "Por favor ingresa un correo de Netflix válido (ej: micuenta@gmail.com)."
      });
      return;
    }
    if (email !== cleanEmail) {
      setEmail(cleanEmail);
    }

    if (!currentUser) {
      setResult({
        success: false,
        message: "Por favor inicia sesión con tu usuario de Revendedor o Administrador para consultar códigos."
      });
      return;
    }

    setIsSearching(true);
    setResult(null);
    setCopied(false);

    let attempts = 0;
    const maxAttempts = 12;

    const queryEndpoint = async () => {
      try {
        const sessionToken = getSessionToken() || btoa(encodeURIComponent(JSON.stringify({
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          name: currentUser.name,
          exp: Date.now() + 7 * 24 * 3600 * 1000
        })));

        const res = await fetch(
          `/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=netflix&actionType=${encodeURIComponent(selectedAction)}&auth=${encodeURIComponent(sessionToken)}&t=${Date.now()}`,
          {
            headers: sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {},
            credentials: "include"
          }
        );
        const data = await res.json().catch(() => null);

        if (res.ok && data && data.success && data.code) {
          const finalCode = String(data.code).trim();
          const isUrl = finalCode.startsWith("http://") || finalCode.startsWith("https://");
          setResult({
            success: true,
            code: finalCode,
            actionType: data.actionType || selectedAction,
            isLink: isUrl
          });
          setIsSearching(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          return true;
        }

        // Si el backend reporta sesión no válida
        if (res.status === 401) {
          setResult({
            success: false,
            message: data?.error || data?.message || "Sesión expirada o no autorizada. Por favor vuelve a iniciar sesión."
          });
          setIsSearching(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          return true;
        }

        // Si hay un error explícito del backend (límite de tasa, etc.)
        if (res.status === 429 || (data && !data.success && data.error)) {
          setResult({
            success: false,
            message: data?.error || data?.message || "Error al consultar el código. Intenta de nuevo."
          });
          setIsSearching(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          return true;
        }
      } catch (err) {
        // Silencioso
      }
      return false;
    };

    const immediateFound = await queryEndpoint();
    if (immediateFound) return;

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      attempts++;
      const ok = await queryEndpoint();
      if (ok || attempts >= maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (!ok) {
          setIsSearching(false);
          setResult({
            success: false,
            message: `Aún no se ha detectado el correo de Netflix para '${cleanEmail}'. Ve a tu pantalla de Netflix, presiona la opción para enviar el código/enlace y vuelve a buscar en 1 minuto.`
          });
        }
      }
    }, 3000);
  };

  const handleCancelSearch = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setIsSearching(false);
  };

  const handleCopyCode = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getActionTitle = (type?: string) => {
    switch (type) {
      case "actualizar_hogar":
        return "Aprobación de Hogar Netflix";
      case "acceso_temporal":
        return "Acceso de Viaje";
      case "reset_password":
        return "Restablecimiento de Contraseña";
      case "verification_code":
        return "Código de Confirmación (6 Dígitos)";
      case "login_code":
        return "Código de Inicio (4 Dígitos)";
      default:
        return "Código o Enlace Encontrado";
    }
  };

  const isAdmin = currentUser?.role === "owner" || (currentUser?.role as string) === "admin";

  if (loadingInitialSession) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200">
      {/* NAVBAR */}
      <header className="border-b border-slate-800/80 bg-[#0E121B]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center font-bold text-white shadow-sm group-hover:scale-105 transition-transform">
              <Tv className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm text-slate-100 tracking-tight">
              HOGAR<span className="text-rose-500">PRO</span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <>
                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141A25] border border-slate-800 text-xs">
                  {isAdmin ? (
                    <>
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-slate-200 font-semibold">Administrador</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300 font-medium">
                        Revendedor: <strong className="text-white font-medium">{currentUser.name}</strong>
                      </span>
                    </>
                  )}
                </div>

                <Link
                  href={isAdmin ? "/dashboard/owner" : "/dashboard/seller"}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                >
                  {isAdmin ? "Panel de Control" : "Mi Panel"}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 transition"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/"
                className="text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                Volver al Inicio
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 sm:py-10 flex-1">
        {!currentUser ? (
          /* ========================================================================= */
          /* FORMULARIO DE INGRESO DIRECTO (REVENDEDOR & ADMINISTRADOR) */
          /* ========================================================================= */
          <div className="max-w-md mx-auto my-4 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-rose-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Acceso a Terminal de Códigos
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Ingresa con tu cuenta autorizada para solicitar códigos de inicio, confirmación o enlaces de Netflix.
              </p>
            </div>

            <div className="rounded-2xl bg-[#121722]/95 border border-slate-800/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              {/* Selector de Rol (Revendedor vs Administrador) */}
              <div className="grid grid-cols-2 p-1 bg-[#0E121B] border border-slate-800 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole("seller");
                    setLoginError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    loginRole === "seller"
                      ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Revendedor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole("admin");
                    setLoginError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    loginRole === "admin"
                      ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span>Administrador</span>
                </button>
              </div>

              {loginError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{loginError}</span>
                </div>
              )}

              <form onSubmit={handleInPageLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {loginRole === "seller" ? "Usuario o Correo" : "Correo de Administrador"}
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      {loginRole === "seller" ? <User className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                    <input
                      type={loginRole === "admin" ? "email" : "text"}
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder={loginRole === "seller" ? "usuario o usuario@hogarpro.com" : "admin@hogarpro.com"}
                      className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || !loginIdentifier.trim() || !loginPassword.trim()}
                  className={`w-full mt-2 py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer ${
                    loginRole === "admin"
                      ? "bg-rose-600 hover:bg-rose-500 shadow-rose-950/40"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-950/40"
                  }`}
                >
                  {loginLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{loginRole === "admin" ? "Ingresar como Administrador" : "Iniciar Sesión como Revendedor"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                <span className="text-[11px] text-slate-500">
                  Canal seguro • Las solicitudes se auditan contra los registros de cuenta
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TERMINAL DE CONSULTA ACTIVA PARA USUARIO AUTENTICADO */
          /* ========================================================================= */
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#141A25] border border-slate-800 text-slate-300 text-xs font-medium mb-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>{isAdmin ? "Acceso Administrador" : `Revendedor: ${currentUser.name}`}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Consulta de Códigos Netflix
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mt-1.5 leading-relaxed">
                Acceso a códigos de inicio, confirmación y enlaces de verificación en tiempo real.
              </p>
            </div>

            {/* TARJETA DE BÚSQUEDA CENTRAL */}
            <div className="rounded-2xl bg-[#121722]/95 border border-slate-800/80 p-5 sm:p-7 shadow-xl relative overflow-hidden mb-8">
              {/* SELECTOR DE ACCIÓN */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Tipo de Solicitud
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Selecciona una acción
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ACTION_OPTIONS.map((opt) => {
                    const isSelected = selectedAction === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedAction(opt.id);
                          setResult(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected 
                            ? "bg-[#182234] border-blue-500/80 text-slate-100 shadow-sm ring-1 ring-blue-500/30" 
                            : "bg-[#0E131E] border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#131926]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`p-1.5 rounded-lg ${isSelected ? "bg-blue-500/20 text-blue-300" : "bg-slate-800/80 text-slate-400"}`}>
                            {opt.icon}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                            isSelected ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <div>
                          <div className={`text-xs font-semibold tracking-tight ${isSelected ? "text-slate-100" : "text-slate-300"}`}>
                            {opt.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                            {opt.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FORMULARIO DE BÚSQUEDA */}
              <form onSubmit={handleSearch} noValidate className="space-y-4">
                <div>
                  {assignedAccounts.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          {isAdmin ? `Cuentas en Inventario (${assignedAccounts.length})` : `Tus Cuentas Disponibles (${assignedAccounts.length})`}
                        </label>
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-medium">
                          Selección Rápida
                        </span>
                      </div>
                      <select
                        onChange={(e) => {
                          const cleanVal = (e.target.value || "").trim().replace(/\s+/g, "");
                          if (cleanVal) {
                            setEmail(cleanVal);
                            setResult(null);
                          }
                        }}
                        defaultValue=""
                        className="w-full bg-[#0E121B] border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none transition cursor-pointer"
                      >
                        <option value="" disabled>Seleccionar de la lista ({assignedAccounts.length})...</option>
                        {assignedAccounts.map((acc) => {
                          const cleanAccEmail = (acc.email || "").trim().replace(/\s+/g, "");
                          return (
                            <option key={acc.id} value={cleanAccEmail}>
                              {cleanAccEmail} — {acc.platform || (acc as any).service || "Netflix"} ({acc.country || "Global"})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Correo de la Cuenta Netflix:
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Búsqueda directa en Gmail
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      required
                      placeholder="ej: micuenta@gmail.com"
                      value={email}
                      onChange={(e) => {
                        const sanitized = (e.target.value || "").replace(/\s+/g, "");
                        setEmail(sanitized);
                        setResult(null);
                      }}
                      onBlur={() => {
                        setEmail(prev => prev.trim().replace(/\s+/g, ""));
                      }}
                      className="w-full bg-[#0E121B] border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all"
                    />
                  </div>

                  {/* Chips para autocompletar dominio rápido */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] text-slate-500 font-medium">Autocompletar:</span>
                    {["@gmail.com", "@hotmail.com", "@outlook.com"].map((dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => {
                          const atIndex = email.indexOf("@");
                          const prefix = atIndex !== -1 ? email.substring(0, atIndex) : email;
                          if (prefix.trim()) {
                            setEmail(`${prefix.trim()}${dom}`);
                          }
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-[#162032] hover:bg-[#1E2B44] text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
                      >
                        {dom}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    El sistema buscará en Gmail el correo más reciente de Netflix correspondiente a esta cuenta y extraerá el código o enlace solicitado en tiempo real.
                  </p>
                </div>

                <div className="pt-1">
                  {isSearching ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-3 px-6 bg-blue-600/80 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 cursor-wait"
                      >
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Buscando en servidores de Netflix... ({secondsElapsed}s)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelSearch}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700 transition"
                        title="Cancelar consulta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={!email.trim() || (!isAdmin && assignedAccounts.length === 0)}
                      className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      <span>Buscar Código</span>
                    </button>
                  )}
                </div>
              </form>

              {/* ESTADO EN VIVO DURANTE LA BÚSQUEDA */}
              {isSearching && (
                <div className="mt-6 p-5 rounded-xl bg-[#0E131E] border border-slate-800 text-center animate-in fade-in duration-200">
                  <div className="w-9 h-9 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-2.5" />
                  <p className="text-sm font-semibold text-slate-100">
                    Consultando correo entrante de Netflix
                  </p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {email}
                  </p>
                  <p className="text-xs text-amber-400 mt-2">
                    ⏱️ Esperando emisión ({secondsElapsed} seg)... No cierres la ventana.
                  </p>
                </div>
              )}

              {/* RESULTADO DE LA BÚSQUEDA */}
              {result && !isSearching && (
                <div className="mt-6 animate-in fade-in duration-200">
                  {result.success && result.code ? (
                    result.isLink ? (
                      /* RESULTADO: ENLACE OFICIAL */
                      <div className="p-5 sm:p-6 rounded-xl bg-[#0E131E] border border-slate-800 shadow-md">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>¡Enlace Encontrado con Éxito!</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-100 mb-1">
                          {getActionTitle(result.actionType)}
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">
                          Haz clic a continuación para abrir Netflix y confirmar tu dispositivo de inmediato:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                          <a
                            href={result.code}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Abrir Enlace Oficial de Netflix ↗</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(result.code!)}
                            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition border border-slate-700"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400">¡Enlace Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar Enlace Directo</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="p-3 rounded-lg bg-[#080B10] border border-slate-800 text-[11px] text-blue-300 font-mono break-all select-all">
                          {result.code}
                        </div>
                      </div>
                    ) : (
                      /* RESULTADO: CÓDIGO NUMÉRICO */
                      <div className="p-6 rounded-xl bg-[#0E131E] border border-slate-800 text-center shadow-md">
                        <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{getActionTitle(result.actionType)}</span>
                        </div>

                        <p className="text-xs text-slate-400 mb-3">
                          Ingresa estos dígitos en la pantalla de Netflix:
                        </p>

                        <div className="my-3 py-4 px-8 rounded-2xl bg-[#080B10] border border-slate-800 inline-block shadow-inner">
                          <span className="text-4xl sm:text-5xl font-bold font-mono tracking-widest text-slate-100 select-all">
                            {result.code}
                          </span>
                        </div>

                        <div className="max-w-xs mx-auto mt-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(result.code!)}
                            className="w-full py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>¡Código Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar Código</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-4">
                          Válido por aprox. 15 minutos. Si expiró, vuelve a solicitarlo en la pantalla.
                        </p>
                      </div>
                    )
                  ) : (
                    /* RESULTADO: NO ENCONTRADO O TIMEOUT */
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-amber-300 uppercase tracking-wider text-[11px] mb-1">
                          Aviso de Consulta
                        </div>
                        <p className="text-slate-300 leading-relaxed font-sans mb-3">
                          {result.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSearch()}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 rounded-lg font-medium text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Volver a intentar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <CodigoHelpGuide className="mt-8" />
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#0E121B] py-5 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} HogarPro Streaming. Plataforma de Asistencia Técnica.</p>
      </footer>
    </div>
  );
}
