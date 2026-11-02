"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ArrowLeft, Shield, ShieldCheck, AlertCircle, Tv } from "lucide-react";
import { getCurrentUser } from "@/lib/account-manager";
import { authenticateWithFirebase } from "@/lib/firebase/auth-service";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user && (user.role === "owner" || (user.role as string) === "admin")) {
      router.push("/dashboard/owner");
    }
  }, [router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authenticateWithFirebase(email, password);
      if (result.success && result.user) {
        if (result.user.role === "owner" || (result.user.role as string) === "admin") {
          router.push("/dashboard/owner");
        } else {
          setError("Esta cuenta no tiene permisos de administrador.");
          setLoading(false);
        }
      } else {
        setError(result.error || "Credenciales inválidas. Acceso denegado.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "Error al autenticar. Por favor verifica tus credenciales.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col justify-between p-4 sm:p-8 relative selection:bg-rose-500/30 selection:text-rose-200">
      {/* Fluent soft ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-b from-slate-800/20 via-transparent to-transparent blur-3xl opacity-70" />
      </div>

      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </Link>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs font-medium">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Seguridad Admin</span>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 items-center justify-center mb-3 shadow-md">
            <Tv className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Acceso Administrativo
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Ingreso centralizado a métricas, finanzas y asignación de cuentas
          </p>
        </div>

        <div className="bg-[#121722]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hogarpro.com"
                  className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0E121B] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Panel de Control</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Acceso protegido con cifrado SSL de extremo a extremo</span>
          </div>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-md mx-auto py-4 text-center">
        <p className="text-xs text-slate-400">
          HogarPro Cloud © 2026. Panel de Gestión Empresarial.
        </p>
      </footer>
    </div>
  );
}
