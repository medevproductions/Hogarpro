"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Smartphone,
  Share2,
  Lock
} from "lucide-react";
import CodigoHelpGuide from "@/components/soporte/CodigoHelpGuide";
import { getCurrentUser, checkAccountAuthorization, SystemUser } from "@/lib/account-manager";

type ActionType = "auto" | "actualizar_hogar" | "acceso_temporal" | "login_code" | "verification_code" | "reset_password";

interface ActionOption {
  id: ActionType;
  label: string;
  badge: string;
  icon: React.ReactNode;
  color: string;
  activeClass: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "auto",
    label: "Todo (Detectar Automático)",
    badge: "Recomendado",
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    color: "amber",
    activeClass: "bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-500 shadow-amber-900/40"
  },
  {
    id: "actualizar_hogar",
    label: "Actualizar Hogar",
    badge: "Link",
    icon: <Home className="w-3.5 h-3.5 text-red-400" />,
    color: "red",
    activeClass: "bg-gradient-to-r from-[#E50914] to-[#B81D24] text-white border-red-500 shadow-red-950/50"
  },
  {
    id: "acceso_temporal",
    label: "Acceso Temporal / Viaje",
    badge: "Link",
    icon: <Plane className="w-3.5 h-3.5 text-blue-400" />,
    color: "blue",
    activeClass: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-blue-900/40"
  },
  {
    id: "login_code",
    label: "Código TV (4 Dígitos)",
    badge: "4 dígitos",
    icon: <Tv className="w-3.5 h-3.5 text-emerald-400" />,
    color: "emerald",
    activeClass: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-emerald-900/40"
  },
  {
    id: "verification_code",
    label: "Verificación OTP",
    badge: "6 dígitos",
    icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />,
    color: "purple",
    activeClass: "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500 shadow-purple-900/40"
  },
  {
    id: "reset_password",
    label: "Restablecer Contraseña",
    badge: "Link",
    icon: <KeyRound className="w-3.5 h-3.5 text-yellow-400" />,
    color: "yellow",
    activeClass: "bg-gradient-to-r from-amber-700 to-yellow-600 text-white border-yellow-500 shadow-yellow-900/40"
  }
];

