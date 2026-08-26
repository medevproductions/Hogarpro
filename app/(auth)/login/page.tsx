"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tv, Lock, Mail, ArrowRight, Shield, User, Sparkles } from "lucide-react";

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
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-indigo-600/20 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              STREAM<span className="text-indigo-400">HUB</span>
            </span>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
          <p className="text-sm text-gray-400 mt-1">
            Ingresa a tu panel de gestión de streaming
          </p>
        </div>

        {/* Demo Fast Switcher (Para pruebas de roles) */}
        <div className="mb-6 p-1.5 rounded-xl bg-gray-900/80 border border-gray-800 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("owner");
              setEmail("owner@streamhub.com");
              setPassword("owner123");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "owner"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Rol Owner (Dueño)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("seller");
              setEmail("seller@streamhub.com");
              setPassword("seller123");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "seller"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Rol Seller (Vendedor)
          </button>
        </div>

        {/* Formulario */}
        <div className="bg-[#121826]/90 border border-gray-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Contraseña
                </label>
                <a href="#" className="text-xs text-indigo-400 hover:underline">
                  ¿Olvidaste tu clave?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? "Autenticando..." : "Entrar al Panel"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-800/80 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-indigo-300">
              ← Volver a la Tienda Pública
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
