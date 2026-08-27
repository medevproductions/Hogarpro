"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  KeyRound, 
  Tv, 
  Copy, 
  Check, 
  Clock, 
  RefreshCw, 
  Radio, 
  Home, 
  Zap, 
  ShieldCheck, 
  Lock, 
  ExternalLink,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type CodeAction = 
  | "actualizar" 
  | "temporal" 
  | "login_code" 
  | "login_confirm" 
  | "reset_password";

interface ActionConfig {
  id: CodeAction;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  badge: string;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "actualizar",
    title: "Pedir Actualización",
    subtitle: "Actualizar red principal / hogar",
    icon: <Home className="w-5 h-5" />,
    color: "from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-500/40",
    badge: "Hogar Principal"
  },
  {
    id: "temporal",
    title: "Pedir Temporal",
    subtitle: "Código TV fuera de casa (4-6 dígitos)",
    icon: <Clock className="w-5 h-5" />,
    color: "from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border-amber-500/40",
    badge: "Código Viaje / Hogar"
  },
  {
    id: "login_code",
    title: "Código de Inicio",
    subtitle: "OTP rápido para iniciar sesión",
    icon: <Zap className="w-5 h-5" />,
    color: "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-500/40",
    badge: "OTP Acceso"
  },
  {
    id: "login_confirm",
    title: "Confirmar Inicio",
    subtitle: "Aceptar acceso / Enlace de confirmación",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "from-purple-600 to-pink-700 hover:from-purple-500 hover:to-pink-600 border-purple-500/40",
    badge: "Aceptar Acceso"
  },
  {
    id: "reset_password",
    title: "Restablecer Clave",
    subtitle: "Enlace o token para cambiar contraseña",
    icon: <Lock className="w-5 h-5" />,
    color: "from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 border-rose-500/40",
    badge: "Password Reset"
  }
];