export default function SoporteCodigosPage() {
  const [email, setEmail] = useState("");
  const [selectedAction, setSelectedAction] = useState<ActionType>("auto");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    code?: string;
    actionType?: string;
    isLink?: boolean;
    message?: string;
    success?: boolean;
  } | null>(null);
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUserState(user);
  }, []);

  // Limpiar temporizador al desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Contador mientras busca
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSearching) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // Ejecución de búsqueda de código
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setResult({
        success: false,
        message: "Por favor ingresa una dirección de correo válida de Netflix."
      });
      return;
    }

    // ACCESO PRIVADO ESTRICTO: Solo Revendedores y Administrador pueden consultar códigos
    const user = getCurrentUser();
    if (!user) {
      setResult({
        success: false,
        message: "Acceso denegado: La consulta de códigos es exclusiva para Revendedores Autorizados y el Administrador. Los clientes finales no pueden consultar códigos directamente."
      });
      return;
    }

    // Comprobar estado de autorización (el revendedor solo puede consultar sus cuentas asignadas)
    const authCheck = checkAccountAuthorization(cleanEmail, user, false);
    if (!authCheck.authorized) {
      setResult({
        success: false,
        message: authCheck.reason || "No tienes autorización para consultar códigos de esta cuenta."
      });
      return;
    }

    setIsSearching(true);
    setResult(null);
    setCopied(false);

    const queryEndpoint = async () => {
      try {
        const res = await fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=netflix&actionType=${encodeURIComponent(selectedAction)}&t=${Date.now()}`);
        const data = await res.json();

        if (data && data.success && data.code) {
          const rawCode = String(data.code).trim();
          const isUrl = rawCode.startsWith("http://") || rawCode.startsWith("https://");
          setResult({
            success: true,
            code: rawCode,
            actionType: data.actionType || selectedAction,
            isLink: isUrl
          });
          setIsSearching(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          return true;
        } else {
          return false;
        }
      } catch (err: any) {
        return false;
      }
    };

    // 1. Verificación inicial inmediata
    const found = await queryEndpoint();
    if (found) return;

    // 2. Si no aparece de inmediato, iniciar polling inteligente por hasta 45 segundos
    let attempts = 0;
    const maxAttempts = 15; // 15 * 3s = 45s
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

  const handleCopyCode = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const getActionTitle = (type?: string) => {
    switch (type) {
      case "actualizar_hogar":
        return "Aprobación de Hogar Netflix";
      case "acceso_temporal":
        return "Acceso Temporal / De Viaje";
      case "reset_password":
        return "Restablecimiento de Contraseña";
      case "verification_code":
        return "Código de Verificación (OTP)";
      case "login_code":
        return "Código de Inicio de Sesión (TV)";
      default:
        return "Código o Enlace Encontrado";
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-zinc-100 flex flex-col justify-between selection:bg-[#E50914] selection:text-white">
      {/* NAVBAR */}
      <header className="border-b border-[#222222] bg-[#141414]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E50914] to-[#B81D24] flex items-center justify-center font-bold text-white shadow-md shadow-red-950/50 group-hover:scale-105 transition-transform">
              <Tv className="w-4 h-4" />
            </div>
            <div className="font-black text-sm text-white tracking-tight">
              HOGAR<span className="text-[#E50914]">PRO</span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href={currentUser?.role === "owner" || (currentUser?.role as string) === "admin" ? "/dashboard/owner" : "/dashboard/seller"}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#b80710] text-xs font-bold text-white transition shadow-sm"
            >
              <span>{currentUser ? "Ir a mi Panel" : "Acceso Revendedor / Admin"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 flex-1">
        {/* PANTALLA DE ACCESO RESTRINGIDO SI NO HAY SESIÓN INICIADA */}
        {!currentUser ? (
          <div className="rounded-3xl bg-[#141414] border-2 border-red-500/40 p-8 sm:p-12 text-center shadow-2xl max-w-lg mx-auto my-8 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/50 text-[#E50914] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-950/50">
              <Lock className="w-8 h-8" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E50914] bg-red-950/60 border border-red-500/30 px-3 py-1 rounded-full">
              Canal Privado Protegido
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Consulta Exclusiva para Revendedores</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              La extracción de códigos y enlaces no está abierta a clientes finales. Como revendedor o administrador, inicia sesión para solicitar los códigos de tus cuentas asignadas.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/60 transition"
              >
                Iniciar Sesión como Revendedor
              </Link>
              <Link
                href="/admin"
                className="w-full sm:w-auto px-6 py-3 bg-[#222222] hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs rounded-xl border border-zinc-700 transition"
              >
                Acceso Administrador
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* ENCABEZADO Y TÍTULO */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Canal Privado • {currentUser.role === "owner" || (currentUser.role as string) === "admin" ? "Administrador Maestro" : `Revendedor: ${currentUser.name}`}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                Soporte de Códigos Netflix
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto mt-2">
                Consulta códigos de 4 dígitos para TV, verificación de 6 dígitos o enlace oficial de Hogar para tus cuentas asignadas.
              </p>
            </div>

        {/* TARJETA DE BÚSQUEDA CENTRAL */}
        <div className="rounded-3xl bg-[#141414] border border-[#2a2a2a] p-5 sm:p-8 shadow-2xl relative overflow-hidden mb-8">
          {/* Glows */}
          <div className="absolute top-0 right-1/4 w-60 h-60 bg-red-600/10 blur-[90px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-purple-600/10 blur-[90px] rounded-full pointer-events-none" />

          {/* SELECTOR DE ACCIÓN / FILTRO */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
              1. Selecciona lo que necesitas:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-1.5 shadow-sm ${
                      isSelected 
                        ? opt.activeClass 
                        : "bg-[#1c1c1c] border-[#292929] hover:border-zinc-700 text-zinc-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-1 rounded-md bg-black/40">{opt.icon}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-black/30 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {opt.badge}
                      </span>
                    </div>
                    <span className="text-xs font-bold tracking-tight">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FORMULARIO DE BÚSQUEDA */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                2. Ingresa el correo de tu cuenta:
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="ej: micuenta@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] hover:border-[#E50914] focus:border-[#E50914] rounded-2xl pl-12 pr-4 py-4 text-sm sm:text-base text-white placeholder-zinc-500 font-mono focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching || !email.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#E50914] via-red-600 to-[#B81D24] hover:brightness-110 active:scale-[0.99] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-red-950/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Buscando Código en Netflix... ({secondsElapsed}s)</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Buscar Código o Enlace</span>
                </>
              )}
            </button>
          </form>

          {/* RESULTADO DE LA BÚSQUEDA */}
          {isSearching && (
            <div className="mt-6 p-6 rounded-2xl bg-[#1a1a1a] border border-zinc-800 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-white">
                Rastreando servidores de Netflix para:
              </p>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                {email}
              </p>
              <p className="text-xs text-amber-400 mt-3">
                ⏱️ Esperando correo... ({secondsElapsed} seg). Por favor no cierres esta ventana.
              </p>
            </div>
          )}

          {result && !isSearching && (
            <div className="mt-6 animate-in fade-in zoom-in-95 duration-200">
              {result.success && result.code ? (
                result.isLink ? (
                  /* RESULTADO: ENLACE OFICIAL DE NETFLIX */
                  <div className="p-6 rounded-2xl bg-gradient-to-b from-[#181818] to-[#121212] border border-red-500/40 shadow-2xl">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>¡Enlace Encontrado con Éxito!</span>
                    </div>

                    <h3 className="text-lg font-black text-white mb-1">
                      {getActionTitle(result.actionType)}
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      Presiona el botón a continuación para abrir Netflix y confirmar tu dispositivo de inmediato:
                    </p>

                    <div className="space-y-3">
                      <a
                        href={result.code}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-6 bg-[#E50914] hover:bg-[#b80710] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-red-950/50"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Abrir Enlace Oficial de Netflix ↗</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleCopyCode(result.code!)}
                        className="w-full py-3 px-4 bg-[#222222] hover:bg-[#2b2b2b] text-zinc-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition border border-zinc-800"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">¡Enlace Copiado al Portapapeles!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Enlace Directo</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-black/60 border border-zinc-800/80 text-[11px] text-zinc-400 font-mono break-all">
                      {result.code}
                    </div>
                  </div>
                ) : (
                  /* RESULTADO: CÓDIGO NUMÉRICO (4 DÍGITOS TV O 6 DÍGITOS OTP) */
                  <div className="p-6 rounded-2xl bg-gradient-to-b from-[#181818] to-[#121212] border border-emerald-500/40 shadow-2xl text-center">
                    <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{getActionTitle(result.actionType)}</span>
                    </div>

                    <p className="text-xs text-zinc-400 mb-4">
                      Ingresa estos dígitos en la pantalla de Netflix:
                    </p>

                    <div className="my-4 py-4 px-6 rounded-2xl bg-black/80 border border-emerald-500/30 inline-block shadow-inner">
                      <span className="text-4xl sm:text-5xl font-black font-mono tracking-[0.3em] text-white selection:bg-emerald-500">
                        {result.code}
                      </span>
                    </div>

                    <div className="max-w-xs mx-auto mt-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(result.code!)}
                        className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/50"
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

                    <p className="text-[11px] text-zinc-500 mt-4">
                      Válido por tiempo limitado. Si expiró, vuelve a solicitarlo en la pantalla.
                    </p>
                  </div>
                )
              ) : (
                /* MENSAJE DE NO ENCONTRADO O ERROR */
                <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 shadow-xl">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px] mb-1">
                      Aviso de Búsqueda:
                    </div>
                    <p className="text-zinc-200 leading-relaxed font-sans mb-3">
                      {result.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSearch()}
                      className="px-4 py-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 rounded-lg font-bold text-xs transition inline-flex items-center gap-1.5"
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

        {/* GUÍA PASO A PASO: ¿CÓMO UTILIZAR ESTA PÁGINA? */}
        <CodigoHelpGuide className="mt-8" />
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1f1f1f] bg-[#111111] py-6 px-4 text-center text-xs text-zinc-500">
        <p>© {new Date().getFullYear()} HogarPro Streaming. Todos los derechos reservados.</p>
        <p className="text-[11px] text-zinc-600 mt-1">
          Netflix es una marca registrada de Netflix, Inc. Este portal es una herramienta de asistencia técnica para clientes autorizados.
        </p>
      </footer>
    </div>
  );
}
