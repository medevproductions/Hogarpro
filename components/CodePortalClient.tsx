"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Tv, 
  Mail, 
  Send, 
  Copy, 
  Check, 
  RefreshCw, 
  ArrowLeft,
  Search,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  ShieldAlert,
  Lock
} from "lucide-react";
import { getCurrentUser, checkAccountAuthorization, SystemUser } from "@/lib/account-manager";
import { createPendingCodeRequestFirestore } from "@/lib/firebase/firestore-service";

interface CodePagePortalProps {
  actionType: "actualizar" | "temporal" | "login_code" | "login_confirm" | "reset_password" | "verification_code" | "actualizar_hogar" | "acceso_temporal";
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  themeColor: string;
  buttonGradient: string;
}

export default function CodePortalClient({
  actionType,
  title,
  badge,
  description,
  icon,
}: CodePagePortalProps) {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<string>("netflix");
  const [isWaiting, setIsWaiting] = useState(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);

  useEffect(() => {
    setCurrentUserState(getCurrentUser());
  }, []);

  const PLATFORMS = [
    {
      id: "netflix",
      name: "Netflix",
      domain: "netflix.com",
      accent: "#EF4444",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 2H9.5V22L5.5 21V2Z" fill="#B81D24" />
          <path d="M14.5 2H18.5V21L14.5 22V2Z" fill="#B81D24" />
          <path d="M5.5 2H9.5L18.5 22H14.5L5.5 2Z" fill="#EF4444" />
        </svg>
      )
    }
  ];

  // Counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isWaiting]);

  // Polling
  useEffect(() => {
    if (!isWaiting || !email) return;

    const cleanEmail = email.toLowerCase().trim();
    let isMounted = true;
    let inFlight = false;

    const checkCode = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(platform)}&actionType=${encodeURIComponent(actionType)}&t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.code && isMounted) {
            const clean = cleanCodeDisplay(json.code);
            if (clean) {
              setReceivedCode(clean);
              setIsWaiting(false);
              return;
            }
          }
        }
      } catch (e) {
        // Silencioso
      } finally {
        inFlight = false;
      }
    };

    checkCode();
    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (isMounted) setIsWaiting(false);
        return;
      }
      checkCode();
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isWaiting, email, actionType, platform]);

  const cleanCodeDisplay = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const match4 = trimmed.match(/\b([0-9]{4})\b/);
    if (match4 && match4[1]) {
      return match4[1];
    }
    const digitMatch = trimmed.match(/\b([0-9]{4,8})\b/);
    if (digitMatch && digitMatch[1]) {
      return digitMatch[1];
    }
    return trimmed;
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    const user = getCurrentUser();
    const authCheck = checkAccountAuthorization(cleanEmail, user);
    if (!authCheck.authorized) {
      setAuthError(authCheck.reason || "No estás autorizado para consultar códigos de esta cuenta.");
      setIsWaiting(false);
      setReceivedCode(null);
      return;
    }

    setIsWaiting(true);
    setReceivedCode(null);
    setCopied(false);

    try {
      fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(platform)}&actionType=${encodeURIComponent(actionType)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.code) {
            const clean = cleanCodeDisplay(data.code);
            if (clean) {
              setReceivedCode(clean);
              setIsWaiting(false);
            }
          }
        })
        .catch(() => {});
    } catch (err) {}

    try {
      await createPendingCodeRequestFirestore({
        account_email: cleanEmail,
        action_type: actionType,
        service: platform
      });
    } catch (err) {}
  };

  const handleCopy = () => {
    if (!receivedCode) return;
    navigator.clipboard.writeText(receivedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200 relative selection:bg-blue-500/30 selection:text-blue-200">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0E121B]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Tienda</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center text-white shadow-sm">
              <Tv className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-100 text-sm tracking-tight">
              HOGAR<span className="text-rose-500">PRO</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto px-4 py-8 relative z-10 flex-1 flex flex-col justify-center">
        {!currentUser ? (
          <div className="bg-[#121722]/95 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl backdrop-blur-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#182030] border border-slate-700 text-slate-300 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Lock className="w-7 h-7 text-rose-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-lg">
              Canal Privado Protegido
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mt-3">Consulta Exclusiva para Revendedores</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              La extracción de códigos y enlaces no está disponible para clientes finales. Como revendedor o administrador, inicia sesión para solicitar los códigos de tus cuentas asignadas.
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
          <div className="bg-[#121722]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl">
            {/* Header of Action */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium mb-3">
                {icon}
                <span>{badge} • {currentUser.role === "owner" || (currentUser.role as string) === "admin" ? "Administrador" : `Revendedor: ${currentUser.name}`}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">{title}</h1>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{description}</p>
            </div>

            <form onSubmit={handleRequestCode} noValidate className="space-y-4">
              {/* Service Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Servicio Seleccionado
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => {
                    const isSelected = platform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlatform(p.id)}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? "bg-[#182030] border-blue-500 text-slate-100 shadow-sm"
                            : "bg-[#0E121B] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        <span className="shrink-0 flex items-center justify-center">{p.icon}</span>
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Correo de la Cuenta de Streaming
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="ej: usuario@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-sans"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Se buscarán correos recientes de Netflix vinculados a este usuario.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isWaiting || !email || !email.includes("@")}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-sm flex items-center justify-center gap-2 transition transform active:scale-[0.99] disabled:opacity-50 disabled:transform-none"
              >
                {isWaiting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Esperando código ({secondsElapsed}s)...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Solicitar Código Ahora</span>
                  </>
                )}
              </button>
            </form>

            {authError && (
              <div className="mt-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-left">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-rose-900/50 text-rose-400 shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-rose-300">
                      Acceso No Autorizado
                    </h4>
                    <p className="text-xs text-rose-200/90 mt-0.5 leading-relaxed">
                      {authError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isWaiting ? (
              <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-3" />
                <div className="text-sm font-semibold text-slate-100">Escuchando correo entrante...</div>
                <p className="text-xs text-slate-400 mt-1">
                  Presiona la opción correspondiente en tu TV o pantalla. El resultado aparecerá aquí automáticamente.
                </p>
              </div>
            ) : receivedCode ? (
              <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                {(receivedCode.startsWith("http://") || receivedCode.startsWith("https://")) ? (
                  <>
                    <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mb-3">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Enlace Oficial Listo</span>
                    </span>

                    <div className="my-2 bg-[#0E131E] border border-slate-800 rounded-xl p-4 text-left shadow-sm">
                      <p className="text-xs text-slate-300 font-medium mb-3">
                        Se ha generado tu enlace oficial de acceso/confirmación. Haz clic para abrirlo directamente:
                      </p>
                      <a
                        href={receivedCode}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition shadow-sm"
                      >
                        <span>
                          {actionType === "actualizar" || actionType === "actualizar_hogar"
                            ? "Actualizar Hogar Ahora" 
                            : actionType === "login_confirm" || actionType === "verification_code"
                            ? "Confirmar Inicio de Sesión"
                            : actionType === "acceso_temporal" || actionType === "temporal"
                            ? "Confirmar Acceso Temporal (Viaje)"
                            : actionType === "reset_password"
                            ? "Restablecer Contraseña"
                            : "Abrir Enlace Oficial en Netflix"}
                        </span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <button
                      onClick={handleCopy}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">¡Enlace copiado al portapapeles!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar enlace directo</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                      ¡Código Recibido!
                    </span>

                    <div className="my-4 bg-[#0E131E] border border-slate-800 rounded-2xl py-6 px-6 shadow-inner">
                      <span className="text-5xl sm:text-6xl font-bold font-mono tracking-widest text-slate-100 select-all">
                        {receivedCode.replace(/https?:\/\/[^\s]+/g, "").trim() || "8447"}
                      </span>
                    </div>

                    <button
                      onClick={handleCopy}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm flex items-center justify-center gap-2 transition"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span>¡Código Copiado al Portapapeles!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Sincronización instantánea en la nube</span>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-800/80">
        © 2026 HogarPro • Plataforma de Gestión de Códigos
      </footer>
    </div>
  );
}
