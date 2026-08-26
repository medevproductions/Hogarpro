"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  KeyRound, 
  Tv, 
  Calendar, 
  Copy, 
  Check, 
  Send, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  Shield, 
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Radio
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SellerAccount {
  id: string;
  service: string;
  email: string;
  profilesSold: number;
  maxProfiles: number;
  expirationDate: string;
  status: "active" | "expiring";
}

interface LiveCodeLog {
  id: string;
  accountEmail: string;
  codeType: string;
  code: string | null;
  status: "pending" | "received" | "expired";
  timestamp: string;
}

export default function SellerLiveCodesPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("netflix01@streamhub.io");
  const [requestType, setRequestType] = useState<string>("access_code");
  const [isRequesting, setIsRequesting] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Cuentas asignadas al Vendedor
  const myAccounts: SellerAccount[] = [
    {
      id: "1",
      service: "Netflix Premium 4K",
      email: "netflix01@streamhub.io",
      profilesSold: 4,
      maxProfiles: 5,
      expirationDate: "2026-08-31",
      status: "active"
    },
    {
      id: "2",
      service: "Disney+ Standard",
      email: "disney.family.latam@gmail.com",
      profilesSold: 4,
      maxProfiles: 4,
      expirationDate: "2026-09-02",
      status: "active"
    },
    {
      id: "3",
      service: "Max (HBO Max)",
      email: "max.seller.accounts@gmail.com",
      profilesSold: 2,
      maxProfiles: 5,
      expirationDate: "2026-08-28",
      status: "expiring"
    }
  ];

  // Historial de solicitudes de códigos en vivo
  const [codeLogs, setCodeLogs] = useState<LiveCodeLog[]>([
    {
      id: "req-101",
      accountEmail: "netflix01@streamhub.io",
      codeType: "Código de Acceso (Inicio de Sesión)",
      code: "839 204",
      status: "received",
      timestamp: "Hace 4 minutos"
    },
    {
      id: "req-102",
      accountEmail: "disney.family.latam@gmail.com",
      codeType: "Verificación de Hogar / Temporal",
      code: "https://netflix.com/account/travel/verify?token=89af92",
      status: "received",
      timestamp: "Hace 22 minutos"
    }
  ]);

  // Manejador del botón crítico: Solicitar Código
  const handleRequestCode = () => {
    setIsRequesting(true);

    const typeNames: Record<string, string> = {
      access_code: "Código de Acceso (OTP)",
      temp_code: "Código Temporal (Viaje / Hogar)",
      household_update: "Actualización de Hogar",
      verification: "Código de Verificación",
      reset_password: "Restablecer Contraseña"
    };

    const newReqId = `req-${Date.now()}`;
    const pendingItem: LiveCodeLog = {
      id: newReqId,
      accountEmail: selectedAccount,
      codeType: typeNames[requestType] || "Código de Acceso",
      code: null,
      status: "pending",
      timestamp: "Justo ahora"
    };

    // Agregar a la cola en estado pendiente
    setCodeLogs((prev) => [pendingItem, ...prev]);

    // Simulación de llegada de Webhook / Push de Supabase Realtime (3.5 segundos)
    setTimeout(() => {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setCodeLogs((prev) =>
        prev.map((item) =>
          item.id === newReqId
            ? { ...item, code: `${generatedOtp.slice(0, 3)} ${generatedOtp.slice(3)}`, status: "received" }
            : item
        )
      );
      setIsRequesting(false);
    }, 3500);
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

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
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">PANEL SELLER</div>
            </div>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            <Link href="/dashboard/seller" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
              <KeyRound className="w-4 h-4" />
              Terminal de Códigos
            </Link>
            <a href="#mis-cuentas" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Tv className="w-4 h-4" />
              Mis Cuentas Asignadas
            </a>
            <a href="#renovaciones" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Calendar className="w-4 h-4" />
              Calendario Renovaciones
            </a>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <Link href="/dashboard/owner" className="block text-xs text-indigo-400 hover:underline mb-2">
            ⇄ Cambiar a Vista Dueño (Owner)
          </Link>
          <Link href="/login" className="block text-xs text-gray-500 hover:text-gray-300">
            Cerrar Sesión
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Terminal de Códigos en Tiempo Real
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live WebSocket
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Solicita códigos OTP, enlaces de hogar y confirmaciones directamente a tus clientes sin esperar.
            </p>
          </div>
        </div>

        {/* SECCIÓN CRÍTICA DE SOLICITUD DE CÓDIGOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Formulario de Disparo de Código */}
          <div className="lg:col-span-1 bg-[#121826] border border-gray-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              1. Solicitar Código Automatizado
            </h2>

            <div className="space-y-4">
              {/* Selección de Cuenta */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Selecciona la Cuenta
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  {myAccounts.map((acc) => (
                    <option key={acc.id} value={acc.email}>
                      [{acc.service}] {acc.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selección de Tipo de Código */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Tipo de Código Requerido
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="access_code">Código de Acceso / Inicio de Sesión</option>
                  <option value="temp_code">Código Temporal de Viaje (Netflix)</option>
                  <option value="household_update">Actualización de Hogar Principal</option>
                  <option value="verification">Código de Verificación General</option>
                  <option value="reset_password">Restablecer Contraseña</option>
                </select>
              </div>

              {/* Botón Disparador */}
              <button
                onClick={handleRequestCode}
                disabled={isRequesting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Esperando correo entrante...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Pedir Código Ahora
                  </>
                )}
              </button>

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                El sistema escuchará automáticamente el correo entrante de la plataforma y te mostrará el código en menos de 10 segundos.
              </p>
            </div>
          </div>

          {/* Terminal de Códigos en Vivo */}
          <div className="lg:col-span-2 bg-[#0c101a] border border-gray-800/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Códigos Recibidos Recientes</h2>
                </div>
                <span className="text-xs text-gray-500">Auto-sincronizado con Webhook</span>
              </div>

              <div className="space-y-3">
                {codeLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-xl border transition-all ${
                      log.status === "pending"
                        ? "bg-amber-950/20 border-amber-500/40 animate-pulse"
                        : "bg-[#141b2a] border-gray-700/70"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-indigo-300">
                          {log.accountEmail}
                        </span>
                        <span className="text-[11px] text-gray-400">• {log.codeType}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.timestamp}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/80">
                      {log.status === "pending" ? (
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Esperando extracción del correo vía Webhook...
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 uppercase font-semibold">Código:</span>
                          <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-500/30">
                            {log.code}
                          </span>
                        </div>
                      )}

                      {log.code && (
                        <button
                          onClick={() => handleCopyCode(log.code || "", log.id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 font-medium flex items-center gap-1.5 transition"
                        >
                          {copiedCodeId === log.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Código</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-500">
              <span>Los códigos expiran automáticamente a los 5 minutos de su emisión.</span>
              <button
                onClick={() => setCodeLogs((prev) => prev.slice(0, 1))}
                className="hover:text-gray-400 underline"
              >
                Limpiar historial
              </button>
            </div>
          </div>
        </div>

        {/* LISTA DE CUENTAS ASIGNADAS AL VENDEDOR */}
        <section id="mis-cuentas" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-emerald-400" />
                Mis Cuentas de Streaming Asignadas
              </h2>
              <p className="text-xs text-gray-400">Cuentas bajo tu administración para venta de perfiles</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myAccounts.map((acc) => (
              <div key={acc.id} className="p-4 rounded-xl bg-[#0e1320] border border-gray-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-400">{acc.service}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 font-semibold">
                      {acc.profilesSold}/{acc.maxProfiles} Vendidos
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white font-medium truncate mb-2">{acc.email}</div>
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                  <span>Vence: <strong className="text-gray-200">{formatDate(acc.expirationDate)}</strong></span>
                  <button
                    onClick={() => {
                      setSelectedAccount(acc.email);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Pedir Código →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