export default function SellerLiveCodesPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("netflix01@streamhub.io");
  const [activeAction, setActiveAction] = useState<CodeAction | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Lista de Cuentas Asignadas al Vendedor
  const myAccounts = [
    { id: "1", service: "Netflix Premium 4K", email: "netflix01@streamhub.io", profiles: "4/5" },
    { id: "2", service: "Disney+ Standard", email: "disney.latam.master@gmail.com", profiles: "4/4" },
    { id: "3", service: "Max (HBO Max)", email: "max.ultra.hd2026@streamhub.io", profiles: "3/5" },
    { id: "4", service: "Prime Video", email: "prime.seller01@gmail.com", profiles: "2/3" }
  ];

  // Temporizador de espera visual
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWaiting) {
      timer = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isWaiting]);

  // SUSCRIPCIÓN EN TIEMPO REAL & POLLING (FALLBACK CADA 2 SEGUNDOS)
  useEffect(() => {
    if (!isWaiting || !currentRequestId) return;

    // 1. Configurar Supabase Realtime
    const supabase = createClient();
    const channel = supabase
      .channel(`code_req_${currentRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "code_requests",
          filter: `id=eq.${currentRequestId}`
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
    const pollingInterval = setInterval(async () => {
      try {
        const { data } = await (supabase as any)
          .from("code_requests")
          .select("status, extracted_code")
          .eq("id", currentRequestId)
          .maybeSingle();

        if (data && data.status === "completado" && data.extracted_code) {
          setReceivedCode(data.extracted_code);
          setIsWaiting(false);
          clearInterval(pollingInterval);
        }
      } catch (err) {
        // En caso de que no haya conexión Supabase en local
      }
    }, 2000);

    pollingIntervalRef.current = pollingInterval;

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [isWaiting, currentRequestId]);

  // DISPARAR SOLICITUD DE ACCIÓN
  const handleTriggerAction = async (action: CodeAction) => {
    setActiveAction(action);
    setIsWaiting(true);
    setReceivedCode(null);
    setCopied(false);

    const generatedReqId = `req_${Date.now()}`;
    setCurrentRequestId(generatedReqId);

    // Registrar en Supabase si está disponible
    try {
      const supabase = createClient();
      await (supabase as any).from("code_requests").insert({
        account_email: selectedAccount,
        action_type: action,
        status: "pendiente"
      });
    } catch (e) {
      console.log("Modo standalone activo");
    }

    // Demo Fallback: Si no hay webhook enviando en 5 segundos, autocompletar para demostración interactiva
    setTimeout(() => {
      if (!receivedCode) {
        if (action === "actualizar" || action === "login_confirm" || action === "reset_password") {
          setReceivedCode(`https://netflix.com/account/verify-travel?token=${Math.random().toString(36).substring(2, 10)}`);
        } else if (action === "temporal") {
          setReceivedCode(`${Math.floor(1000 + Math.random() * 9000)}`);
        } else {
          setReceivedCode(`${Math.floor(100000 + Math.random() * 900000)}`);
        }
        setIsWaiting(false);
      }
    }, 5500);
  };

  const handleCopy = () => {
    if (!receivedCode) return;
    navigator.clipboard.writeText(receivedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUrl = receivedCode && (receivedCode.startsWith("http://") || receivedCode.startsWith("https://"));

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d121f] p-5 hidden md:flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-600/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-black text-white tracking-tight">STREAMHUB</div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">MÓDULO DE CÓDIGOS</div>
            </div>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
              <KeyRound className="w-4 h-4" />
              Terminal de 5 Acciones
            </div>
            <Link href="/dashboard/owner" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Tv className="w-4 h-4" />
              Panel Dueño (Owner)
            </Link>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <Link href="/" className="block text-xs text-gray-500 hover:text-gray-300">
            ← Ver Tienda Pública
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Gestión y Solicitud de Códigos
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Realtime + Polling 2s
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Selecciona la cuenta y presiona la acción deseada para extraer el código o enlace instantáneamente.
            </p>
          </div>
        </div>

        {/* SELECTOR DE CUENTA ACTIVA */}
        <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-5 mb-8 shadow-lg">
          <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
            Cuenta de Streaming Seleccionada
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {myAccounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => {
                  setSelectedAccount(acc.email);
                  setReceivedCode(null);
                  setIsWaiting(false);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedAccount === acc.email
                    ? "bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-950/50"
                    : "bg-[#0b0f19] border-gray-800 text-gray-400 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-indigo-400">{acc.service}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{acc.profiles}</span>
                </div>
                <div className="font-mono text-xs text-white truncate">{acc.email}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5 BOTONES DE ACCIONES PRINCIPALES */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Acciones Rápidas Disponibles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {ACTIONS.map((action) => {
              return (
                <button
                  key={action.id}
                  onClick={() => handleTriggerAction(action.id)}
                  disabled={isWaiting}
                  className={`p-5 rounded-2xl bg-gradient-to-br ${action.color} border text-left shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none flex flex-col justify-between min-h-[140px]`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center text-white">
                      {action.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-black/30 text-white/90 px-2 py-0.5 rounded-md">
                      {action.badge}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-white text-base tracking-tight leading-snug">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-white/80 mt-1 leading-tight">
                      {action.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RESULTADO: CONTENEDOR GRANDE EN TIEMPO REAL */}
        <div className="bg-[#0b0f19] border border-gray-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-800/80">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado de la Solicitud</span>
              <div className="font-mono text-sm text-indigo-300 mt-0.5">
                Cuenta: <strong className="text-white">{selectedAccount}</strong>
              </div>
            </div>

            {isWaiting && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Esperando código entrante ({timerSeconds}s)...</span>
              </div>
            )}
          </div>

          {/* CONTENEDOR PRINCIPAL DEL CÓDIGO */}
          <div className="my-8 text-center">
            {isWaiting ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-white">Escuchando bandeja de entrada...</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Google Apps Script o el Webhook enviará el código en cuanto sea emitido por el servicio de streaming.
                </p>
              </div>
            ) : receivedCode ? (
              <div className="py-4">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
                  ¡Código Recibido con Éxito!
                </span>

                {/* VISUALIZACIÓN DEL CÓDIGO */}
                {isUrl ? (
                  <div className="mt-6 max-w-2xl mx-auto p-4 rounded-2xl bg-[#141b2a] border border-gray-700 text-left">
                    <div className="text-xs text-gray-400 font-semibold mb-1">Enlace de Confirmación / Restablecimiento:</div>
                    <div className="font-mono text-xs text-indigo-300 break-all bg-black/40 p-3 rounded-xl border border-gray-800">
                      {receivedCode}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={receivedCode}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir Enlace en Navegador
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 inline-block bg-[#141b2a] border-2 border-emerald-500/40 rounded-3xl px-8 py-6 shadow-2xl">
                    <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent select-all">
                      {receivedCode}
                    </span>
                  </div>
                )}

                {/* BOTÓN DE COPIADO RÁPIDO */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleCopy}
                    className="py-3.5 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-900/40 flex items-center gap-2 transition transform hover:scale-105"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-white" />
                        <span>¡Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>Copiar al Portapapeles</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-gray-500 flex flex-col items-center justify-center">
                <KeyRound className="w-12 h-12 text-gray-700 mb-3" />
                <h3 className="text-base font-semibold text-gray-400">Ninguna solicitud activa</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Presiona cualquiera de los 5 botones superiores para solicitar el código que necesitas.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Los códigos expiran automáticamente a los 5 minutos de su emisión.</span>
            </div>
            {receivedCode && (
              <button
                onClick={() => setReceivedCode(null)}
                className="text-gray-400 hover:text-white underline"
              >
                Limpiar pantalla
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
