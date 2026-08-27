"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  Tv, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Flame, 
  CheckCircle2, 
  CreditCard, 
  ArrowRight, 
  UserCheck, 
  Copy, 
  Headphones, 
  ChevronDown, 
  ExternalLink,
  Home,
  Clock,
  KeyRound,
  Lock,
  Radio,
  FileCode2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  stock: number;
  color: string;
  features: string[];
  badge?: string;
  popular?: boolean;
}

const SERVICES: ServiceItem[] = [
  {
    id: "netflix-4k",
    name: "Netflix Premium Ultra HD",
    category: "4K HDR • 1 Pantalla",
    price: 3.50,
    originalPrice: 7.99,
    stock: 14,
    color: "from-red-600 to-red-900",
    badge: "Más Vendido",
    popular: true,
    features: [
      "Calidad 4K Ultra HD + HDR",
      "Perfil individual con PIN exclusivo",
      "Códigos de acceso al instante 24/7",
      "Garantía total de 30 días"
    ]
  },
  {
    id: "disney-std",
    name: "Disney+ & Star+ Combo",
    category: "Full HD • 1 Pantalla",
    price: 2.50,
    originalPrice: 5.99,
    stock: 8,
    color: "from-blue-600 to-indigo-900",
    features: [
      "Catálogo Disney, Marvel, Star & ESPN",
      "Sin interrupciones ni caídas",
      "Descargas offline disponibles",
      "Soporte inmediato por WhatsApp"
    ]
  },
  {
    id: "max-plat",
    name: "Max (HBO Max) Platino",
    category: "4K Dolby Atmos • 1 Pantalla",
    price: 2.50,
    originalPrice: 4.99,
    stock: 19,
    color: "from-purple-600 to-blue-900",
    badge: "Promo",
    features: [
      "Series HBO, Warner Bros & DC",
      "Audio envolvente Dolby Atmos",
      "Perfil renovable mes a mes",
      "Activación en menos de 5 min"
    ]
  },
  {
    id: "prime-vid",
    name: "Amazon Prime Video",
    category: "UHD • 1 Pantalla",
    price: 2.00,
    originalPrice: 4.50,
    stock: 5,
    color: "from-sky-500 to-blue-800",
    features: [
      "Películas exclusivas y Prime Originals",
      "Calidad Ultra HD en cualquier dispositivo",
      "Perfil privado con tu nombre",
      "Reemplazo inmediato por fallas"
    ]
  },
  {
    id: "spotify-fam",
    name: "Spotify Premium",
    category: "Música Sin Límites • Cuenta Propia",
    price: 2.00,
    originalPrice: 5.99,
    stock: 22,
    color: "from-emerald-500 to-green-900",
    features: [
      "Audio en máxima fidelidad (320 kbps)",
      "Sin anuncios en música ni podcasts",
      "A tu propio correo personal",
      "Listas y descargas activas"
    ]
  },
  {
    id: "crunchy-mega",
    name: "Crunchyroll Mega Fan",
    category: "Anime HD • Sin Anuncios",
    price: 2.00,
    originalPrice: 3.99,
    stock: 11,
    color: "from-orange-500 to-amber-800",
    features: [
      "Simulcast estreno 1h después de Japón",
      "Visionado sin anuncios ni restricciones",
      "Acceso ilimitado a manga",
      "Garantía mes completo"
    ]
  }
];

const SHORT_ENDPOINTS = [
  { path: "/actualizar", title: "Actualizar Hogar", desc: "Red principal y enlaces de verificación", icon: <Home className="w-4 h-4 text-blue-400" /> },
  { path: "/temporal", title: "Código Temporal", desc: "TV fuera de casa (4 a 6 dígitos)", icon: <Clock className="w-4 h-4 text-amber-400" /> },
  { path: "/codigo", title: "Código de Inicio", desc: "OTP numérico de acceso", icon: <Zap className="w-4 h-4 text-emerald-400" /> },
  { path: "/confirmar", title: "Confirmar Inicio", desc: "Aceptar acceso y links", icon: <ShieldCheck className="w-4 h-4 text-purple-400" /> },
  { path: "/clave", title: "Restablecer Clave", desc: "Cambio de contraseña", icon: <Lock className="w-4 h-4 text-rose-400" /> }
];

