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
  AlertCircle,
  ShieldAlert
} from "lucide-react";
import { getCurrentUser, checkAccountAuthorization } from "@/lib/account-manager";
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
  themeColor,
  buttonGradient
}: CodePagePortalProps) {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<string>("netflix");
  const [isWaiting, setIsWaiting] = useState(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const PLATFORMS = [
    {
      id: "netflix",
      name: "Netflix",
      domain: "netflix.com",
      accent: "#E50914",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 2H9.5V22L5.5 21V2Z" fill="#B81D24" />
          <path d="M14.5 2H18.5V21L14.5 22V2Z" fill="#B81D24" />
          <path d="M5.5 2H9.5L18.5 22H14.5L5.5 2Z" fill="#E50914" />
        </svg>
      )
    }
  ];

  // Contador de segundos en espera
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

  // POLLING INTELIGENTE CADA 3 SEGUNDOS HACIA EL BACKEND
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

    // Primera verificación rápida
    checkCode();
    const interval = setInterval(checkCode, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isWaiting, email, actionType, platform]);

  // Limpia el código para extraer dígitos numéricos o preservar enlaces directos
  const cleanCodeDisplay = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    // Si contiene código de 4 dígitos (estándar Netflix), priorizar 4 dígitos
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

  // Enviar Petición / Iniciar Escucha
  // Enviar Petición / Iniciar Escucha con Verificación de Autorización
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    // 1. REGLA ESTRICTA DE AUTORIZACIÓN:
    // El vendedor solo puede consultar códigos de cuentas asignadas a él y que no estén vencidas
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

    // Disparar búsqueda inmediata a través del proxy seguro del backend
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

    // Registrar solicitud pendiente en Cloud Firestore
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
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Glow de Fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[130px] rounded-full pointer-events-none" />

      {/* HEADER */}
      <header className="border-b border-gray-800/80 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Tienda</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Tv className="w-4 h-4" />
            </div>
            <span className="font-black text-white text-sm tracking-tight">
              HOGAR<span className="text-[#E50914]">PRO</span>
            </span>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-xl w-full mx-auto px-4 py-12 relative z-10 flex-1 flex flex-col justify-center">
        <div className="bg-[#121826]/90 border border-gray-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          
          {/* Badge & Título */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
              {icon}
              <span>{badge}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{title}</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 max-w-md mx-auto">{description}</p>
          </div>

          {/* FORMULARIO DE INGRESO DE CORREO Y SERVICIO */}
          <form onSubmit={handleRequestCode} noValidate className="space-y-4">
            {/* SELECTOR DE SERVICIO / PLATAFORMA */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Selecciona el Servicio
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => {
                  const isSelected = platform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatform(p.id)}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                        isSelected
                          ? "bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                          : "bg-[#0b0f19] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
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
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Correo de la Cuenta de Streaming (+embudo)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="ej: hogaryutu+acido@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>Se buscará solo correos dirigidos a este embudo en {PLATFORMS.find(p => p.id === platform)?.name}.</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isWaiting || !email || !email.includes("@")}
              className={`w-full py-3.5 px-4 rounded-xl bg-gradient-to-r ${buttonGradient} text-white font-bold text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:transform-none`}
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

          {/* MENSAJE DE BLOQUEO POR AUTORIZACIÓN / EXPIRACIÓN */}
          {authError && (
            <div className="mt-6 p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-left animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-900/50 text-red-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
                    Acceso No Autorizado
                  </h4>
                  <p className="text-xs text-red-200/90 mt-1 leading-relaxed">
                    {authError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* RESULTADO: NÚMERO DIRECTO Y GIGANTE */}
          {isWaiting ? (
            <div className="mt-8 pt-6 border-t border-gray-800 text-center animate-in fade-in">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin mx-auto mb-3" />
              <div className="text-sm font-semibold text-white">Escuchando correo entrante...</div>
              <p className="text-xs text-gray-400 mt-1">
                Presiona "Enviar código" en tu TV o pantalla. El código aparecerá aquí automáticamente.
              </p>
            </div>
          ) : receivedCode ? (
            <div className="mt-8 pt-6 border-t border-gray-800 text-center animate-in fade-in zoom-in-95">
              {(receivedCode.startsWith("http://") || receivedCode.startsWith("https://")) ? (
                <>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/80 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-4">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Enlace Oficial Listo</span>
                  </span>

                  <div className="my-3 bg-[#0b0f19] border-2 border-amber-500/40 rounded-2xl p-6 shadow-2xl text-left">
                    <p className="text-xs text-gray-300 font-medium mb-3">
                      Se ha generado tu enlace oficial de acceso/confirmación. Haz clic en el botón a continuación para abrirlo directamente:
                    </p>
                    <a
                      href={receivedCode}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/50 flex items-center justify-center gap-2.5 transition transform hover:scale-[1.02] active:scale-98"
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
                    className="w-full py-2.5 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>¡Enlace copiado al portapapeles!</span>
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
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
                    ¡Código Recibido!
                  </span>

                  {/* NÚMERO DIRECTO GIGANTE */}
                  <div className="my-5 bg-[#0b0f19] border-2 border-emerald-500/40 rounded-2xl py-6 px-6 shadow-2xl">
                    <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent select-all">
                      {receivedCode.replace(/https?:\/\/[^\s]+/g, "").trim() || "8447"}
                    </span>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition transform hover:scale-[1.02]"
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

          <div className="mt-6 pt-4 border-t border-gray-800/60 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sincronización instantánea en vivo</span>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-6 text-center text-xs text-gray-500 border-t border-gray-800/80">
        © 2026 HogarPro • Módulo de Gestión de Códigos
      </footer>
    </div>
  );
}
