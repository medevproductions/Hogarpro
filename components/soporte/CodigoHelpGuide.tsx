"use client";

import React from "react";
import { 
  Tv, 
  Smartphone, 
  ArrowRightCircle, 
  Mail, 
  Search, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Home,
  Plane,
  KeyRound,
  ShieldCheck
} from "lucide-react";

interface CodigoHelpGuideProps {
  className?: string;
  compact?: boolean;
}

export default function CodigoHelpGuide({ className = "", compact = false }: CodigoHelpGuideProps) {
  const steps = [
    {
      step: 1,
      icon: <Smartphone className="w-5 h-5 text-red-500" />,
      title: "Inicia sesión en Netflix",
      desc: "Ve a tu Smart TV, TV Box, computadora o celular e inicia sesión con el correo y contraseña de tu cuenta.",
      highlight: "En tu dispositivo"
    },
    {
      step: 2,
      icon: <ArrowRightCircle className="w-5 h-5 text-amber-500" />,
      title: "Solicita el código o enlace en pantalla",
      desc: "En Netflix, presiona la opción 'Estoy de viaje', 'Actualizar hogar con Netflix' o pide el código de inicio de sesión.",
      highlight: "Opción en Netflix"
    },
    {
      step: 3,
      icon: <Mail className="w-5 h-5 text-blue-400" />,
      title: "Escribe el correo de tu cuenta en el buscador",
      desc: "Ingresa la dirección exacta de correo de tu cuenta de Netflix en la barra de búsqueda de esta página.",
      highlight: "Tu correo exacto"
    },
    {
      step: 4,
      icon: <Search className="w-5 h-5 text-emerald-400" />,
      title: "Pulsa Buscar y espera la respuesta",
      desc: "Haz clic en el botón 'Buscar Código'. El sistema rastreará los servidores de Netflix en tiempo real.",
      highlight: "Búsqueda en tiempo real"
    },
    {
      step: 5,
      icon: <Clock className="w-5 h-5 text-purple-400" />,
      title: "Si no aparece, reintenta en 1 o 2 minutos",
      desc: "Netflix puede demorar entre 30 y 90 segundos en despachar el correo. Si no aparece de inmediato, vuelve a presionar Buscar.",
      highlight: "Tiempo de despacho"
    }
  ];

  return (
    <div className={`w-full rounded-2xl bg-[#141414]/90 border border-[#2a2a2a] p-5 sm:p-7 backdrop-blur-md shadow-2xl relative overflow-hidden ${className}`}>
      {/* Glow ambiental */}
      <div className="absolute -top-16 -right-16 w-52 h-52 bg-red-600/10 blur-[80px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-purple-600/10 blur-[80px] pointer-events-none rounded-full" />

      {/* Título encabezado con gradiente idéntico al solicitado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-pink-900/30">
            <div className="w-full h-full bg-[#141414] rounded-[10px] flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-pink-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 text-transparent bg-clip-text tracking-tight">
              Ayuda: ¿Cómo utilizar esta página?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Guía paso a paso para obtener tus códigos y enlaces de Netflix en segundos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistema Activo 24/7
          </span>
        </div>
      </div>

      {/* Lista interactiva de los 5 Pasos */}
      <div className="space-y-3 mb-6">
        {steps.map((item) => (
          <div
            key={item.step}
            className="group flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl bg-[#1a1a1a]/80 hover:bg-[#222222] border border-[#262626] hover:border-zinc-700 transition-all duration-200 shadow-sm"
          >
            {/* Número del paso con avatar redondo */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-[#E50914] to-[#B81D24] text-white flex items-center justify-center font-black text-xs shadow-md shadow-red-950/50 group-hover:scale-105 transition-transform">
              {item.step}
            </div>

            {/* Contenido del paso */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="shrink-0">{item.icon}</span>
                <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                  {item.title}
                </h4>
                <span className="text-[10px] font-medium text-zinc-400 bg-black/50 px-2 py-0.5 rounded border border-zinc-800 ml-auto">
                  {item.highlight}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed pl-7">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tarjeta explicativa de tipos de códigos (4 dígitos vs 6 dígitos vs enlaces) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#181818] to-[#1e1724] border border-[#30263d] text-xs text-zinc-300">
        <div className="flex items-center gap-2 mb-2 font-bold text-white uppercase text-[11px] tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Tipos de Códigos y Enlaces de Netflix:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
          <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-0.5">
              <Tv className="w-3.5 h-3.5" />
              <span>Código TV (4 dígitos)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Para iniciar sesión en Smart TV o TV Box. Aparece como un número de 4 dígitos.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verificación OTP (6 dígitos)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Código de verificación de 6 dígitos para confirmar identidad. Válido por 15 minutos.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-0.5">
              <Home className="w-3.5 h-3.5" />
              <span>Enlaces Directos (Hogar / Viaje)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Para 'Actualizar Hogar' o 'Estoy de viaje'. Se entrega un enlace HTTPS oficial para activar con 1 clic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