export default function PublicStorePage() {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);
  const [isSupportDropdownOpen, setIsSupportDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMethod(id);
    setTimeout(() => setCopiedMethod(null), 2000);
  };

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSupportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-gray-100 selection:bg-indigo-500 selection:text-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-gray-800/80 bg-[#090d16]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-indigo-300 bg-clip-text text-transparent">
                STREAM<span className="text-indigo-400">HUB</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 rounded-full">
                OFICIAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* BOTÓN DESPLEGABLE DE SOPORTE / ENDPOINTS */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsSupportDropdownOpen(!isSupportDropdownOpen)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#121826] hover:bg-gray-800 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl transition flex items-center gap-2 shadow-md"
              >
                <Headphones className="w-4 h-4 text-indigo-400" />
                <span>Soporte & Endpoints</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSupportDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Menú Desplegable */}
              {isSupportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#121826] border border-gray-700 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-gray-800">
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Endpoints Cortos del Sistema
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      URLs simplificadas para enviar códigos o consultar estado
                    </div>
                  </div>

                  <div className="py-2 space-y-1.5">
                    {SHORT_ENDPOINTS.map((ep) => (
                      <Link
                        key={ep.path}
                        href={ep.path}
                        target="_blank"
                        onClick={() => setIsSupportDropdownOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-800/70 border border-transparent hover:border-gray-700 transition group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center">
                            {ep.icon}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white group-hover:text-indigo-300 flex items-center gap-1.5">
                              <span>{ep.title}</span>
                              <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-500/20">{ep.path}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">{ep.desc}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-300" />
                      </Link>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between px-2 text-[11px]">
                    <Link
                      href="/dashboard/seller"
                      onClick={() => setIsSupportDropdownOpen(false)}
                      className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Ir al Terminal de Códigos
                    </Link>
                    <a
                      href="https://wa.me/584120000000?text=Hola,%20necesito%20soporte%20tecnico"
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-400 hover:text-white"
                    >
                      WhatsApp 24/7
                    </a>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/login"
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-xl transition"
            >
              Iniciar Sesión
            </Link>
            <a
              href="#catalogo"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              Ver Catálogo
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Entrega Automática y Códigos 24/7 en Tiempo Real</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.15]">
            Tus Cuentas de Streaming Favoritas al{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              Mejor Precio
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
            Disfruta de Netflix, Disney+, Max y más sin caídas. Activación instantánea, perfiles con PIN privado y soporte garantizado.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Garantía de 30 Días</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Activación en 5 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>+3,500 Clientes Satisfechos</span>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOGO SECTION */}
      <section id="catalogo" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Flame className="w-7 h-7 text-amber-500" />
              Plataformas Disponibles
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Selecciona tu plan y paga mediante Binance, Pago Móvil o Zelle.
            </p>
          </div>
          <span className="mt-4 sm:mt-0 inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Stock Actualizado en Vivo
          </span>
        </div>

        {/* PRODUCT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((srv) => (
            <div
              key={srv.id}
              className={`relative rounded-2xl bg-gradient-to-b from-[#161d2d] to-[#0f1422] border ${
                srv.popular ? "border-indigo-500/60 shadow-xl shadow-indigo-950/50" : "border-gray-800/80"
              } p-6 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:border-indigo-400/80`}
            >
              {srv.badge && (
                <div className="absolute -top-3 right-6 bg-gradient-to-r from-pink-600 to-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                  {srv.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                    {srv.category}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-800/80 text-gray-300 border border-gray-700">
                    Stock: <strong className="text-emerald-400">{srv.stock} disp.</strong>
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight">{srv.name}</h3>

                <div className="mt-4 mb-6 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-white">
                    {formatCurrency(srv.price)}
                  </span>
                  <span className="text-sm text-gray-500 line-through">
                    {formatCurrency(srv.originalPrice)}
                  </span>
                  <span className="text-xs font-medium text-emerald-400">/mes</span>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-gray-800/80 mb-6">
                  {srv.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedService(srv)}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
              >
                Comprar Ahora
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL DE COMPRA / MÉTODOS DE PAGO */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121826] border border-gray-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedService(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg w-8 h-8 rounded-full bg-gray-800/80 flex items-center justify-center"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Comprar {selectedService.name}</h3>
                <p className="text-sm text-gray-400">Total a pagar: <strong className="text-emerald-400 text-base">{formatCurrency(selectedService.price)}</strong></p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 bg-indigo-950/40 p-3 rounded-lg border border-indigo-500/20">
              Selecciona tu método de pago preferido, realiza la transferencia y envía el comprobante a nuestro asesor para recibir tus credenciales inmediatamente.
            </p>

            <div className="space-y-3">
              {/* Binance */}
              <div className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-400 font-bold uppercase">Binance Pay (USDT)</div>
                  <div className="text-sm font-mono text-gray-200 font-semibold mt-0.5">Pay ID: 789201942</div>
                  <div className="text-[11px] text-gray-400">Nombre: StreamHub Oficial</div>
                </div>
                <button
                  onClick={() => handleCopy("789201942", "binance")}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedMethod === "binance" ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* Pago Móvil */}
              <div className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-indigo-400 font-bold uppercase">Pago Móvil (Venezuela)</div>
                  <div className="text-sm text-gray-200 font-semibold mt-0.5">0412-1234567 • Banesco (0102)</div>
                  <div className="text-[11px] text-gray-400">C.I: 28.123.456 (Tasa BCV del día)</div>
                </div>
                <button
                  onClick={() => handleCopy("04121234567", "pm")}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedMethod === "pm" ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* Zelle */}
              <div className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-purple-400 font-bold uppercase">Zelle (USD)</div>
                  <div className="text-sm font-mono text-gray-200 font-semibold mt-0.5">pagos@streamhub.com</div>
                  <div className="text-[11px] text-gray-400">Titular: Stream Services LLC</div>
                </div>
                <button
                  onClick={() => handleCopy("pagos@streamhub.com", "zelle")}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedMethod === "zelle" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 flex gap-3">
              <a
                href={`https://wa.me/584120000000?text=Hola,%20deseo%20comprar%20la%20cuenta%20de%20${encodeURIComponent(
                  selectedService.name
                )}%20por%20${selectedService.price}$`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-center flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
              >
                Notificar Pago por WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-gray-800/80 bg-[#070a12] py-8 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 StreamHub Pro. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-gray-300">Acceso Vendedores</Link>
            <Link href="/login" className="hover:text-gray-300">Acceso Dueño</Link>
            <span className="text-gray-700">|</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Servidores Operacionales
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
