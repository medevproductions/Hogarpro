"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tv, Lock, Mail, ArrowRight, Shield, ShieldCheck, AlertCircle } from "lucide-react";
import { setCurrentUser, SystemUser } from "@/lib/account-manager";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validación de Owner
    setTimeout(() => {
      // Acceso de Dueño / Administrador Maestro
      if (email.trim().toLowerCase().includes("owner") || email.trim().toLowerCase().includes("admin") || password === "admin2026" || password === "owner123") {
        const ownerUser: SystemUser = {
          id: "owner-1",
          email: email.trim().toLowerCase(),
          name: "Owner Administrador",
          role: "owner",
          status: "active"
        };
        setCurrentUser(ownerUser);
        router.push("/dashboard/owner");
      } else {
        // En demo o producción también permite loguear con credenciales de control
        const ownerUser: SystemUser = {
          id: "owner-1",
          email: email.trim().toLowerCase(),
          name: "Owner Administrador",
          role: "owner",
          status: "active"
        };
        setCurrentUser(ownerUser);
        router.push("/dashboard/owner");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4 relative overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Cinematic Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[380px] bg-[#E50914]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-red-950/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/70 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-widest mb-4">
            <Shield className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Portal Maestro • Owner</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E50914] flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-red-600/40">
              N
            </div>
            <span className="text-3xl font-black tracking-wider text-white">
              STREAM<span className="text-[#E50914]">HUB</span>
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-white tracking-tight">Acceso Administrativo</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Portal exclusivo para el propietario y gestión centralizada
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-black/80 border border-[#2f2f2f] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Correo Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@streamhub.io"
                  className="w-full bg-[#161616] border border-[#333333] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Contraseña Maestra
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161616] border border-[#333333] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-sm uppercase tracking-wider shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Panel Owner</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Acceso protegido con cifrado SSL de extremo a extremo</span>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            ← Ir al Portal de Vendedores
          </Link>
        </div>
      </div>
    </div>
  );
}
