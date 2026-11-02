"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tv, Lock, Mail, ArrowRight, ArrowLeft, Shield, User, AlertCircle } from "lucide-react";
import { authenticateWithFirebase } from "@/lib/firebase/auth-service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemoRole, setSelectedDemoRole] = useState<"owner" | "seller">("owner");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const targetEmail = email.trim() || (selectedDemoRole === "owner" ? "admin@hogarpro.com" : "carlos@ventas.com");
      const targetPass = password.trim() || (selectedDemoRole === "owner" ? "admin2026" : "Ventas2026*");

      const result = await authenticateWithFirebase(targetEmail, targetPass);
      if (result.success && result.user) {
        if (result.user.role === "owner" || (result.user.role as string) === "admin") {
          router.push("/dashboard/owner");
        } else {
          router.push("/dashboard/seller");
        }
      } else {
        setError(result.error || "Credenciales incorrectas.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "Error al autenticar. Por favor verifica tus datos.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative selection:bg-rose-500/30 selection:text-rose-200">
      {/* Ambient eye-friendly backdrop */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent blur-3xl opacity-60" />
      </div>

      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </Link>
        <span className="text-xs text-slate-500 font-medium">Plataforma HogarPro</span>
      </header>

      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center shadow-sm">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-100">
              HOGAR<span className="text-rose-500">PRO</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Iniciar Sesión</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma unificada de gestión de cuentas y terminal en vivo
          </p>
        </div>

        {/* Fluent Segmented Role Switcher */}
        <div className="mb-5 p-1 bg-[#0E121B] border border-slate-800 rounded-xl grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("owner");
              setEmail("admin@hogarpro.com");
              setPassword("admin2026");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "owner"
                ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Administrador</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDemoRole("seller");
              setEmail("carlos@ventas.com");
              setPassword("Ventas2026*");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedDemoRole === "seller"
                ? "bg-[#1C2433] text-slate-100 shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Revendedor</span>
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-[#121722]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
                  className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Acceder al Panel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-md mx-auto py-4 text-center">
        <p className="text-xs text-slate-400">
          HogarPro Cloud © 2026.
        </p>
      </footer>
    </div>
  );
}
