"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
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
  ArrowUpDown,
  FileSpreadsheet,
  Upload,
  Download,
  KeyRound,
  UserPlus,
  RefreshCw,
  Zap,
  Home,
  ShieldCheck,
  Lock,
  ExternalLink,
  Copy
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getSystemUsers, 
  saveSystemUsers, 
  saveSystemUser,
  deleteSystemUser,
  SystemUser, 
  StoredStreamingAccount 
} from "@/lib/account-manager";

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
  email?: string;
  password?: string;
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

  // Lista de Vendedores sincronizada con account-manager
  const [sellers, setSellers] = useState<Seller[]>([]);

  // Cuentas Maestras sincronizadas con account-manager
  const [accounts, setAccounts] = useState<StreamingAccount[]>([]);

  // Estados para Modales
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningAccount, setAssigningAccount] = useState<StreamingAccount | null>(null);
  const [selectedSellerToAssign, setSelectedSellerToAssign] = useState<string>("");
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Modal de Importación Excel
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Modal para Crear / Editar Vendedor
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerEmail, setNewSellerEmail] = useState("");
  const [newSellerPassword, setNewSellerPassword] = useState("");
  const [newSellerPhone, setNewSellerPhone] = useState("");

  // Probador de Códigos en Vivo para Owner
  const [testEmail, setTestEmail] = useState("");
  const [testService, setTestService] = useState("netflix");
  const [testAction, setTestAction] = useState("temporal");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [copiedTestCode, setCopiedTestCode] = useState(false);

  // Función para refrescar vendedores y cuentas
  const reloadData = () => {
    const rawUsers = getSystemUsers();
    const rawAccounts = getStoredAccounts();

    const formattedSellers: Seller[] = rawUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: u.password,
      phone: u.phone || "Sin teléfono",
      activeAccountsCount: rawAccounts.filter(a => a.sellerId === u.id || a.sellerId === u.email).length,
      status: u.status || "active"
    }));
    setSellers(formattedSellers);

    const formattedAccounts: StreamingAccount[] = rawAccounts.map(a => {
      const platObj = AVAILABLE_PLATFORMS.find(p => p.name.toLowerCase().includes(a.platform.toLowerCase())) || AVAILABLE_PLATFORMS[0];
      return {
        id: a.id,
        platform: a.platform || platObj.name,
        platformColor: platObj.color,
        email: a.email,
        password: a.password || "Password2026*",
        seller: a.sellerName || (a.sellerId ? (rawUsers.find(u => u.id === a.sellerId)?.name || a.sellerId) : "Sin Asignar (En Stock)"),
        sellerId: a.sellerId,
        profilesOccupied: a.occupiedProfiles || 0,
        maxProfiles: a.maxProfiles || platObj.defaultProfiles,
        purchaseDate: "2026-08-01",
        expirationDate: a.expirationDate || "2026-09-30",
        status: (a.status as any) || (a.sellerId ? "assigned" : "available"),
        monthlyCost: a.monthlyCost || platObj.defaultCost,
        monthlyIncome: a.monthlyIncome || platObj.defaultIncome,
        notes: a.notes || ""
      };
    });
    setAccounts(formattedAccounts);
  };

  // Cargar datos iniciales y escuchar cambios
  useEffect(() => {
    reloadData();

    // Escuchar cambios entre pestañas o eventos locales
    const handleStorageChange = () => reloadData();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("streamhub_users_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("streamhub_users_updated", handleStorageChange);
    };
  }, []);

  // Guardar en Storage cuando accounts cambia
  const persistAccounts = (newAccounts: StreamingAccount[]) => {
    setAccounts(newAccounts);
    const converted: StoredStreamingAccount[] = newAccounts.map(a => ({
      id: a.id,
      platform: a.platform,
      email: a.email,
      password: a.password,
      sellerId: a.sellerId,
      sellerName: a.seller,
      maxProfiles: a.maxProfiles,
      occupiedProfiles: a.profilesOccupied,
      expirationDate: a.expirationDate,
      status: a.status === "assigned" ? "assigned" : a.status === "available" ? "available" : "expired",
      monthlyCost: a.monthlyCost,
      monthlyIncome: a.monthlyIncome,
      notes: a.notes
    }));
    saveStoredAccounts(converted);
  };

  // Guardar en Storage cuando sellers cambia
  const persistSellers = (newSellers: Seller[]) => {
    setSellers(newSellers);
    const converted: SystemUser[] = newSellers.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email || `${s.name.toLowerCase().replace(/\s+/g, "")}@ventas.com`,
      phone: s.phone,
      role: "seller",
      status: s.status,
      activeAccountsCount: s.activeAccountsCount
    }));
    saveSystemUsers(converted);
  };

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
    const matchedSeller = sellers.find(s => s.name === formData.seller);

    if (editingAccountId) {
      // Editar existente
      const updated = accounts.map((acc) =>
        acc.id === editingAccountId
          ? {
              ...acc,
              ...formData,
              sellerId: matchedSeller ? matchedSeller.id : acc.sellerId,
              platformColor: platObj.color,
              status: (isAssigned ? (acc.status === "expiring" ? "expiring" : "assigned") : "available") as any
            }
          : acc
      );
      persistAccounts(updated);
    } else {
      // Crear nueva
      const newAcc: StreamingAccount = {
        id: `acc-${Date.now()}`,
        ...formData,
        sellerId: matchedSeller ? matchedSeller.id : undefined,
        platformColor: platObj.color,
        status: (isAssigned ? "assigned" : "available") as any
      };
      persistAccounts([newAcc, ...accounts]);
    }
    setIsAccountModalOpen(false);
  };

  // ELIMINAR CUENTA
  const handleDeleteAccount = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta cuenta maestra?")) {
      persistAccounts(accounts.filter((a) => a.id !== id));
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

    const updated = accounts.map((acc) =>
      acc.id === assigningAccount.id
        ? {
            ...acc,
            seller: selectedSeller ? selectedSeller.name : "Sin Asignar (En Stock)",
            sellerId: selectedSeller ? selectedSeller.id : undefined,
            status: (selectedSeller ? "assigned" : "available") as any
          }
        : acc
    );
    persistAccounts(updated);
    setIsAssignModalOpen(false);
    setAssigningAccount(null);
  };

  // MANEJO DE ARCHIVO EXCEL (.xlsx / .csv)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setExcelPreviewData(data);
      } catch (err) {
        alert("Error al leer el archivo Excel/CSV. Asegúrate de que sea un formato válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // IMPORTAR FILAS PARSEADAS DE EXCEL
  const handleProcessExcelImport = () => {
    if (excelPreviewData.length === 0) return;
    setIsImporting(true);

    try {
      const importedAccounts: StreamingAccount[] = [];

      excelPreviewData.forEach((row: any, idx) => {
        // Encontrar plataforma mapeada
        const rawPlatform = row["Plataforma"] || row["Servicio"] || row["Platform"] || "Netflix Premium 4K";
        const platObj = AVAILABLE_PLATFORMS.find(p => p.name.toLowerCase().includes(String(rawPlatform).toLowerCase())) || AVAILABLE_PLATFORMS[0];
        
        const email = String(row["Correo"] || row["Email"] || row["Usuario"] || "").trim();
        if (!email) return;

        const password = String(row["Contraseña"] || row["Password"] || row["Clave"] || "Password2026*").trim();
        const maxProfiles = Number(row["Perfiles"] || row["Cupos"] || platObj.defaultProfiles) || platObj.defaultProfiles;
        const occupied = Number(row["Ocupados"] || 0);

        // Vendedor asignado en el excel (por nombre o email)
        const sellerCol = String(row["Vendedor"] || row["Seller"] || "").trim();
        const matchedSeller = sellers.find(s => 
          s.name.toLowerCase().includes(sellerCol.toLowerCase()) || 
          (s.email && s.email.toLowerCase() === sellerCol.toLowerCase())
        );

        const expDate = row["Vencimiento"] || row["Fecha Vencimiento"] || row["Expiration"] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        importedAccounts.push({
          id: `acc-imp-${Date.now()}-${idx}`,
          platform: platObj.name,
          platformColor: platObj.color,
          email,
          password,
          seller: matchedSeller ? matchedSeller.name : (sellerCol || "Sin Asignar (En Stock)"),
          sellerId: matchedSeller ? matchedSeller.id : undefined,
          profilesOccupied: occupied,
          maxProfiles,
          purchaseDate: new Date().toISOString().split("T")[0],
          expirationDate: String(expDate).substring(0, 10),
          status: matchedSeller ? "assigned" : "available",
          monthlyCost: platObj.defaultCost,
          monthlyIncome: platObj.defaultIncome,
          notes: "Importado vía Excel/CSV"
        });
      });

      if (importedAccounts.length > 0) {
        persistAccounts([...importedAccounts, ...accounts]);
        setImportSuccessMessage(`¡Se importaron exitosamente ${importedAccounts.length} cuentas de streaming!`);
        setTimeout(() => {
          setIsExcelModalOpen(false);
          setExcelFile(null);
          setExcelPreviewData([]);
          setImportSuccessMessage(null);
        }, 1800);
      } else {
        alert("No se detectaron cuentas con correo válido en el archivo.");
      }
    } catch (err: any) {
      alert("Error procesando importación: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // DESCARGAR PLANTILLA EXCEL DE EJEMPLO
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Plataforma": "Netflix Premium 4K",
        "Correo": "ejemplo.netflix1@correo.com",
        "Contraseña": "ClaveSegura2026*",
        "Perfiles": 5,
        "Ocupados": 0,
        "Vencimiento": "2026-10-15",
        "Vendedor": "Carlos Vendedor"
      },
      {
        "Plataforma": "Disney+ Standard",
        "Correo": "ejemplo.disney2@correo.com",
        "Contraseña": "DisneyPass2026#",
        "Perfiles": 4,
        "Ocupados": 1,
        "Vencimiento": "2026-10-20",
        "Vendedor": "Maria Ventas"
      },
      {
        "Plataforma": "Max (HBO Max)",
        "Correo": "ejemplo.max3@correo.com",
        "Contraseña": "MaxPassword778!",
        "Perfiles": 5,
        "Ocupados": 0,
        "Vencimiento": "2026-11-01",
        "Vendedor": ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuentas_Plantilla");
    XLSX.writeFile(wb, "Plantilla_Cuentas_Streaming_StreamHub.xlsx");
  };

  // ABRIR MODAL CREAR VENDEDOR
  const handleOpenCreateSeller = () => {
    setEditingSellerId(null);
    setNewSellerName("");
    setNewSellerEmail("");
    setNewSellerPassword("");
    setNewSellerPhone("");
    setIsSellerModalOpen(true);
  };

  // ABRIR MODAL EDITAR VENDEDOR
  const handleOpenEditSeller = (s: Seller) => {
    setEditingSellerId(s.id);
    setNewSellerName(s.name);
    setNewSellerEmail(s.email || "");
    setNewSellerPassword(s.password || "");
    setNewSellerPhone(s.phone === "Sin teléfono" ? "" : s.phone);
    setIsSellerModalOpen(true);
  };

  // GUARDAR (CREAR O EDITAR) VENDEDOR
  const handleSaveSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim() || !newSellerEmail.trim()) return;

    if (editingSellerId) {
      // Editar vendedor existente
      const updatedUser: SystemUser = {
        id: editingSellerId,
        name: newSellerName.trim(),
        email: newSellerEmail.trim().toLowerCase(),
        password: newSellerPassword.trim() || "Ventas2026*",
        phone: newSellerPhone.trim() || "Sin teléfono",
        role: "seller",
        status: "active"
      };
      saveSystemUser(updatedUser);
    } else {
      // Crear nuevo vendedor
      const newSellerUser: SystemUser = {
        id: `s-${Date.now().toString().slice(-4)}`,
        name: newSellerName.trim(),
        email: newSellerEmail.trim().toLowerCase(),
        password: newSellerPassword.trim() || "Ventas2026*",
        phone: newSellerPhone.trim() || "Sin teléfono",
        role: "seller",
        activeAccountsCount: 0,
        status: "active"
      };
      saveSystemUser(newSellerUser);
    }

    reloadData();
    setEditingSellerId(null);
    setNewSellerName("");
    setNewSellerEmail("");
    setNewSellerPassword("");
    setNewSellerPhone("");
    setIsSellerModalOpen(false);
  };

  // ELIMINAR VENDEDOR
  const handleDeleteSeller = (sellerId: string, sellerName: string) => {
    if (!confirm(`¿Estás seguro de eliminar al vendedor "${sellerName}"? Sus cuentas asignadas volverán a quedar sin asignar.`)) {
      return;
    }

    // 1. Eliminar de usuarios
    deleteSystemUser(sellerId);

    // 2. Desasignar cuentas vinculadas a este vendedor
    const updatedAccounts = accounts.map((acc) => {
      if (acc.sellerId === sellerId || acc.seller === sellerName) {
        return {
          ...acc,
          seller: "Sin Asignar (En Stock)",
          sellerId: undefined,
          status: "available" as const
        };
      }
      return acc;
    });
    persistAccounts(updatedAccounts);

    reloadData();
  };

  // PROBAR CÓDIGO DIRECTO DESDE PANEL OWNER (BYPASS TOTAL)
  const handleExecuteCodeTest = async () => {
    if (!testEmail.trim()) return;
    setIsTestingCode(true);
    setTestResult(null);
    setCopiedTestCode(false);

    const GAS_URL = "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";

    try {
      const res = await fetch(`${GAS_URL}?email=${encodeURIComponent(testEmail.trim())}&service=${encodeURIComponent(testService)}&actionType=${encodeURIComponent(testAction)}&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success && data.code) {
        setTestResult(data.code);
      } else {
        setTestResult(data?.message || "No se encontró código reciente para este correo.");
      }
    } catch (err: any) {
      setTestResult("Error consultando el servicio: " + err.message);
    } finally {
      setIsTestingCode(false);
    }
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

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#121826] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="this_month">Este Mes (Agosto 2026)</option>
              <option value="last_month">Mes Anterior</option>
              <option value="this_year">Año Completo</option>
            </select>

            {/* BOTÓN IMPORTAR EXCEL */}
            <button
              onClick={() => {
                setExcelPreviewData([]);
                setExcelFile(null);
                setImportSuccessMessage(null);
                setIsExcelModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
              title="Importar cuentas masivamente desde archivo Excel o CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Importar Excel / CSV</span>
            </button>

            {/* BOTÓN NUEVO VENDEDOR */}
            <button
              onClick={() => setIsSellerModalOpen(true)}
              className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
              title="Crear un nuevo vendedor en el sistema"
            >
              <UserPlus className="w-4 h-4 text-purple-400" />
              <span>Nuevo Vendedor</span>
            </button>

            {/* BOTÓN NUEVA CUENTA */}
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta</span>
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

        {/* SECCIÓN 2: GESTIÓN DE VENDEDORES REGISTRADOS */}
        <section id="vendedores" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Vendedores y Revendedores Registrados ({sellers.length})
              </h2>
              <p className="text-xs text-gray-400">
                Usuarios que pueden iniciar sesión en el portal y gestionar sus cuentas asignadas
              </p>
            </div>
            <button
              onClick={handleOpenCreateSeller}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-purple-900/30 transition w-fit"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrar Vendedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellers.map((s) => {
              const assignedCount = accounts.filter(a => a.sellerId === s.id || a.sellerId === s.email || a.seller === s.name).length;
              return (
                <div key={s.id} className="p-4 rounded-xl bg-[#0b0f19] border border-gray-800 flex flex-col justify-between hover:border-gray-700 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{s.name}</div>
                      <div className="text-xs text-indigo-400 font-mono mt-0.5">{s.email || `${s.name.toLowerCase().replace(/\s+/g, "")}@ventas.com`}</div>
                      <div className="text-[11px] text-gray-500 mt-1">{s.phone}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                      Activo
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Cuentas:</span>
                      <span className="font-extrabold text-white bg-gray-800 px-2 py-0.5 rounded-lg text-xs text-indigo-300">
                        {assignedCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditSeller(s)}
                        className="px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 rounded-lg flex items-center gap-1 transition"
                        title="Editar Vendedor"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSeller(s.id, s.name)}
                        className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg flex items-center gap-1 transition"
                        title="Eliminar Vendedor"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN 3: GESTOR Y PROBADOR MAESTRO DE CÓDIGOS (EXCLUSIVO OWNER) */}
        <section id="codigos-owner" className="bg-gradient-to-br from-[#121826] to-[#0d121f] border border-indigo-500/30 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Shield className="w-3 h-3" />
                <span>Consola Master Owner (Acceso Ilimitado)</span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>Probador y Extractor de Códigos en Vivo</span>
              </h2>
              <p className="text-xs text-gray-400">
                Como Owner, puedes consultar el código de cualquier correo directamente sin restricciones de vendedor ni expiración
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                Correo de la Cuenta
              </label>
              <input
                type="email"
                placeholder="ej: hogaryutu+acido@gmail.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full bg-[#070a12] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                Servicio
              </label>
              <select
                value={testService}
                onChange={(e) => setTestService(e.target.value)}
                className="w-full bg-[#070a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="netflix">Netflix</option>
                <option value="disney">Disney+</option>
                <option value="max">Max (HBO)</option>
                <option value="prime">Prime Video</option>
                <option value="spotify">Spotify</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                Acción
              </label>
              <select
                value={testAction}
                onChange={(e) => setTestAction(e.target.value)}
                className="w-full bg-[#070a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="temporal">Temporal (4-6 dígitos)</option>
                <option value="actualizar">Actualizar Hogar</option>
                <option value="login_code">Código Inicio OTP</option>
                <option value="login_confirm">Confirmar Inicio (Link)</option>
                <option value="reset_password">Restablecer Clave</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleExecuteCodeTest}
              disabled={isTestingCode || !testEmail.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition disabled:opacity-50"
            >
              {isTestingCode ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Consultando Gmail / GAS...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Extraer Código / Enlace Ahora</span>
                </>
              )}
            </button>

            {/* Accesos rápidos con correos del inventario */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-400 text-[11px]">Rápido:</span>
              {accounts.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setTestEmail(a.email)}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[10px] font-mono truncate max-w-[170px]"
                >
                  {a.email}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado de la extracción */}
          {testResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#070a12] border border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Resultado Obtenido:</span>
                <div className="font-mono text-base font-black text-emerald-400 mt-0.5 break-all">
                  {testResult}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(testResult);
                    setCopiedTestCode(true);
                    setTimeout(() => setCopiedTestCode(false), 2000);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                >
                  {copiedTestCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTestCode ? "Copiado" : "Copiar"}</span>
                </button>
                {testResult.startsWith("http") && (
                  <a
                    href={testResult}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir</span>
                  </a>
                )}
              </div>
            </div>
          )}
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

        {/* MODAL IMPORTAR EXCEL / CSV */}
        {isExcelModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Importar Cuentas desde Excel o CSV</h3>
                  <p className="text-xs text-gray-400">
                    Sube un archivo con tus cuentas de streaming y asígnalas a tus vendedores automáticamente
                  </p>
                </div>
              </div>

              {/* Botón Descargar Plantilla */}
              <div className="mb-4 p-3 rounded-xl bg-[#0b0f19] border border-gray-800 flex items-center justify-between">
                <div className="text-xs text-gray-300">
                  <span className="font-semibold text-white">¿No tienes el formato exacto?</span>
                  <div className="text-[11px] text-gray-500">Descarga la plantilla con las columnas recomendadas: Plataforma, Correo, Contraseña, Perfiles, Vencimiento, Vendedor.</div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ml-3"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla .xlsx</span>
                </button>
              </div>

              {/* Zona de Drop / Input de archivo */}
              <div className="border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-2xl p-6 text-center transition bg-[#090d16]/60 cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <div className="text-sm font-semibold text-white">
                  {excelFile ? excelFile.name : "Selecciona o arrastra tu archivo Excel / CSV aquí"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Formatos soportados: .xlsx, .xls, .csv
                </div>
              </div>

              {/* Mensaje de éxito */}
              {importSuccessMessage && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* Vista Previa de Filas Parseadas */}
              {excelPreviewData.length > 0 && !importSuccessMessage && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                    <span>Vista Previa ({excelPreviewData.length} registros detectados)</span>
                    <span className="text-[11px] text-emerald-400">Listo para importar</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-gray-800 rounded-xl bg-[#0b0f19]">
                    <table className="w-full text-left text-[11px] text-gray-300">
                      <thead className="bg-[#070a12] text-gray-400 sticky top-0 border-b border-gray-800">
                        <tr>
                          <th className="py-2 px-3">Plataforma</th>
                          <th className="py-2 px-3">Correo</th>
                          <th className="py-2 px-3">Cupos</th>
                          <th className="py-2 px-3">Vendedor</th>
                          <th className="py-2 px-3">Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {excelPreviewData.slice(0, 15).map((row: any, i) => (
                          <tr key={i} className="hover:bg-gray-800/30">
                            <td className="py-2 px-3 font-semibold text-white">
                              {row["Plataforma"] || row["Servicio"] || "Netflix"}
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-300">
                              {row["Correo"] || row["Email"] || "-"}
                            </td>
                            <td className="py-2 px-3">
                              {row["Perfiles"] || row["Cupos"] || 5}
                            </td>
                            <td className="py-2 px-3 text-amber-300">
                              {row["Vendedor"] || "Sin Asignar"}
                            </td>
                            <td className="py-2 px-3 text-gray-400 font-mono">
                              {String(row["Vencimiento"] || "").substring(0, 10) || "30 días"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="mt-6 pt-4 border-t border-gray-800 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={excelPreviewData.length === 0 || isImporting}
                  onClick={handleProcessExcelImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Cargar {excelPreviewData.length} Cuentas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CREAR NUEVO VENDEDOR */}
        {isSellerModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsSellerModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  {editingSellerId ? <Edit className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingSellerId ? "Editar Vendedor" : "Registrar Nuevo Vendedor"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {editingSellerId 
                      ? "Modifica los datos de acceso y contacto del vendedor" 
                      : "Crea un vendedor para que pueda iniciar sesión y recibir cuentas"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSeller} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Nombre Completo del Vendedor</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Andrés Ventas"
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Correo Electrónico (Para Iniciar Sesión)</label>
                  <input
                    type="email"
                    required
                    placeholder="andres@ventas.com"
                    value={newSellerEmail}
                    onChange={(e) => setNewSellerEmail(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Contraseña de Acceso para el Vendedor</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: ClaveVentas2026*"
                    value={newSellerPassword}
                    onChange={(e) => setNewSellerPassword(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+58 412 0001122"
                    value={newSellerPhone}
                    onChange={(e) => setNewSellerPhone(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSellerModalOpen(false);
                      setEditingSellerId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-900/30"
                  >
                    {editingSellerId ? "Guardar Cambios" : "Registrar Vendedor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
