"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Tv, 
  Users, 
  Calendar, 
  Plus, 
  Search, 
  Shield, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Edit, 
  UserCheck, 
  Check, 
  X, 
  Eye, 
  EyeOff,
  Sparkles,
  ArrowUpDown
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface StreamingAccount {
  id: string;
  platform: string;
  platformColor: string;
  email: string;
  password?: string;
  seller: string;
  sellerId?: string;
  profilesOccupied: number;
  maxProfiles: number;
  purchaseDate: string;
  expirationDate: string;
  status: "assigned" | "available" | "expiring";
  monthlyCost: number;
  monthlyIncome: number;
  notes?: string;
}

export interface Seller {
  id: string;
  name: string;
  phone: string;
  activeAccountsCount: number;
  status: "active" | "suspended";
}

const AVAILABLE_PLATFORMS = [
  { name: "Netflix Premium 4K", color: "text-red-500 bg-red-950/40 border-red-500/30", defaultProfiles: 5, defaultCost: 2.00, defaultIncome: 15.00 },
  { name: "Disney+ Standard", color: "text-blue-400 bg-blue-950/40 border-blue-500/30", defaultProfiles: 4, defaultCost: 1.50, defaultIncome: 10.00 },
  { name: "Max (HBO Max)", color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30", defaultProfiles: 5, defaultCost: 1.20, defaultIncome: 12.50 },
  { name: "Prime Video", color: "text-sky-400 bg-sky-950/40 border-sky-500/30", defaultProfiles: 3, defaultCost: 1.00, defaultIncome: 6.00 },
  { name: "Spotify Familiar", color: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30", defaultProfiles: 6, defaultCost: 0.90, defaultIncome: 12.00 },
  { name: "Crunchyroll Mega Fan", color: "text-amber-500 bg-amber-950/40 border-amber-500/30", defaultProfiles: 4, defaultCost: 1.10, defaultIncome: 8.00 }
];

export default function OwnerDashboard() {
  const [dateFilter, setDateFilter] = useState("this_month");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Lista de Vendedores
  const [sellers, setSellers] = useState<Seller[]>([
    { id: "s-1", name: "Carlos Vendedor (Caracas)", phone: "+58 412 1112233", activeAccountsCount: 14, status: "active" },
    { id: "s-2", name: "Maria Ventas (Bogotá)", phone: "+57 300 4445566", activeAccountsCount: 22, status: "active" },
    { id: "s-3", name: "Andrés Gomez (Medellín)", phone: "+57 311 9998877", activeAccountsCount: 18, status: "active" },
    { id: "s-4", name: "Juan Martinez (Santiago)", phone: "+56 9 8887766", activeAccountsCount: 8, status: "active" }
  ]);

  // Cuentas Maestras en Estado Local Interactivo
  const [accounts, setAccounts] = useState<StreamingAccount[]>([
    {
      id: "acc-1",
      platform: "Netflix Premium 4K",
      platformColor: "text-red-500 bg-red-950/40 border-red-500/30",
      email: "master.netflix01@streamhub.io",
      password: "SuperSecretPass2026*",
      seller: "Carlos Vendedor (Caracas)",
      sellerId: "s-1",
      profilesOccupied: 4,
      maxProfiles: 5,
      purchaseDate: "2026-08-01",
      expirationDate: "2026-08-31",
      status: "assigned",
      monthlyCost: 2.00,
      monthlyIncome: 14.00,
      notes: "Cuenta colombiana con método de pago activo"
    },
    {
      id: "acc-2",
      platform: "Disney+ Standard",
      platformColor: "text-blue-400 bg-blue-950/40 border-blue-500/30",
      email: "disney.family.latam@gmail.com",
      password: "DisneyPass2026#",
      seller: "Maria Ventas (Bogotá)",
      sellerId: "s-2",
      profilesOccupied: 4,
      maxProfiles: 4,
      purchaseDate: "2026-08-10",
      expirationDate: "2026-09-10",
      status: "assigned",
      monthlyCost: 1.50,
      monthlyIncome: 10.00,
      notes: "Combo Disney + Star"
    },
    {
      id: "acc-3",
      platform: "Max (HBO Max)",
      platformColor: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
      email: "max.ultra.hd2026@streamhub.io",
      password: "MaxPassword778!",
      seller: "Sin Asignar (En Stock)",
      sellerId: undefined,
      profilesOccupied: 0,
      maxProfiles: 5,
      purchaseDate: "2026-08-20",
      expirationDate: "2026-09-20",
      status: "available",
      monthlyCost: 1.20,
      monthlyIncome: 0.00,
      notes: "Listo para asignar a nuevo vendedor"
    },
    {
      id: "acc-4",
      platform: "Spotify Familiar",
      platformColor: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
      email: "spotify.master.sub@streamhub.io",
      password: "SpotMusic2026#",
      seller: "Andrés Gomez (Medellín)",
      sellerId: "s-3",
      profilesOccupied: 6,
      maxProfiles: 6,
      purchaseDate: "2026-07-28",
      expirationDate: "2026-08-28",
      status: "expiring",
      monthlyCost: 0.90,
      monthlyIncome: 12.00,
      notes: "Plan familiar con 6 miembros"
    }
  ]);

  // Estados para Modales
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningAccount, setAssigningAccount] = useState<StreamingAccount | null>(null);
  const [selectedSellerToAssign, setSelectedSellerToAssign] = useState<string>("");
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Estado del Formulario de Cuenta
  const [formData, setFormData] = useState({
    platform: AVAILABLE_PLATFORMS[0].name,
    email: "",
    password: "",
    maxProfiles: 5,
    profilesOccupied: 0,
    seller: "Sin Asignar (En Stock)",
    purchaseDate: new Date().toISOString().split("T")[0],
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    monthlyCost: 2.00,
    monthlyIncome: 14.00,
    notes: ""
  });

  // FILTRADO DINÁMICO DE CUENTAS (Búsqueda + Plataforma + Estado)
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.seller.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPlatform = platformFilter === "all" || acc.platform === platformFilter;
      const matchStatus = statusFilter === "all" || acc.status === statusFilter;

      return matchSearch && matchPlatform && matchStatus;
    });
  }, [accounts, searchQuery, platformFilter, statusFilter]);

  // CÁLCULO DE KPIs EN TIEMPO REAL
  const stats = useMemo(() => {
    const totalIncome = accounts.reduce((sum, a) => sum + Number(a.monthlyIncome || 0), 0);
    const totalExpenses = accounts.reduce((sum, a) => sum + Number(a.monthlyCost || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0";
    const expiringCount = accounts.filter((a) => {
      const diffDays = Math.ceil((new Date(a.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24));
      return diffDays <= 7;
    }).length;

    return {
      totalRevenue: totalIncome,
      totalExpenses: totalExpenses,
      netProfit: netProfit,
      marginPercentage: `+${margin}%`,
      activeAccounts: accounts.length,
      expiringSoon: expiringCount
    };
  }, [accounts]);

  // ABRIR MODAL CREAR
  const handleOpenCreateModal = () => {
    setEditingAccountId(null);
    setFormData({
      platform: AVAILABLE_PLATFORMS[0].name,
      email: "",
      password: "",
      maxProfiles: AVAILABLE_PLATFORMS[0].defaultProfiles,
      profilesOccupied: 0,
      seller: "Sin Asignar (En Stock)",
      purchaseDate: new Date().toISOString().split("T")[0],
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      monthlyCost: AVAILABLE_PLATFORMS[0].defaultCost,
      monthlyIncome: AVAILABLE_PLATFORMS[0].defaultIncome,
      notes: ""
    });
    setIsAccountModalOpen(true);
  };

  // ABRIR MODAL EDITAR
  const handleOpenEditModal = (acc: StreamingAccount) => {
    setEditingAccountId(acc.id);
    setFormData({
      platform: acc.platform,
      email: acc.email,
      password: acc.password || "",
      maxProfiles: acc.maxProfiles,
      profilesOccupied: acc.profilesOccupied,
      seller: acc.seller,
      purchaseDate: acc.purchaseDate,
      expirationDate: acc.expirationDate,
      monthlyCost: acc.monthlyCost,
      monthlyIncome: acc.monthlyIncome,
      notes: acc.notes || ""
    });
    setIsAccountModalOpen(true);
  };

  // GUARDAR CUENTA (CREAR O EDITAR)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const platObj = AVAILABLE_PLATFORMS.find((p) => p.name === formData.platform) || AVAILABLE_PLATFORMS[0];
    const isAssigned = formData.seller !== "Sin Asignar (En Stock)";

    if (editingAccountId) {
      // Editar existente
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editingAccountId
            ? {
                ...acc,
                ...formData,
                platformColor: platObj.color,
                status: isAssigned ? (acc.status === "expiring" ? "expiring" : "assigned") : "available"
              }
            : acc
        )
      );
    } else {
      // Crear nueva
      const newAcc: StreamingAccount = {
        id: `acc-${Date.now()}`,
        ...formData,
        platformColor: platObj.color,
        status: isAssigned ? "assigned" : "available"
      };
      setAccounts((prev) => [newAcc, ...prev]);
    }
    setIsAccountModalOpen(false);
  };

  // ELIMINAR CUENTA
  const handleDeleteAccount = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta cuenta maestra?")) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    }
  };

  // ABRIR MODAL ASIGNAR
  const handleOpenAssignModal = (acc: StreamingAccount) => {
    setAssigningAccount(acc);
    setSelectedSellerToAssign(acc.sellerId || (sellers[0]?.id ?? ""));
    setIsAssignModalOpen(true);
  };

  // GUARDAR ASIGNACIÓN DE VENDEDOR
  const handleSaveAssignment = () => {
    if (!assigningAccount) return;
    const selectedSeller = sellers.find((s) => s.id === selectedSellerToAssign);

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === assigningAccount.id
          ? {
              ...acc,
              seller: selectedSeller ? selectedSeller.name : "Sin Asignar (En Stock)",
              sellerId: selectedSeller ? selectedSeller.id : undefined,
              status: selectedSeller ? "assigned" : "available"
            }
          : acc
      )
    );
    setIsAssignModalOpen(false);
    setAssigningAccount(null);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
              Finanzas & Cuentas
            </Link>
            <a href="#cuentas" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Tv className="w-4 h-4" />
              Gestión de Stock ({accounts.length})
            </a>
            <a href="#vendedores" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition">
              <Users className="w-4 h-4" />
              Vendedores ({sellers.length})
            </a>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <Link href="/dashboard/seller" className="block text-xs text-indigo-400 hover:underline mb-2">
            ⇄ Cambiar a Vista Vendedor
          </Link>
          <Link href="/" className="block text-xs text-gray-500 hover:text-gray-300">
            ← Ver Tienda Pública
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
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
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
            <div className="text-[11px] text-emerald-400 mt-1 font-medium">
              Calculado en base a ocupación
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
              {accounts.length} cuentas activas en total
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
        <section id="cuentas" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-indigo-400" />
                Gestión de Cuentas Maestras ({filteredAccounts.length} de {accounts.length})
              </h2>
              <p className="text-xs text-gray-400">Control de correos, contraseñas, cupos y vendedor asignado</p>
            </div>

            {/* Barra de Búsqueda y Filtros Activos */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por correo, vendedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d121f] border border-gray-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Filtro por Plataforma */}
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="bg-[#0d121f] border border-gray-700/80 text-xs text-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas las Plataformas</option>
                {AVAILABLE_PLATFORMS.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>

              {/* Filtro por Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0d121f] border border-gray-700/80 text-xs text-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todos los Estados</option>
                <option value="assigned">En Venta (Asignadas)</option>
                <option value="available">En Stock (Libres)</option>
                <option value="expiring">Por Vencer</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0b0f19] text-gray-400 uppercase font-semibold border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Plataforma</th>
                  <th className="py-3 px-4">Correo & Contraseña</th>
                  <th className="py-3 px-4">Vendedor Asignado</th>
                  <th className="py-3 px-4 text-center">Perfiles / Cupos</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron cuentas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-800/30 transition">
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${acc.platformColor}`}>
                          {acc.platform}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-medium text-white">{acc.email}</div>
                        {acc.password && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono mt-0.5">
                            <span>{showPassword[acc.id] ? acc.password : "••••••••••••"}</span>
                            <button
                              onClick={() => togglePasswordVisibility(acc.id)}
                              className="text-gray-500 hover:text-gray-300"
                              title="Mostrar/Ocultar Contraseña"
                            >
                              {showPassword[acc.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={acc.sellerId ? "text-gray-200 font-medium" : "text-amber-400/90 font-medium"}>
                          {acc.seller}
                        </span>
                      </td>
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
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenAssignModal(acc)}
                          className="px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 border border-indigo-500/30 rounded-lg transition"
                          title="Asignar Vendedor"
                        >
                          Asignar
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(acc)}
                          className="px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                          title="Editar Cuenta"
                        >
                          <Edit className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg transition"
                          title="Eliminar Cuenta"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MODAL CREAR / EDITAR CUENTA MAESTRA */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <h3 className="text-xl font-bold text-white mb-1">
                {editingAccountId ? "Editar Cuenta Maestra" : "Nueva Cuenta Maestra"}
              </h3>
              <p className="text-xs text-gray-400 mb-6">
                Ingresa las credenciales y la configuración de perfiles para tu catálogo
              </p>

              <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Plataforma</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => {
                      const plat = AVAILABLE_PLATFORMS.find((p) => p.name === e.target.value);
                      setFormData({
                        ...formData,
                        platform: e.target.value,
                        maxProfiles: plat ? plat.defaultProfiles : 5,
                        monthlyCost: plat ? plat.defaultCost : 2.00,
                        monthlyIncome: plat ? plat.defaultIncome : 14.00
                      });
                    }}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {AVAILABLE_PLATFORMS.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Correo de la Cuenta</label>
                    <input
                      type="email"
                      required
                      placeholder="cuenta@correo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Contraseña</label>
                    <input
                      type="text"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Cupo Máximo Perfiles</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.maxProfiles}
                      onChange={(e) => setFormData({ ...formData, maxProfiles: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Perfiles Vendidos</label>
                    <input
                      type="number"
                      min={0}
                      max={formData.maxProfiles}
                      value={formData.profilesOccupied}
                      onChange={(e) => setFormData({ ...formData, profilesOccupied: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Fecha de Compra</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Costo Mensual ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.monthlyCost}
                      onChange={(e) => setFormData({ ...formData, monthlyCost: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Ingreso Esperado ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                  >
                    {editingAccountId ? "Guardar Cambios" : "Crear Cuenta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ASIGNAR VENDEDOR */}
        {isAssignModalOpen && assigningAccount && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Asignar Cuenta a Vendedor</h3>
                  <p className="text-xs text-gray-400">{assigningAccount.platform} • {assigningAccount.email}</p>
                </div>
              </div>

              <div className="space-y-3 my-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Selecciona el Vendedor Responsable
                </label>
                <div className="space-y-2">
                  <div
                    onClick={() => setSelectedSellerToAssign("")}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedSellerToAssign === ""
                        ? "bg-indigo-950/50 border-indigo-500 text-white"
                        : "bg-[#0d121f] border-gray-800 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-amber-400">Sin Asignar (Dejar en Stock Libre)</div>
                      <div className="text-[11px] text-gray-500">Disponible para la tienda general</div>
                    </div>
                    {selectedSellerToAssign === "" && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>

                  {sellers.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSellerToAssign(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        selectedSellerToAssign === s.id
                          ? "bg-indigo-950/50 border-indigo-500 text-white"
                          : "bg-[#0d121f] border-gray-800 text-gray-400 hover:border-gray-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-white">{s.name}</div>
                        <div className="text-[11px] text-gray-500">{s.phone} • {s.activeAccountsCount} cuentas asignadas</div>
                      </div>
                      {selectedSellerToAssign === s.id && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Confirmar Asignación
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
