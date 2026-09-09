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
  ShieldCheck,
  ExternalLink,
  KeyRound
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CodePagePortalProps {
  actionType: "actualizar" | "temporal" | "login_code" | "login_confirm" | "reset_password";
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
    },
    {
      id: "disney",
      name: "Disney+",
      domain: "disneyplus.com",
      accent: "#113CCF",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.96 4C7.03 4 3 8.03 3 12.96c0 3.96 2.58 7.32 6.18 8.48-.08-.72-.15-1.83.03-2.62.16-.72 1.05-4.45 1.05-4.45s-.27-.54-.27-1.34c0-1.25.73-2.19 1.63-2.19.77 0 1.14.58 1.14 1.27 0 .77-.49 1.93-.75 3-.21.9.45 1.63 1.34 1.63 1.61 0 2.85-1.7 2.85-4.15 0-2.17-1.56-3.69-3.79-3.69-2.58 0-4.09 1.94-4.09 3.93 0 .78.3 1.62.68 2.07.07.09.08.17.06.26-.07.3-.23.95-.27 1.08-.04.18-.15.22-.34.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.47 0 6.16 2.47 6.16 5.77 0 3.44-2.17 6.21-5.18 6.21-1.01 0-1.96-.53-2.29-1.15l-.62 2.37c-.23.87-.84 1.97-1.26 2.64 1.08.33 2.23.51 3.42.51 4.97 0 9-4.03 9-8.96C20.96 8.03 16.93 4 11.96 4z" fill="#3b82f6"/>
        </svg>
      )
    },
    {
      id: "max",
      name: "Max (HBO)",
      domain: "max.com",
      accent: "#002be7",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#002be7" />
          <path d="M4.5 16V8h2.3l2.2 4 2.2-4h2.3v8h-2V11.2l-1.8 3.2h-1.4l-1.8-3.2V16h-2zm11 0l2.2-8h2.6l2.2 8h-2.1l-.4-1.6h-2.4l-.4 1.6h-1.7zm2.7-3.3h1.7l-.8-3.3-.9 3.3z" fill="#ffffff" />
        </svg>
      )
    },
    {
      id: "prime",
      name: "Prime Video",
      domain: "primevideo.com",
      accent: "#00A8E1",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#00A8E1" />
          <path d="M6 14.5c3.5 2.2 8.5 2.2 12 0-1 .7-2.5 1.3-4.5 1.5-2.5.2-5-.3-7.5-1.5z" fill="#ffffff" />
          <path d="M17.5 13.8c.4.3.8.7 1.1 1.2-.6 0-1.3-.2-2-.5.3-.2.6-.4.9-.7z" fill="#ffffff" />
        </svg>
      )
    },
    {
      id: "spotify",
      name: "Spotify",
      domain: "spotify.com",
      accent: "#1ED760",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1ED760">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10 5.524 0 10-4.476 10-10 0-5.523-4.476-10-10-10zm4.586 14.424a.623.623 0 0 1-.859.206c-2.348-1.434-5.304-1.758-8.786-.963a.625.625 0 1 1-.278-1.218c3.811-.871 7.08-.505 9.717 1.116a.625.625 0 0 1 .206.859zm1.226-2.726a.783.783 0 0 1-1.077.257c-2.688-1.652-6.784-2.131-9.964-1.166a.782.782 0 1 1-.453-1.498c3.633-1.103 8.146-.572 11.237 1.33a.783.783 0 0 1 .257 1.077zm.106-2.836C14.693 8.93 9.4 8.755 6.326 9.689a.938.938 0 1 1-.54-1.8c3.528-1.071 9.38-.868 13.093 1.338a.938.938 0 0 1-.96 1.635z"/>
        </svg>
      )
    },
    {
      id: "crunchyroll",
      name: "Crunchyroll",
      domain: "crunchyroll.com",
      accent: "#F47521",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#F47521">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 17.5a7.5 7.5 0 0 1-5.3-12.8 7.37 7.37 0 0 1 1.9-1.27 8.35 8.35 0 0 0-1.1 4.07 8.5 8.5 0 0 0 8.5 8.5 8.35 8.35 0 0 0 4.07-1.1 7.37 7.37 0 0 1-1.27 1.9A7.44 7.44 0 0 1 12 19.5z"/>
          <circle cx="15.5" cy="11.5" r="2.5" fill="#F47521"/>
        </svg>
      )
    },
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

  const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";

  // POLLING ACTIVO CADA 1 SEGUNDO DIRECTO AL BACKEND + SUPABASE REALTIME + GAS
  useEffect(() => {
    if (!isWaiting || !email) return;

    const cleanEmail = email.toLowerCase().trim();

    // 1. Consultar a GAS directamente y a la API interna
    const fetchLatestCode = async () => {
      try {
        // Consultar primero directo al script de Google Apps Script (inmune a base de datos)
        const gasRes = await fetch(`${GAS_WEBAPP_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(platform)}&t=${Date.now()}`);
        if (gasRes.ok) {
          const gasJson = await gasRes.json();
          if (gasJson.success && gasJson.code) {
            setReceivedCode(cleanCodeDisplay(gasJson.code));
            setIsWaiting(false);
            return;
          }
        }
      } catch (e) {
        // Si hay bloqueo CORS en navegador o tarda, consultar endpoint local
      }

      try {
        const res = await fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(platform)}&t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.code) {
            setReceivedCode(cleanCodeDisplay(json.code));
            setIsWaiting(false);
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    };

    // Ejecutar de inmediato una primera vez
    fetchLatestCode();
    const interval = setInterval(fetchLatestCode, 2000);

    // 2. Suscripción Supabase Realtime como complemento
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`code_channel_${cleanEmail}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "code_requests"
          },
          (payload: any) => {
            if (payload.new && payload.new.account_email?.toLowerCase() === cleanEmail && payload.new.extracted_code) {
              setReceivedCode(cleanCodeDisplay(payload.new.extracted_code));
              setIsWaiting(false);
            }
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    } catch (e) {
      return () => clearInterval(interval);
    }
  }, [isWaiting, email, actionType, platform]);

  // Limpia el código para extraer dígitos numéricos o preservar enlaces directos
  const cleanCodeDisplay = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const digitMatch = trimmed.match(/\b([0-9]{4,8})\b/);
    if (digitMatch && digitMatch[1]) {
      return digitMatch[1];
    }
    return trimmed;
  };

  // Enviar Petición / Iniciar Escucha
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    setIsWaiting(true);
    setReceivedCode(null);
    setCopied(false);

    // Disparar búsqueda inmediata en Google Apps Script
    try {
      fetch(`${GAS_WEBAPP_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(platform)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.code) {
            setReceivedCode(cleanCodeDisplay(data.code));
            setIsWaiting(false);
          }
        })
        .catch(() => {});
    } catch (err) {}

    // Registrar solicitud pendiente en Supabase si está disponible
    try {
      const supabase = createClient();
      await (supabase as any).from("code_requests").insert({
        account_email: cleanEmail,
        action_type: actionType,
        service: platform,
        status: "pendiente"
      });
    } catch (err) {
      console.log("Modo activo");
    }
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
              STREAM<span className="text-indigo-400">HUB</span>
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
              <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                <span>🔍 Se buscará solo correos dirigidos a este embudo en {PLATFORMS.find(p => p.id === platform)?.name}.</span>
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
              {receivedCode.startsWith("http://") || receivedCode.startsWith("https://") ? (
                <>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/80 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-4">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Enlace de Confirmación Listo</span>
                  </span>

                  <div className="my-3 bg-[#0b0f19] border-2 border-amber-500/40 rounded-2xl p-6 shadow-2xl text-left">
                    <p className="text-xs text-gray-300 font-medium mb-3">
                      Se ha generado tu enlace oficial de acceso/actualización. Haz clic en el botón a continuación para abrirlo directamente:
                    </p>
                    <a
                      href={receivedCode}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/50 flex items-center justify-center gap-2.5 transition transform hover:scale-[1.02] active:scale-98"
                    >
                      <span>
                        {actionType === "actualizar" 
                          ? "Actualizar Hogar Ahora" 
                          : actionType === "reset_password" 
                          ? "Restablecer Contraseña" 
                          : "Completar Verificación"}
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
                      {receivedCode}
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
        © 2026 StreamHub Pro • Módulo de Gestión de Códigos
      </footer>
    </div>
  );
}
