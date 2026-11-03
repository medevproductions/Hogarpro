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
  Lock
} from "lucide-react";
import CodigoHelpGuide from "@/components/soporte/CodigoHelpGuide";
import { getCurrentUser, SystemUser } from "@/lib/account-manager";

type ActionType = "auto" | "actualizar_hogar" | "acceso_temporal" | "login_code" | "verification_code" | "reset_password";

interface ActionOption {
  id: ActionType;
  label: string;
  badge: string;
  icon: React.ReactNode;
  iconColor: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "auto",
    label: "Detectar Automático",
    badge: "Recomendado",
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    iconColor: "text-amber-400"
  },
  {
    id: "actualizar_hogar",
    label: "Actualizar Hogar",
    badge: "Enlace",
    icon: <Home className="w-4 h-4 text-blue-400" />,
    iconColor: "text-blue-400"
  },
  {
    id: "acceso_temporal",
    label: "Acceso de Viaje",
    badge: "Enlace",
    icon: <Plane className="w-4 h-4 text-sky-400" />,
    iconColor: "text-sky-400"
  },
  {
    id: "login_code",
    label: "Código de Inicio",
    badge: "4 dígitos",
    icon: <Tv className="w-4 h-4 text-emerald-400" />,
    iconColor: "text-emerald-400"
  },
  {
    id: "verification_code",
    label: "Código de Confirmación",
    badge: "6 dígitos",
    icon: <ShieldCheck className="w-4 h-4 text-indigo-400" />,
    iconColor: "text-indigo-400"
  },
  {
    id: "reset_password",
    label: "Cambiar Contraseña",
    badge: "Enlace",
    icon: <KeyRound className="w-4 h-4 text-rose-400" />,
    iconColor: "text-rose-400"
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
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUserState(user);
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    setIsSearching(true);
    setResult(null);
    setCopied(false);

    let attempts = 0;
    const maxAttempts = 12;

    const queryEndpoint = async () => {
      try {
        const res = await fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=netflix&actionType=${encodeURIComponent(selectedAction)}&t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.code) {
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
        return "Acceso Temporal / De Viaje";
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

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200">
      {/* NAVBAR */}
      <header className="border-b border-slate-800/80 bg-[#0E121B]/90 backdrop-blur-md sticky top-0 z-40">
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
            <Link
              href={currentUser?.role === "owner" || (currentUser?.role as string) === "admin" ? "/dashboard/owner" : "/dashboard/seller"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-700 transition shadow-sm"
            >
              <span>{currentUser ? "Ir a mi Panel" : "Acceso Revendedor / Admin"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 sm:py-10 flex-1">
        {!currentUser ? (
          <div className="rounded-2xl bg-[#121722]/95 border border-slate-800 p-8 sm:p-10 text-center shadow-xl max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-[#182030] border border-slate-700 text-slate-300 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Lock className="w-7 h-7 text-rose-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-lg">
              Canal Privado Protegido
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mt-3">Consulta Exclusiva para Revendedores</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              La extracción de códigos y enlaces no está abierta a clientes finales. Como revendedor o administrador, inicia sesión para solicitar los códigos de tus cuentas asignadas.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-xl shadow-sm transition"
              >
                Iniciar Sesión como Revendedor
              </Link>
              <Link
                href="/admin"
                className="w-full sm:w-auto px-5 py-2.5 bg-[#1C2433] hover:bg-[#253043] text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700 transition"
              >
                Acceso Administrador
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Canal Privado • {currentUser.role === "owner" || (currentUser.role as string) === "admin" ? "Administrador" : `Revendedor: ${currentUser.name}`}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Terminal de Códigos Netflix
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mt-2">
                Consulta códigos de 4 dígitos para TV, verificación de 6 dígitos o enlace oficial de Hogar para tus cuentas asignadas.
              </p>
            </div>

            {/* TARJETA DE BÚSQUEDA CENTRAL */}
            <div className="rounded-2xl bg-[#121722]/90 border border-slate-800/80 p-5 sm:p-8 shadow-xl relative overflow-hidden mb-8">
              {/* SELECTOR DE ACCIÓN */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2.5">
                  1. Tipo de solicitud:
                </label>
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
                        className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-1.5 ${
                          isSelected 
                            ? "bg-[#182234] border-blue-500/80 text-slate-100 shadow-sm ring-1 ring-blue-500/30" 
                            : "bg-[#0E131E] border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#131926]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="p-1 rounded-lg bg-slate-800/80">{opt.icon}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                            isSelected ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tracking-tight">
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
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    2. Correo de la cuenta:
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="ej: micuenta@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0E121B] border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 font-sans focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !email.trim()}
                  className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSearching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Buscando en Netflix... ({secondsElapsed}s)</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Buscar Código</span>
                    </>
                  )}
                </button>
              </form>

              {/* RESULTADO DE LA BÚSQUEDA */}
              {isSearching && (
                <div className="mt-6 p-6 rounded-xl bg-[#0E131E] border border-slate-800 text-center animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-100">
                    Rastreando servidores de Netflix para:
                  </p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {email}
                  </p>
                  <p className="text-xs text-amber-400 mt-2">
                    ⏱️ Esperando correo... ({secondsElapsed} seg). Por favor no cierres esta ventana.
                  </p>
                </div>
              )}

              {result && !isSearching && (
                <div className="mt-6 animate-in fade-in duration-200">
                  {result.success && result.code ? (
                    result.isLink ? (
                      <div className="p-6 rounded-xl bg-[#0E131E] border border-slate-800 shadow-md">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>¡Enlace Encontrado con Éxito!</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-100 mb-1">
                          {getActionTitle(result.actionType)}
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">
                          Presiona el botón a continuación para abrir Netflix y confirmar tu dispositivo de inmediato:
                        </p>

                        <div className="space-y-3">
                          <a
                            href={result.code}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Abrir Enlace Oficial de Netflix ↗</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(result.code!)}
                            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition border border-slate-700"
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

                        <div className="mt-3 p-3 rounded-lg bg-[#080B10] border border-slate-800 text-[11px] text-blue-300 font-mono break-all select-all">
                          {result.code}
                        </div>
                      </div>
                    ) : (
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
                          Válido por tiempo limitado (aprox. 15 minutos). Si expiró, vuelve a solicitarlo en la pantalla.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-amber-300 uppercase tracking-wider text-[11px] mb-1">
                          Aviso de Búsqueda
                        </div>
                        <p className="text-slate-300 leading-relaxed font-sans mb-3">
                          {result.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSearch()}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 rounded-lg font-medium text-xs transition inline-flex items-center gap-1.5"
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

      <footer className="border-t border-slate-800/80 bg-[#0E121B] py-6 px-4 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} HogarPro Streaming. Plataforma de Asistencia Técnica.</p>
      </footer>
    </div>
  );
}
