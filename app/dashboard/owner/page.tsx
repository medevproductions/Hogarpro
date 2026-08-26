"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Tv, 
  Users, 
  Calendar, 
  Plus, 
  Filter, 
  Search,
  MoreVertical,
  Shield,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function OwnerDashboard() {
  const [dateFilter, setDateFilter] = useState("this_month");
  const [searchAccount, setSearchAccount] = useState("");

  // Métricas financieras
  const stats = {
    totalRevenue: 2840.50,
    totalExpenses: 890.00,
    netProfit: 1950.50,
    marginPercentage: "+68.6%",
    activeAccounts: 84,
    activeSellers: 6,
    expiringSoon: 12
  };

  // Cuentas Maestras
  const [accounts, setAccounts] = useState([
    {
      id: "acc-1",
      platform: "Netflix Premium 4K",
      platformColor: "text-red-500 bg-red-950/40 border-red-500/30",
      email: "master.netflix01@streamhub.io",
      seller: "Carlos Vendedor (Caracas)",
      profilesOccupied: 4,
      maxProfiles: 5,
      purchaseDate: "2026-08-01",
      expirationDate: "2026-08-31",
      status: "assigned",
      monthlyCost: 2.00,
      monthlyIncome: 14.00
    },
    {
      id: "acc-2",
      platform: "Disney+ Standard",
      platformColor: "text-blue-400 bg-blue-950/40 border-blue-500/30",
      email: "disney.family.latam@gmail.com",
      seller: "Maria Ventas (Bogotá)",
      profilesOccupied: 4,
      maxProfiles: 4,
      purchaseDate: "2026-08-10",
      expirationDate: "2026-09-10",
      status: "assigned",
      monthlyCost: 1.50,
      monthlyIncome: 10.00
    },
    {
      id: "acc-3",
      platform: "Max (HBO Max)",
      platformColor: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
      email: "max.ultra.hd2026@streamhub.io",
      seller: "Sin Asignar (En Stock)",
      profilesOccupied: 0,
      maxProfiles: 5,
      purchaseDate: "2026-08-20",
      expirationDate: "2026-09-20",
      status: "available",
      monthlyCost: 1.20,
      monthlyIncome: 0.00
    },
    {
      id: "acc-4",
      platform: "Spotify Familiar",
      platformColor: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
      email: "spotify.master.sub@streamhub.io",
      seller: "Andrés Gomez",
      profilesOccupied: 6,
      maxProfiles: 6,
      purchaseDate: "2026-07-28",
      expirationDate: "2026-08-28",
      status: "expiring",
      monthlyCost: 0.90,
      monthlyIncome: 12.00
    }
  ]);

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d121f] p-5 hidden md:flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-white tracking-tight">STREAMHUB</div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">PANEL OWNER</div>
            </div>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            <Link href="/dashboard/owner" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white shadow-md">
              <DollarSign className="w-4 h-4" />
              Finanzas & Resumen
            </Link>
            <a href="#cuentas" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Tv className="w-4 h-4" />
              Cuentas Maestras
            </a>
            <a href="#vendedores" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Users className="w-4 h-4" />
              Vendedores (Sellers)
            </a>
            <a href="#calendario" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Calendar className="w-4 h-4" />
              Vencimientos
            </a>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <Link href="/dashboard/seller" className="block text-xs text-indigo-400 hover:underline mb-2">
            ⇄ Cambiar a Vista Vendedor
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Panel del Dueño (Owner)</h1>
            <p className="text-sm text-gray-400 mt-1">Control financiero global, inventario y rendimiento de ventas</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#121826] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="this_month">Este Mes (Agosto 2026)</option>
              <option value="last_month">Mes Anterior</option>
              <option value="this_year">Año Completo</option>
            </select>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30">
              <Plus className="w-4 h-4" />
              Nueva Cuenta Maestra
            </button>
          </div>
        </div>

        {/* FINANCIAL KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Ingresos */}
          <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ingresos Totales</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>+18.4% vs mes anterior</span>
            </div>
          </div>

          {/* Gastos */}
          <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costos de Cuentas</span>
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">{formatCurrency(stats.totalExpenses)}</div>
            <div className="text-[11px] text-gray-400 mt-1 font-medium">
              84 cuentas activas operando
            </div>
          </div>

          {/* Ganancia Neta */}
          <div className="bg-gradient-to-b from-[#18233c] to-[#121826] border border-indigo-500/40 rounded-2xl p-5 shadow-lg shadow-indigo-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Ganancia Neta</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{formatCurrency(stats.netProfit)}</div>
            <div className="text-[11px] text-indigo-300 mt-1 font-semibold">
              Margen de Utilidad: {stats.marginPercentage}
            </div>
          </div>

          {/* Vencimientos Próximos */}
          <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vencen en 7 días</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-2">{stats.expiringSoon} cuentas</div>
            <div className="text-[11px] text-gray-400 mt-1">
              Requieren renovación inmediata
            </div>
          </div>
        </div>

        {/* TABLA DE GESTIÓN DE CUENTAS */}
        <section id="cuentas" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-indigo-400" />
                Gestión de Cuentas Maestras
              </h2>
              <p className="text-xs text-gray-400">Control de correos, contraseñas, cupos y vendedor asignado</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por correo o servicio..."
                value={searchAccount}
                onChange={(e) => setSearchAccount(e.target.value)}
                className="w-full bg-[#0d121f] border border-gray-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0b0f19] text-gray-400 uppercase font-semibold border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Plataforma</th>
                  <th className="py-3 px-4">Correo de Cuenta</th>
                  <th className="py-3 px-4">Vendedor Asignado</th>
                  <th className="py-3 px-4 text-center">Perfiles / Pantallas</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-800/30 transition">
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${acc.platformColor}`}>
                        {acc.platform}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-white">{acc.email}</td>
                    <td className="py-3.5 px-4 text-gray-300">{acc.seller}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-white">{acc.profilesOccupied}</span>
                      <span className="text-gray-500"> / {acc.maxProfiles}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span>{formatDate(acc.expirationDate)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {acc.status === "assigned" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                          En Venta
                        </span>
                      )}
                      {acc.status === "available" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/60 text-blue-400 border border-blue-500/20">
                          En Stock
                        </span>
                      )}
                      {acc.status === "expiring" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/20 animate-pulse">
                          Por Vencer
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 border border-indigo-500/30 rounded-lg mr-2">
                        Editar
                      </button>
                      <button className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-800/40 rounded-lg">
                        Asignar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
