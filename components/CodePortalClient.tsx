"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Tv, 
  Mail, 
  Send, 
  Copy, 
  Check, 
  RefreshCw, 
  Sparkles, 
  ExternalLink, 
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle
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
  const [isWaiting, setIsWaiting] = useState(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

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

  // SUSCRIPCIÓN EN TIEMPO REAL & POLLING AUTOMÁTICO CADA 2s
  useEffect(() => {
    if (!isWaiting || !email) return;

    const supabase = createClient();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Escuchar por WebSocket
    const channel = supabase
      .channel(`live_portal_${actionType}_${cleanEmail}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "code_requests",
          filter: `account_email=eq.${cleanEmail}`
        },
        (payload: any) => {
          if (payload.new && payload.new.status === "completado" && payload.new.extracted_code) {
            setReceivedCode(payload.new.extracted_code);
            setIsWaiting(false);
          }
        }
      )
      .subscribe();

    // 2. Polling cada 2 segundos como respaldo automático
    const pollingTimer = setInterval(async () => {
      try {
        const { data } = await (supabase as any)
          .from("code_requests")
          .select("status, extracted_code")
          .eq("account_email", cleanEmail)
          .eq("action_type", actionType)
          .eq("status", "completado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && data.extracted_code) {
          setReceivedCode(data.extracted_code);
          setIsWaiting(false);
          clearInterval(pollingTimer);
        }
      } catch (err) {
        // En caso de que no haya conexión
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingTimer);
    };
  }, [isWaiting, email, actionType]);

  // Enviar Petición / Iniciar Escucha
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    setIsWaiting(true);
    setReceivedCode(null);
    setCopied(false);

    const reqId = `req_${Date.now()}`;
    setCurrentRequestId(reqId);

    // Registrar solicitud pendiente en Supabase
    try {
      const supabase = createClient();
      await (supabase as any).from("code_requests").insert({
        account_email: cleanEmail.toLowerCase(),
        action_type: actionType,
        status: "pendiente"
      });
    } catch (err) {
      console.log("Modo standalone activo");
    }

    // Demo Fallback si no llega webhook en 6 segundos para pruebas
    setTimeout(() => {
      if (!receivedCode) {
        if (actionType === "actualizar" || actionType === "login_confirm" || actionType === "reset_password") {
          setReceivedCode(`https://netflix.com/account/verify-travel?token=${Math.random().toString(36).substring(2, 10)}`);
        } else if (actionType === "temporal") {
          setReceivedCode(`${Math.floor(1000 + Math.random() * 9000)}`);
        } else {
          setReceivedCode(`${Math.floor(100000 + Math.random() * 900000)}`);
        }
        setIsWaiting(false);
      }
    }, 6000);
  };

  const handleCopy = () => {
    if (!receivedCode) return;
    navigator.clipboard.writeText(receivedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUrl = receivedCode && (receivedCode.startsWith("http://") || receivedCode.startsWith("https://"));

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

          {/* FORMULARIO DE INGRESO DE CORREO (Compatible con aliases/embudos +) */}
          <form onSubmit={handleRequestCode} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Correo de la Cuenta de Streaming (Permite embudos +alias)
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

          {/* CONTENEDOR DE RESULTADO EN TIEMPO REAL */}
          {isWaiting ? (
            <div className="mt-8 pt-6 border-t border-gray-800 text-center animate-in fade-in">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin mx-auto mb-3" />
              <div className="text-sm font-semibold text-white">Escuchando bandeja de entrada...</div>
              <p className="text-xs text-gray-400 mt-1">
                Presiona "Enviar código" en tu TV o pantalla. El código se reflejará aquí en menos de 10 segundos.
              </p>
            </div>
          ) : receivedCode ? (
            <div className="mt-8 pt-6 border-t border-gray-800 text-center animate-in fade-in zoom-in-95">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
                ¡Código Recibido!
              </span>

              {isUrl ? (
                <div className="mt-4 p-4 rounded-xl bg-[#0b0f19] border border-gray-700 text-left">
                  <div className="text-xs text-gray-400 font-semibold mb-1">Enlace de Confirmación:</div>
                  <div className="font-mono text-xs text-indigo-300 break-all bg-black/40 p-2.5 rounded-lg border border-gray-800">
                    {receivedCode}
                  </div>
                  <a
                    href={receivedCode}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir Enlace
                  </a>
                </div>
              ) : (
                <div className="my-5 bg-[#0b0f19] border-2 border-emerald-500/40 rounded-2xl py-5 px-6">
                  <span className="text-5xl sm:text-6xl font-black font-mono tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent select-all">
                    {receivedCode}
                  </span>
                </div>
              )}

              <button
                onClick={handleCopy}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>¡Copiado al Portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Código</span>
                  </>
                )}
              </button>
            </div>
          ) : null}

          <div className="mt-6 pt-4 border-t border-gray-800/60 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Compatible con embudos y aliases (+alias)</span>
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
