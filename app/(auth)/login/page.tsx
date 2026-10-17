"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tv, Lock, Mail, ArrowRight, ArrowLeft, Shield, User, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<"owner" | "seller">("owner");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulación rápida de redirección según rol
    setTimeout(() => {
      if (selectedDemoRole === "owner") {
        router.push("/dashboard/owner");
      } else {
        router.push("/dashboard/seller");
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Netflix ambient glow backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#E50914]/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-900/40 group-hover:scale-105 transition-transform duration-300">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tighter text-white">
              HOGAR<span className="text-[#E50914]">PRO</span>
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-1.5 h-5 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
            <h2 className="text-2xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Plataforma centralizada de gestión y entrega de streaming
          </p>
        </div>

        {/* Demo Fast Switcher */}
        <div className="mb-6 p-1.5 rounded-xl bg-[#1a1a1a] border border-[#2f2f2f] flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("owner");
              setEmail("owner@hogarpro.com");
              setPassword("owner123");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "owner"
                ? "bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-[1.02]"
                : "text-gray-400 hover:text-white hover:bg-[#252525]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Rol Administrador
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("seller");
              setEmail("seller@hogarpro.com");
              setPassword("seller123");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "seller"
                ? "bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-[1.02]"
                : "text-gray-400 hover:text-white hover:bg-[#252525]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Rol Vendedor (Revendedor)
          </button>
        </div>

        {/* Formulario */}
        <div className="bg-[#181818]/95 border border-[#2f2f2f] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
                  className="w-full bg-[#101010] border border-[#333333] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Contraseña
                </label>
                <a href="#" className="text-xs text-gray-400 hover:text-[#E50914] transition">
                  ¿Olvidaste tu clave?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#101010] border border-[#333333] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-sm shadow-xl shadow-red-900/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Autenticando..." : "Acceder al Panel"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#2a2a2a] text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#E50914] transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Catálogo Público</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
