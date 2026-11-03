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
  ShieldCheck,
  Home,
  Info
} from "lucide-react";

interface CodigoHelpGuideProps {
  className?: string;
  compact?: boolean;
}

export default function CodigoHelpGuide({ className = "" }: CodigoHelpGuideProps) {
  const steps = [
    {
      step: 1,
      icon: <Smartphone className="w-4 h-4 text-slate-400" />,
      title: "Inicia sesión en Netflix",
      desc: "Ve a tu Smart TV, TV Box, computadora o celular e inicia sesión con el correo y contraseña de tu cuenta.",
      highlight: "En tu pantalla"
    },
    {
      step: 2,
      icon: <ArrowRightCircle className="w-4 h-4 text-blue-400" />,
      title: "Solicita el código o enlace en pantalla",
      desc: "En Netflix, presiona la opción 'Estoy de viaje', 'Actualizar hogar con Netflix' o pide el código de inicio de sesión.",
      highlight: "Opción en Netflix"
    },
    {
      step: 3,
      icon: <Mail className="w-4 h-4 text-sky-400" />,
      title: "Escribe el correo de tu cuenta en el buscador",
      desc: "Ingresa la dirección exacta de correo de tu cuenta de Netflix en la barra de búsqueda de esta página.",
      highlight: "Tu correo exacto"
    },
    {
      step: 4,
      icon: <Search className="w-4 h-4 text-emerald-400" />,
      title: "Pulsa Buscar y espera la respuesta",
      desc: "Haz clic en el botón 'Buscar Código'. El sistema rastreará los servidores de Netflix en tiempo real.",
      highlight: "Tiempo real"
    },
    {
      step: 5,
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      title: "Si no aparece, reintenta en 1 o 2 minutos",
      desc: "Netflix puede demorar entre 30 y 90 segundos en despachar el correo. Si no aparece de inmediato, vuelve a presionar Buscar.",
      highlight: "Despacho Netflix"
    }
  ];

  return (
    <div className={`w-full rounded-2xl bg-[#121722]/90 border border-slate-800/80 p-5 sm:p-7 shadow-xl backdrop-blur-xl ${className}`}>
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-sm">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Guía de Ayuda: ¿Cómo obtener tus códigos?
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Instrucciones paso a paso para extraer códigos y enlaces de Netflix en segundos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Servicio Activo 24/7
          </span>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-2.5 mb-6">
        {steps.map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#0E131E] border border-slate-800/80 hover:border-slate-700 transition-all duration-150"
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-semibold text-xs">
              {item.step}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="shrink-0">{item.icon}</span>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-100">
                  {item.title}
                </h4>
                <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-auto">
                  {item.highlight}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-6">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Explanation Cards */}
      <div className="p-4 rounded-xl bg-[#0E131E] border border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2 mb-2.5 font-semibold text-slate-200 text-xs tracking-wider">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Tipos de Códigos y Enlaces Soportados</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-lg bg-[#141A25] border border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1">
              <Tv className="w-3.5 h-3.5" />
              <span>Código de Inicio (4 dígitos)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Para iniciar sesión en Smart TV o TV Box. Formato numérico de 4 dígitos.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#141A25] border border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-sky-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Código de Confirmación (6 dígitos)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Código numérico de 6 dígitos para validar acceso. Válido por 15 minutos.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#141A25] border border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-blue-400 mb-1">
              <Home className="w-3.5 h-3.5" />
              <span>Enlaces Directos HTTPS</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Para 'Actualizar Hogar' o 'Estoy de viaje'. Enlace oficial directo para confirmar con 1 clic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
