"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Copy,
  Globe,
  Receipt,
  ShoppingBag,
  CreditCard,
  Wallet,
  Banknote,
  Package,
  BarChart3,
  Menu,
  Layers,
  Tag,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getSystemUsers, 
  saveSystemUsers, 
  saveSystemUser,
  deleteSystemUser,
  getCurrentUser,
  getCatalogPlatforms,
  saveCatalogPlatforms,
  deleteImportBatch,
  getStoredSales,
  saveStoredSales,
  SaleRecord,
  ImportBatchRecord,
  CatalogPlatform,
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
  country?: string; // ej: Colombia, México, Global
  isVerified?: boolean; // si la cuenta sirve o no
  customerName?: string; // cliente o a quién se le vendió (opcional)
  importBatchId?: string; // id del lote de importación
  importedAt?: string; // fecha ISO de importación
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


// Helper robusto para formatear fechas de Excel (maneja serial numbers numéricos ej: 45600 y strings YYYY-MM-DD o DD/MM/YYYY)
function parseExcelDate(raw: any): string {
  if (!raw) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  // Si es un número (formato serial de Excel)
  if (typeof raw === "number" || (!isNaN(Number(raw)) && !String(raw).includes("-") && !String(raw).includes("/"))) {
    const num = Number(raw);
    if (num > 20000 && num < 70000) {
      // Excel epoch: Dec 30 1899
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const dateObj = new Date(excelEpoch.getTime() + num * 86400000);
      return dateObj.toISOString().split("T")[0];
    }
  }

  const str = String(raw).trim();

  // Si viene en formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Si viene en formato YYYY/MM/DD o YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Intentar parsear con Date nativo
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// Helper para tiempo relativo transcurrido
function getTimeAgo(dateString?: string): string {
  if (!dateString) return "Desconocido";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export default function OwnerDashboard() {
  const [dateFilter, setDateFilter] = useState("this_month");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Lista de Plataformas del Catálogo (Configurable por el Admin)
  const [catalogPlatforms, setCatalogPlatforms] = useState<CatalogPlatform[]>([]);

  // Lista de Vendedores sincronizada con account-manager
  const [sellers, setSellers] = useState<Seller[]>([]);

  // Cuentas Maestras sincronizadas con account-manager
  const [accounts, setAccounts] = useState<StreamingAccount[]>([]);

  // Selección de plataforma para la lista a subir (auto o fija)
  const [selectedImportPlatform, setSelectedImportPlatform] = useState<string>("auto");

  // Historial de lotes importados para poder revertirlos/borrarlos antes de 24h
  const [recentBatches, setRecentBatches] = useState<ImportBatchRecord[]>([]);

  // Modal para Gestión / Edición de Catálogo
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [platformForm, setPlatformForm] = useState<CatalogPlatform>({
    id: "",
    name: "",
    color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
    defaultProfiles: 5,
    defaultCost: 2.0,
    defaultIncome: 14.0,
    price: 3.5,
    category: "Full HD • 1 Pantalla",
    stock: 10,
    badge: "",
    features: ["Calidad HD/4K", "Perfil con PIN", "Soporte 24/7"]
  });

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

  // Navegación modular por secciones (HUD)
  const [activeTab, setActiveTab] = useState<"resumen" | "ventas" | "cuentas" | "vendedores" | "catalogo" | "codigos" | "todo">("resumen");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // LIBRO DE VENTAS (SHEET)
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [saleFilterType, setSaleFilterType] = useState<"all" | "detal" | "mayor">("all");
  const [saleFilterPayment, setSaleFilterPayment] = useState<string>("all");
  const [saleSearchQuery, setSaleSearchQuery] = useState("");
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState<{
    id: string;
    type: "detal" | "mayor";
    platform: string;
    selectedAccountId: string;
    accountEmail: string;
    customerName: string;
    customerContact: string;
    paymentMethod: "efectivo" | "nequi" | "daviplata" | "transferencia" | "binance" | "otro";
    costPrice: number;
    salePrice: number;
    profit: number;
    notes: string;
    isPhysicalSale: boolean;
  }>({
    id: "",
    type: "detal",
    platform: "Netflix Premium 4K",
    selectedAccountId: "manual",
    accountEmail: "",
    customerName: "",
    customerContact: "",
    paymentMethod: "efectivo",
    costPrice: 2.0,
    salePrice: 4.5,
    profit: 2.5,
    notes: "",
    isPhysicalSale: false
  });

  // Probador de Códigos en Vivo para Owner
  const [testEmail, setTestEmail] = useState("");
  const [testService, setTestService] = useState("netflix");
  const [testAction, setTestAction] = useState("temporal");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [copiedTestCode, setCopiedTestCode] = useState(false);

  // Función para refrescar vendedores, cuentas y catálogo
  const reloadData = () => {
    const rawUsers = getSystemUsers();
    const rawAccounts = getStoredAccounts();
    const currentPlatforms = getCatalogPlatforms();
    setCatalogPlatforms(currentPlatforms);

    // Cargar Libro de Ventas
    const rawSales = getStoredSales();
    setSales(rawSales);

    // Cargar historial de lotes de importación
    try {
      const storedBatches = localStorage.getItem("streamhub_import_batches");
      if (storedBatches) {
        setRecentBatches(JSON.parse(storedBatches));
      }
    } catch {}

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
      const platObj = currentPlatforms.find(p => p.name.toLowerCase().includes(a.platform.toLowerCase())) || currentPlatforms[0] || {
        id: "default",
        name: a.platform || "Servicio Streaming",
        color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
        defaultProfiles: 5,
        defaultCost: 2.0,
        defaultIncome: 14.0
      };

      // Calcular status inteligente basado en vencimiento
      let calculatedStatus: "assigned" | "available" | "expiring" = a.sellerId ? "assigned" : "available";
      if (a.expirationDate) {
        const exp = new Date(a.expirationDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 5) {
          calculatedStatus = "expiring";
        }
      }

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
        expirationDate: a.expirationDate || "2026-10-31",
        status: calculatedStatus,
        monthlyCost: a.monthlyCost || platObj.defaultCost,
        monthlyIncome: a.monthlyIncome || platObj.defaultIncome,
        notes: a.notes || "",
        country: a.country || "Global",
        isVerified: a.isVerified !== undefined ? a.isVerified : true,
        customerName: a.customerName || "",
        importBatchId: a.importBatchId,
        importedAt: a.importedAt
      };
    });
    setAccounts(formattedAccounts);
  };

  const router = useRouter();

  // Cargar datos iniciales y escuchar cambios (con protección de rol)
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role === "seller") {
      router.push("/dashboard/seller");
      return;
    }

    reloadData();

    // Escuchar cambios entre pestañas o eventos locales
    const handleStorageChange = () => reloadData();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("streamhub_users_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("streamhub_users_updated", handleStorageChange);
    };
  }, [router]);

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
      notes: a.notes,
      country: a.country,
      isVerified: a.isVerified,
      customerName: a.customerName,
      importBatchId: a.importBatchId,
      importedAt: a.importedAt
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

  // Revertir y borrar todas las cuentas de un lote importado (< 24 horas)
  const handleDeleteBatch = (batchId: string, batchPlatform: string, count: number) => {
    if (!confirm(`¿Estás seguro de que deseas revertir y eliminar todas las ${count} cuentas de este lote (${batchPlatform})?\n\nEsta acción borrará todas las cuentas subidas en esta lista y no se puede deshacer.`)) {
      return;
    }

    const updated = accounts.filter(a => a.importBatchId !== batchId);
    persistAccounts(updated);

    const updatedBatches = recentBatches.filter(b => b.id !== batchId);
    setRecentBatches(updatedBatches);
    if (typeof window !== "undefined") {
      localStorage.setItem("streamhub_import_batches", JSON.stringify(updatedBatches));
    }

    alert(`¡Se eliminaron exitosamente las ${count} cuentas de la lista seleccionada!`);
  };

  // Estado del Formulario de Cuenta
  const [formData, setFormData] = useState({
    platform: "Netflix Premium 4K",
    email: "",
    password: "",
    maxProfiles: 5,
    profilesOccupied: 0,
    seller: "Sin Asignar (En Stock)",
    purchaseDate: new Date().toISOString().split("T")[0],
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    monthlyCost: 2.00,
    monthlyIncome: 14.00,
    notes: "",
    country: "Global",
    isVerified: true,
    customerName: ""
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

  // FILTRADO DINÁMICO DE VENTAS (TIPO + PAGO + BÚSQUEDA)
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchType = saleFilterType === "all" || s.type === saleFilterType;
      const matchPayment = saleFilterPayment === "all" || s.paymentMethod === saleFilterPayment;
      const q = saleSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.customerName.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        (s.accountEmail && s.accountEmail.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      return matchType && matchPayment && matchSearch;
    });
  }, [sales, saleFilterType, saleFilterPayment, saleSearchQuery]);

  // CÁLCULO DE MÉTRICAS FINANCIERAS DEL LIBRO DE VENTAS
  const salesStats = useMemo(() => {
    const totalCollected = sales.reduce((acc, s) => acc + Number(s.salePrice || 0), 0);
    const totalCost = sales.reduce((acc, s) => acc + Number(s.costPrice || 0), 0);
    const totalProfit = sales.reduce((acc, s) => acc + Number(s.profit || 0), 0);
    const margin = totalCollected > 0 ? ((totalProfit / totalCollected) * 100).toFixed(1) : "0";

    const detalSales = sales.filter((s) => s.type === "detal");
    const mayorSales = sales.filter((s) => s.type === "mayor");
    const physicalSales = sales.filter((s) => s.isPhysicalSale || s.paymentMethod === "efectivo");

    const detalRevenue = detalSales.reduce((acc, s) => acc + Number(s.salePrice || 0), 0);
    const detalProfit = detalSales.reduce((acc, s) => acc + Number(s.profit || 0), 0);

    const mayorRevenue = mayorSales.reduce((acc, s) => acc + Number(s.salePrice || 0), 0);
    const mayorProfit = mayorSales.reduce((acc, s) => acc + Number(s.profit || 0), 0);

    const cashRevenue = sales
      .filter((s) => s.paymentMethod === "efectivo")
      .reduce((acc, s) => acc + Number(s.salePrice || 0), 0);

    const digitalRevenue = sales
      .filter((s) => s.paymentMethod !== "efectivo")
      .reduce((acc, s) => acc + Number(s.salePrice || 0), 0);

    return {
      totalCollected,
      totalCost,
      totalProfit,
      margin,
      detalCount: detalSales.length,
      detalRevenue,
      detalProfit,
      mayorCount: mayorSales.length,
      mayorRevenue,
      mayorProfit,
      physicalCount: physicalSales.length,
      cashRevenue,
      digitalRevenue
    };
  }, [sales]);

  // ABRIR MODAL PARA REGISTRAR VENTA
  const handleOpenCreateSale = (preselectedAccount?: StreamingAccount) => {
    const firstPlat = preselectedAccount
      ? catalogPlatforms.find((p) => p.name === preselectedAccount.platform) || catalogPlatforms[0]
      : catalogPlatforms[0];

    const defCost = preselectedAccount ? (preselectedAccount.monthlyCost || 2.0) : (firstPlat?.defaultCost || 2.0);
    const defPrice = firstPlat?.price || 3.5;
    const defProfit = Math.max(0, defPrice - defCost);

    setSaleForm({
      id: `sale-${Date.now()}`,
      type: "detal",
      platform: preselectedAccount ? preselectedAccount.platform : (firstPlat?.name || "Netflix Premium 4K"),
      selectedAccountId: preselectedAccount ? preselectedAccount.id : "manual",
      accountEmail: preselectedAccount ? preselectedAccount.email : "",
      customerName: preselectedAccount?.customerName || "",
      customerContact: "",
      paymentMethod: "efectivo",
      costPrice: defCost,
      salePrice: defPrice,
      profit: defProfit,
      notes: preselectedAccount ? `Venta desde inventario: ${preselectedAccount.email}` : "Venta directa en persona",
      isPhysicalSale: true
    });
    setIsSaleModalOpen(true);
  };

  // GUARDAR VENTA EN EL LIBRO
  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.customerName.trim() || !saleForm.platform) {
      alert("Por favor indica el cliente y la plataforma de la venta.");
      return;
    }

    const newRecord: SaleRecord = {
      id: `sale-${Date.now()}`,
      date: new Date().toISOString(),
      type: saleForm.type,
      platform: saleForm.platform,
      accountId: saleForm.selectedAccountId !== "manual" ? saleForm.selectedAccountId : undefined,
      accountEmail: saleForm.accountEmail,
      customerName: saleForm.customerName.trim(),
      customerContact: saleForm.customerContact.trim() || undefined,
      paymentMethod: saleForm.paymentMethod,
      costPrice: Number(saleForm.costPrice) || 0,
      salePrice: Number(saleForm.salePrice) || 0,
      profit: Number(saleForm.profit) || 0,
      notes: saleForm.notes.trim() || undefined,
      isPhysicalSale: saleForm.isPhysicalSale
    };

    // Si asoció una cuenta del inventario en stock, marcarla como vendida al cliente
    if (saleForm.selectedAccountId && saleForm.selectedAccountId !== "manual") {
      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === saleForm.selectedAccountId) {
          return {
            ...acc,
            customerName: saleForm.customerName.trim(),
            seller: `👤 ${saleForm.customerName.trim()}`,
            status: "assigned" as const,
            notes: (acc.notes ? acc.notes + " • " : "") + `Vendido el ${new Date().toLocaleDateString()}`
          };
        }
        return acc;
      });
      persistAccounts(updatedAccounts);
    }

    const updatedSales = [newRecord, ...sales];
    setSales(updatedSales);
    saveStoredSales(updatedSales);
    setIsSaleModalOpen(false);
    setSaleSuccessMessage(`¡Venta registrada con éxito! Ganancia añadida: ${formatCurrency(newRecord.profit)}`);
    setTimeout(() => setSaleSuccessMessage(null), 3000);
  };

  // ELIMINAR REGISTRO DE VENTA
  const handleDeleteSale = (saleId: string) => {
    if (confirm("¿Estás seguro de eliminar este registro del libro de ventas?")) {
      const updated = sales.filter((s) => s.id !== saleId);
      setSales(updated);
      saveStoredSales(updated);
    }
  };

  // EXPORTAR LIBRO DE VENTAS A EXCEL
  const handleExportSalesExcel = () => {
    const exportData = filteredSales.map((s) => ({
      "Fecha": new Date(s.date).toLocaleDateString() + " " + new Date(s.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Tipo de Venta": s.type === "detal" ? "Al Detal (Cliente / Personal)" : "Al Mayor (Revendedor)",
      "En Persona (Física)": s.isPhysicalSale ? "Sí (Presencial)" : "No (Online)",
      "Cliente": s.customerName,
      "Teléfono / Contacto": s.customerContact || "-",
      "Plataforma": s.platform,
      "Cuenta / Email": s.accountEmail || "Entrega directa",
      "Método de Pago": s.paymentMethod.toUpperCase(),
      "Cobrado ($)": s.salePrice,
      "Costo ($)": s.costPrice,
      "Ganancia Neta ($)": s.profit,
      "Notas": s.notes || ""
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Libro de Ventas");
    XLSX.writeFile(wb, `Libro_Ventas_StreamHub_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // GESTIÓN DEL CATÁLOGO DE PLATAFORMAS (CREAR / EDITAR / ELIMINAR)
  const handleOpenCreatePlatform = () => {
    setEditingPlatformId(null);
    setPlatformForm({
      id: `plat-${Date.now()}`,
      name: "",
      color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
      defaultProfiles: 5,
      defaultCost: 2.0,
      defaultIncome: 14.0,
      price: 3.5,
      category: "Full HD • 1 Pantalla",
      stock: 10,
      badge: "Nuevo",
      features: ["Acceso Inmediato 24/7", "Garantía de Servicio", "Soporte dedicado"]
    });
    setIsCatalogModalOpen(true);
  };

  const handleOpenEditPlatform = (plat: CatalogPlatform) => {
    setEditingPlatformId(plat.id);
    setPlatformForm({
      ...plat,
      features: plat.features || ["Calidad Garantizada", "Soporte 24/7"]
    });
    setIsCatalogModalOpen(true);
  };

  const handleSavePlatform = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformForm.name.trim()) return;

    let updated: CatalogPlatform[] = [];
    if (editingPlatformId) {
      updated = catalogPlatforms.map(p => p.id === editingPlatformId ? { ...platformForm } : p);
    } else {
      updated = [...catalogPlatforms, { ...platformForm, id: `plat-${Date.now()}` }];
    }
    saveCatalogPlatforms(updated);
    setCatalogPlatforms(updated);
    setIsCatalogModalOpen(false);
  };

  const handleDeletePlatform = (platId: string, platName: string) => {
    if (!confirm(`¿Eliminar la plataforma "${platName}" del catálogo? Las cuentas existentes conservarán su nombre.`)) {
      return;
    }
    const updated = catalogPlatforms.filter(p => p.id !== platId);
    saveCatalogPlatforms(updated);
    setCatalogPlatforms(updated);
  };

  // ABRIR MODAL CREAR CUENTA
  const handleOpenCreateModal = () => {
    setEditingAccountId(null);
    const firstPlat = catalogPlatforms[0] || {
      name: "Netflix Premium 4K",
      defaultProfiles: 5,
      defaultCost: 2.0,
      defaultIncome: 15.0
    };
    setFormData({
      platform: firstPlat.name,
      email: "",
      password: "",
      maxProfiles: firstPlat.defaultProfiles,
      profilesOccupied: 0,
      seller: "Sin Asignar (En Stock)",
      purchaseDate: new Date().toISOString().split("T")[0],
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      monthlyCost: firstPlat.defaultCost,
      monthlyIncome: firstPlat.defaultIncome,
      notes: "",
      country: "Global",
      isVerified: true,
      customerName: ""
    });
    setIsAccountModalOpen(true);
  };

  // ABRIR MODAL EDITAR CUENTA
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
      notes: acc.notes || "",
      country: acc.country || "Global",
      isVerified: acc.isVerified !== undefined ? acc.isVerified : true,
      customerName: acc.customerName || ""
    });
    setIsAccountModalOpen(true);
  };

  // GUARDAR CUENTA (CREAR O EDITAR)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const platObj = catalogPlatforms.find((p) => p.name === formData.platform) || catalogPlatforms[0] || {
      name: formData.platform,
      color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30"
    };
    const isAssigned = formData.seller !== "Sin Asignar (En Stock)";
    const matchedSeller = sellers.find(s => s.name === formData.seller);

    if (editingAccountId) {
      // Editar existente
      const updated = accounts.map((acc) =>
        acc.id === editingAccountId
          ? {
              ...acc,
              ...formData,
              sellerId: matchedSeller ? matchedSeller.id : (isAssigned ? acc.sellerId : undefined),
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
    setSelectedSellerToAssign(acc.sellerId || "");
    setIsAssignModalOpen(true);
  };

  // GUARDAR ASIGNACIÓN DE VENDEDOR (ASIGNAR / REASIGNAR / DESASIGNAR)
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

  // DESASIGNACIÓN DIRECTA RÁPIDA (DEVOLVER A STOCK LIBRE CON UN CLIC)
  const handleQuickUnassign = (acc: StreamingAccount) => {
    const updated = accounts.map((a) =>
      a.id === acc.id
        ? {
            ...a,
            seller: "Sin Asignar (En Stock)",
            sellerId: undefined,
            status: "available" as any
          }
        : a
    );
    persistAccounts(updated);
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
      const batchId = `batch_${Date.now()}`;
      const importTime = new Date().toISOString();

      excelPreviewData.forEach((row: any, idx) => {
        // Plataforma destino: la seleccionada en el modal o la de la fila del Excel
        let rawPlatform = selectedImportPlatform !== "auto" 
          ? selectedImportPlatform 
          : (row["Plataforma"] || row["Servicio"] || row["Platform"] || "Netflix Premium 4K");

        const platObj = catalogPlatforms.find(p => p.name.toLowerCase().includes(String(rawPlatform).toLowerCase())) || catalogPlatforms[0] || {
          name: String(rawPlatform),
          color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30",
          defaultProfiles: 5,
          defaultCost: 2.0,
          defaultIncome: 14.0
        };
        
        const email = String(row["Correo"] || row["Email"] || row["Usuario"] || "").trim();
        if (!email) return;

        const password = String(row["Clave"] || row["Contraseña"] || row["Password"] || "Password2026*").trim();
        const country = String(row["País"] || row["Pais"] || row["Country"] || "Global").trim();

        // Verificada: Si sirve o no (detecta sí, si, true, 1, funciona vs no, false, 0, caida)
        const rawVerified = String(row["Verificada (Sí/No)"] || row["Verificada"] || row["Verificado"] || row["Sirve"] || row["Estado"] || "Sí").toLowerCase().trim();
        const isVerified = !(rawVerified.includes("no") || rawVerified === "0" || rawVerified === "false" || rawVerified.includes("falla") || rawVerified.includes("caida"));

        const maxProfiles = Number(row["Perfiles"] || row["Cupos"] || platObj.defaultProfiles) || platObj.defaultProfiles;

        // Vendido a / Asignado a (Vendedor o Cliente final)
        const customerOrSellerCol = String(
          row["Vendido a / Asignado a"] || 
          row["Vendido a"] || 
          row["Vendido A"] || 
          row["Cliente"] || 
          row["Asignado a"] || 
          row["Asignado A"] || 
          row["Vendedor"] || 
          row["Seller"] || 
          ""
        ).trim();

        const matchedSeller = sellers.find(s => 
          s.name.toLowerCase().includes(customerOrSellerCol.toLowerCase()) || 
          (s.email && s.email.toLowerCase() === customerOrSellerCol.toLowerCase())
        );

        const customerName = matchedSeller ? "" : customerOrSellerCol;
        const sellerDisplayName = matchedSeller 
          ? matchedSeller.name 
          : (customerOrSellerCol ? customerOrSellerCol : "Sin Asignar (En Stock)");

        const occupied = Number(row["Ocupados"] || (customerOrSellerCol ? 1 : 0));

        // Parsear fecha de vencimiento limpiamente (maneja serial number de excel y strings)
        const rawExp = row["Fecha Vencimiento"] || row["Vencimiento"] || row["Expiration"] || row["Fecha"] || "";
        const expDate = parseExcelDate(rawExp);

        // Calcular estado si está por vencer o vencido
        let calculatedStatus: "assigned" | "available" | "expiring" = (matchedSeller || customerOrSellerCol) ? "assigned" : "available";
        const expObj = new Date(expDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((expObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 5) {
          calculatedStatus = "expiring";
        }

        importedAccounts.push({
          id: `acc-imp-${Date.now()}-${idx}`,
          platform: platObj.name,
          platformColor: platObj.color,
          email,
          password,
          seller: sellerDisplayName,
          sellerId: matchedSeller ? matchedSeller.id : undefined,
          profilesOccupied: occupied,
          maxProfiles,
          purchaseDate: new Date().toISOString().split("T")[0],
          expirationDate: expDate,
          status: calculatedStatus,
          monthlyCost: platObj.defaultCost,
          monthlyIncome: platObj.defaultIncome,
          notes: String(row["Notas"] || row["Observaciones"] || "Importado vía Excel/CSV"),
          country: country || "Global",
          isVerified,
          customerName: customerName || undefined,
          importBatchId: batchId,
          importedAt: importTime
        });
      });

      if (importedAccounts.length > 0) {
        persistAccounts([...importedAccounts, ...accounts]);

        // Registrar en historial de lotes (vigente por 24 horas)
        const batchPlatformName = selectedImportPlatform !== "auto" 
          ? selectedImportPlatform 
          : "Plataformas Mixtas (Detectadas)";

        const newBatch: ImportBatchRecord = {
          id: batchId,
          platform: batchPlatformName,
          count: importedAccounts.length,
          importedAt: importTime,
          filename: excelFile?.name || "Lista_Cuentas.xlsx"
        };
        const updatedBatches = [newBatch, ...recentBatches];
        setRecentBatches(updatedBatches);
        if (typeof window !== "undefined") {
          localStorage.setItem("streamhub_import_batches", JSON.stringify(updatedBatches));
        }

        setImportSuccessMessage(`¡Se importaron exitosamente ${importedAccounts.length} cuentas de streaming! Puedes deshacer o borrar este lote si fue un error durante las próximas 24 horas.`);
        setTimeout(() => {
          setIsExcelModalOpen(false);
          setExcelFile(null);
          setExcelPreviewData([]);
          setImportSuccessMessage(null);
        }, 2500);
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
        "País": "Colombia",
        "Plataforma": "Netflix Premium 4K",
        "Correo": "ejemplo.netflix1@correo.com",
        "Clave": "ClaveSegura2026*",
        "Verificada (Sí/No)": "Sí",
        "Fecha Vencimiento": "2026-11-15",
        "Vendido a / Asignado a": "Carlos Vendedor",
        "Perfiles": 5,
        "Notas": "Perfil 1 con PIN"
      },
      {
        "País": "México",
        "Plataforma": "Disney+ Standard",
        "Correo": "ejemplo.disney2@correo.com",
        "Clave": "DisneyPass2026#",
        "Verificada (Sí/No)": "Sí",
        "Fecha Vencimiento": "2026-11-20",
        "Vendido a / Asignado a": "Cliente Juan Pérez",
        "Perfiles": 4,
        "Notas": "Garantía de 30 días"
      },
      {
        "País": "Global",
        "Plataforma": "Max (HBO Max)",
        "Correo": "ejemplo.max3@correo.com",
        "Clave": "MaxPassword778!",
        "Verificada (Sí/No)": "No",
        "Fecha Vencimiento": "2026-12-01",
        "Vendido a / Asignado a": "",
        "Perfiles": 5,
        "Notas": "En Stock sin vender"
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
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col md:flex-row w-full max-w-full overflow-x-hidden">
      {/* MOBILE STICKY HEADER & HUD BAR */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0d121f]/95 backdrop-blur-md border-b border-gray-800 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white tracking-tight leading-none">STREAMHUB</div>
              <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">PANEL OWNER</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenCreateSale()}
              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-md shadow-emerald-950/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Venta</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white border border-gray-700"
              title="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carrusel de pestañas horizontal deslizable en móvil */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("resumen")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "resumen" ? "bg-indigo-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Resumen</span>
          </button>
          <button
            onClick={() => setActiveTab("ventas")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "ventas" ? "bg-emerald-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Libro Ventas ({sales.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "cuentas" ? "bg-indigo-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Stock ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("vendedores")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "vendedores" ? "bg-purple-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Vendedores ({sellers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("catalogo")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "catalogo" ? "bg-amber-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catálogo</span>
          </button>
          <button
            onClick={() => setActiveTab("codigos")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "codigos" ? "bg-pink-600 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Códigos</span>
          </button>
          <button
            onClick={() => setActiveTab("todo")}
            className={`px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition ${
              activeTab === "todo" ? "bg-gray-700 text-white shadow-sm" : "bg-[#131b2e] text-gray-400 border border-gray-800"
            }`}
          >
            <span>Ver Todo</span>
          </button>
        </div>

        {/* Desplegable móvil extra si mobileMenuOpen */}
        {mobileMenuOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-800 space-y-1.5 text-xs">
            <Link
              href="/dashboard/seller"
              className="block p-2 rounded-lg bg-gray-800/80 text-indigo-300 font-medium"
            >
              ⇄ Cambiar a Vista Vendedor
            </Link>
            <Link
              href="/"
              className="block p-2 rounded-lg bg-gray-800/80 text-gray-400 font-medium"
            >
              ← Ver Tienda Pública
            </Link>
          </div>
        )}
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d121f] p-5 hidden md:flex flex-col justify-between shrink-0">
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

          <nav className="space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("resumen")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "resumen" ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4" />
                <span>Resumen & KPIs</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("ventas")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "ventas" ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Libro de Ventas (Sheet)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {sales.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("cuentas")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "cuentas" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Tv className="w-4 h-4" />
                <span>Stock de Cuentas</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-300">
                {accounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("vendedores")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "vendedores" ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Revendedores</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300">
                {sellers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("catalogo")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "catalogo" ? "bg-amber-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Catálogo & Tarifas</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300">
                {catalogPlatforms.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("codigos")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "codigos" ? "bg-pink-600 text-white shadow-md" : "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4" />
                <span>Extractor de Códigos</span>
              </div>
            </button>

            <div className="pt-2">
              <button
                onClick={() => setActiveTab("todo")}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs transition ${
                  activeTab === "todo" ? "bg-gray-800 text-white font-bold" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                👁️ Ver Todas las Secciones
              </button>
            </div>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800 space-y-2 text-xs">
          <Link href="/dashboard/seller" className="block text-indigo-400 hover:underline">
            ⇄ Cambiar a Vista Vendedor
          </Link>
          <Link href="/" className="block text-gray-500 hover:text-gray-300">
            ← Ver Tienda Pública
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-full">
        {/* HEADER PRINCIPAL */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Panel Maestro del Owner
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
              Control de finanzas, libro de ventas (detal/mayor), inventario y revendedores
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#121826] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="this_month">Este Mes</option>
              <option value="last_month">Mes Anterior</option>
              <option value="this_year">Año Completo</option>
            </select>

            {/* BOTÓN REGISTRAR VENTA */}
            <button
              onClick={() => handleOpenCreateSale()}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition transform hover:-translate-y-0.5"
              title="Registrar una venta al detal, al mayor o en persona"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Venta</span>
            </button>

            {/* BOTÓN NUEVA CUENTA */}
            <button
              onClick={handleOpenCreateModal}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Cuenta</span>
            </button>

            {/* BOTÓN IMPORTAR EXCEL */}
            <button
              onClick={() => {
                setExcelPreviewData([]);
                setExcelFile(null);
                setImportSuccessMessage(null);
                setIsExcelModalOpen(true);
              }}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              title="Importar cuentas masivamente desde archivo Excel o CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar Excel</span>
            </button>

            {/* BOTÓN NUEVO VENDEDOR */}
            <button
              onClick={() => setIsSellerModalOpen(true)}
              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-purple-400" />
              <span>Vendedor</span>
            </button>
          </div>
        </div>

        {/* HUD DE SECCIONES (TABS BAR PARA ESCRITORIO Y TABLET) */}
        <div className="hidden sm:flex items-center gap-2 p-1.5 rounded-2xl bg-[#0d121f] border border-gray-800 mb-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("resumen")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "resumen" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Resumen Global</span>
          </button>
          <button
            onClick={() => setActiveTab("ventas")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "ventas" ? "bg-emerald-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            <span>Libro de Ventas (Sheet)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              +{formatCurrency(salesStats.totalProfit)}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "cuentas" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Stock Cuentas ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("vendedores")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "vendedores" ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Revendedores ({sellers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("catalogo")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "catalogo" ? "bg-amber-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tarifario & Catálogo ({catalogPlatforms.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("codigos")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === "codigos" ? "bg-pink-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Códigos</span>
          </button>
          <button
            onClick={() => setActiveTab("todo")}
            className={`ml-auto px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === "todo" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Mostrar Todo
          </button>
        </div>

        {/* FINANCIAL KPI CARDS (RESUMEN) */}
        {(activeTab === "resumen" || activeTab === "todo") && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
            {/* Ingresos */}
            <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Ingresos Totales</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white mt-2">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-[11px] text-emerald-400 mt-1 font-medium truncate">
                Calculado en base a ocupación
              </div>
            </div>

            {/* Gastos */}
            <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Costos Cuentas</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white mt-2">{formatCurrency(stats.totalExpenses)}</div>
              <div className="text-[11px] text-gray-400 mt-1 font-medium truncate">
                {accounts.length} cuentas en inventario
              </div>
            </div>

            {/* Ganancia Neta */}
            <div className="bg-gradient-to-b from-[#18233c] to-[#121826] border border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-lg shadow-indigo-950/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider">Ganancia Neta</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white mt-2">{formatCurrency(stats.netProfit)}</div>
              <div className="text-[11px] text-indigo-300 mt-1 font-semibold truncate">
                Margen de Utilidad: {stats.marginPercentage}
              </div>
            </div>

            {/* Vencimientos Próximos */}
            <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Vencen en 7 días</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-amber-400 mt-2">{stats.expiringSoon} cuentas</div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                Requieren renovación
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN LIBRO DE VENTAS & SHEET */}
        {(activeTab === "ventas" || activeTab === "todo") && (
          <section id="ventas-sheet" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-4 sm:p-6 mb-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <Receipt className="w-3 h-3" />
                  <span>Control Financiero Ejecutivo (Sheet)</span>
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Libro de Ventas & Registro de Ganancias</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-500/20">
                    {sales.length} registradas
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Lleva el registro de tus ventas al detal (clientes / en persona) y al mayor (revendedores) con cálculo de ganancia en vivo
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportSalesExcel}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                  title="Descargar libro de ventas en formato Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Excel</span>
                </button>
                <button
                  onClick={() => handleOpenCreateSale()}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition transform hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Registrar Venta</span>
                </button>
              </div>
            </div>

            {saleSuccessMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saleSuccessMessage}</span>
              </div>
            )}

            {/* KPIs del Libro de Ventas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              {/* Ventas Detal */}
              <div className="bg-[#0b0f19] border border-gray-800/80 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold uppercase text-[10px] tracking-wider text-teal-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Ventas al Detal</span>
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">{salesStats.detalCount}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-white mt-1.5">
                  {formatCurrency(salesStats.detalRevenue)}
                </div>
                <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                  Ganancia: +{formatCurrency(salesStats.detalProfit)}
                </div>
              </div>

              {/* Ventas Mayor */}
              <div className="bg-[#0b0f19] border border-gray-800/80 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold uppercase text-[10px] tracking-wider text-purple-400 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>Ventas al Mayor</span>
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">{salesStats.mayorCount}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-white mt-1.5">
                  {formatCurrency(salesStats.mayorRevenue)}
                </div>
                <div className="text-[11px] text-purple-300 mt-0.5 font-medium">
                  Ganancia: +{formatCurrency(salesStats.mayorProfit)}
                </div>
              </div>

              {/* Ganancia Neta Total Acumulada */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-[#0b0f19] border border-emerald-500/40 rounded-xl p-3.5 sm:p-4 shadow-md shadow-emerald-950/20">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Ganancia Neta</span>
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    +{salesStats.margin}%
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5">
                  +{formatCurrency(salesStats.totalProfit)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Cobrado: {formatCurrency(salesStats.totalCollected)}
                </div>
              </div>

              {/* Caja Efectivo (En Persona) vs Digital */}
              <div className="bg-[#0b0f19] border border-gray-800/80 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold uppercase text-[10px] tracking-wider text-amber-400 flex items-center gap-1">
                    <Banknote className="w-3 h-3" />
                    <span>Caja / En Persona</span>
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">{salesStats.physicalCount}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-amber-300 mt-1.5">
                  {formatCurrency(salesStats.cashRevenue)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Bancos/Nequi: {formatCurrency(salesStats.digitalRevenue)}
                </div>
              </div>
            </div>

            {/* Filtros del Sheet */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-[#0b0f19] border border-gray-800 p-1">
                  <button
                    onClick={() => setSaleFilterType("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      saleFilterType === "all" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Todas ({sales.length})
                  </button>
                  <button
                    onClick={() => setSaleFilterType("detal")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      saleFilterType === "detal" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🏷️ Detal ({sales.filter(s => s.type === "detal").length})
                  </button>
                  <button
                    onClick={() => setSaleFilterType("mayor")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      saleFilterType === "mayor" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    📦 Mayor ({sales.filter(s => s.type === "mayor").length})
                  </button>
                </div>

                <select
                  value={saleFilterPayment}
                  onChange={(e) => setSaleFilterPayment(e.target.value)}
                  className="bg-[#0b0f19] border border-gray-800 text-xs text-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos los Métodos</option>
                  <option value="efectivo">💵 Efectivo (En Persona)</option>
                  <option value="nequi">📱 Nequi</option>
                  <option value="daviplata">📱 Daviplata</option>
                  <option value="transferencia">🏦 Transferencia / Banco</option>
                  <option value="binance">🪙 Binance / USDT</option>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cliente, cuenta..."
                  value={saleSearchQuery}
                  onChange={(e) => setSaleSearchQuery(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* TABLA SHEET DE VENTAS */}
            <div className="overflow-x-auto rounded-xl border border-gray-800/80 bg-[#090d16]">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0b0f19] text-gray-400 uppercase font-semibold border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-3.5">Fecha</th>
                    <th className="py-3 px-3.5">Tipo</th>
                    <th className="py-3 px-3.5">Cliente / Contacto</th>
                    <th className="py-3 px-3.5">Plataforma / Cuenta</th>
                    <th className="py-3 px-3.5 text-center">Pago</th>
                    <th className="py-3 px-3.5 text-right">Cobrado</th>
                    <th className="py-3 px-3.5 text-right">Costo</th>
                    <th className="py-3 px-3.5 text-right">Ganancia</th>
                    <th className="py-3 px-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-500">
                        No hay ventas registradas con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-800/30 transition">
                        <td className="py-3 px-3.5 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                          {new Date(sale.date).toLocaleDateString()}
                          <div className="text-[10px] text-gray-500">
                            {new Date(sale.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {sale.type === "detal" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/60 text-teal-300 border border-teal-500/30">
                              <Tag className="w-2.5 h-2.5" /> Detal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30">
                              <Package className="w-2.5 h-2.5" /> Mayor
                            </span>
                          )}
                          {sale.isPhysicalSale && (
                            <span className="block mt-0.5 text-[9px] text-amber-400 font-semibold">
                              💵 En Persona
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-white">{sale.customerName}</div>
                          {sale.customerContact && (
                            <div className="text-[10px] text-gray-400">{sale.customerContact}</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-gray-200">{sale.platform}</div>
                          {sale.accountEmail ? (
                            <div className="font-mono text-[10px] text-indigo-300 truncate max-w-[180px]">
                              {sale.accountEmail}
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-500 italic">Venta directa</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#131b2e] border border-gray-700 text-gray-300 uppercase">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-white">
                          ${Number(sale.salePrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-gray-400 text-[11px]">
                          ${Number(sale.costPrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-emerald-400">
                          +${Number(sale.profit).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition rounded"
                            title="Eliminar registro"
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
        )}

        {/* SECCIÓN CATÁLOGO DE SERVICIOS */}
        {(activeTab === "catalogo" || activeTab === "todo") && (
          <section id="catalogo" className="bg-[#121826] border border-gray-800/80 rounded-2xl p-6 mb-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Control Maestro de Productos</span>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Catálogo de Plataformas y Servicios ({catalogPlatforms.length})
                </h2>
                <p className="text-xs text-gray-400">
                  Edita nombres, precios de venta, costos base, cupos por defecto y beneficios que se muestran en la tienda pública
                </p>
              </div>
              <button
                onClick={handleOpenCreatePlatform}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-amber-950/40 transition w-fit"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Plataforma</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogPlatforms.map((plat) => (
                <div 
                  key={plat.id} 
                  className="p-4 rounded-xl bg-[#0b0f19] border border-gray-800/80 hover:border-gray-700 flex flex-col justify-between transition group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border mb-1.5 ${plat.color}`}>
                          {plat.name}
                        </span>
                        {plat.badge && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {plat.badge}
                          </span>
                        )}
                        <div className="text-xs text-gray-400">{plat.category || "Servicio Streaming"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-emerald-400 font-mono">
                          ${Number(plat.price || plat.defaultIncome || 3.5).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-500">PVP Tienda</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-[#070a12] border border-gray-800/60 text-center text-[11px]">
                      <div>
                        <div className="text-gray-500 text-[10px]">Perfiles</div>
                        <div className="font-bold text-white">{plat.defaultProfiles}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[10px]">Costo Base</div>
                        <div className="font-bold text-red-400">${Number(plat.defaultCost).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[10px]">Margen Estim.</div>
                        <div className="font-bold text-emerald-400">
                          ${(Number(plat.defaultIncome || 14) - Number(plat.defaultCost || 2)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-gray-500">
                      {accounts.filter(a => a.platform.toLowerCase().includes(plat.name.toLowerCase())).length} cuentas registradas
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditPlatform(plat)}
                        className="px-2.5 py-1 text-xs text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg flex items-center gap-1 transition"
                        title="Editar características y precios de la plataforma"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlatform(plat.id, plat.name)}
                        className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg flex items-center gap-1 transition"
                        title="Eliminar del catálogo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TABLA DE GESTIÓN DE CUENTAS */}
        {(activeTab === "cuentas" || activeTab === "todo") && (
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
                  {catalogPlatforms.map((p) => (
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
                    <th className="py-3 px-4">Plataforma & País</th>
                    <th className="py-3 px-4">Correo & Contraseña</th>
                    <th className="py-3 px-4 text-center">Verificada</th>
                    <th className="py-3 px-4">Vendido a / Asignado</th>
                    <th className="py-3 px-4 text-center">Perfiles / Cupos</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No se encontraron cuentas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-gray-800/30 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${acc.platformColor}`}>
                              {acc.platform}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400/90 font-medium bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                              <Globe className="w-2.5 h-2.5" />
                              <span>{acc.country || "Global"}</span>
                            </span>
                          </div>
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
                        <td className="py-3.5 px-4 text-center">
                          {acc.isVerified !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Sirve</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/30">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>Caída</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {acc.customerName ? (
                            <div>
                              <span className="text-purple-300 font-medium flex items-center gap-1 text-xs">
                                <span>👤</span>
                                <span>{acc.customerName}</span>
                              </span>
                              {acc.sellerId && (
                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                  Revendedor: {acc.seller}
                                </span>
                              )}
                            </div>
                          ) : acc.sellerId ? (
                            <span className="text-gray-200 font-medium flex items-center gap-1">
                              <span>💼</span>
                              <span>{acc.seller}</span>
                            </span>
                          ) : (
                            <span className="text-amber-400/90 font-medium">
                              Sin Asignar (Stock)
                            </span>
                          )}
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
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenCreateSale(acc)}
                            className="px-2 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-500/30 rounded-lg transition inline-flex items-center gap-1 shadow-sm"
                            title="Registrar venta de esta cuenta al detal o mayor"
                          >
                            <DollarSign className="w-3 h-3 text-emerald-400" />
                            <span>Vender</span>
                          </button>
                          {acc.sellerId ? (
                            <button
                              onClick={() => handleQuickUnassign(acc)}
                              className="px-2 py-1 text-xs text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg transition"
                              title="Quitar vendedor y dejar en stock libre"
                            >
                              Quitar
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleOpenAssignModal(acc)}
                            className="px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 border border-indigo-500/30 rounded-lg transition"
                            title="Asignar o cambiar vendedor"
                          >
                            {acc.sellerId ? "Cambiar" : "Asignar"}
                          </button>
                          <button
                            onClick={() => {
                              setTestEmail(acc.email);
                              const platLower = acc.platform.toLowerCase();
                              if (platLower.includes("netflix")) setTestService("netflix");
                              else if (platLower.includes("disney") || platLower.includes("star")) setTestService("disney");
                              else if (platLower.includes("max") || platLower.includes("hbo")) setTestService("max");
                              else if (platLower.includes("prime")) setTestService("prime");
                              else if (platLower.includes("spotify")) setTestService("spotify");
                              else if (platLower.includes("crunchy")) setTestService("crunchyroll");
                              const codigosEl = document.getElementById("codigos-owner");
                              codigosEl?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="px-2 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/40 border border-emerald-500/30 rounded-lg transition"
                            title="Extraer códigos de esta cuenta"
                          >
                            <KeyRound className="w-3.5 h-3.5 inline" />
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
        )}

        {/* SECCIÓN 2: GESTIÓN DE VENDEDORES REGISTRADOS */}
        {(activeTab === "vendedores" || activeTab === "todo") && (
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
        )}

        {/* SECCIÓN 3: GESTOR Y PROBADOR MAESTRO DE CÓDIGOS (EXCLUSIVO OWNER) */}
        {(activeTab === "codigos" || activeTab === "todo") && (
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
                  <option value="all">Todas las Plataformas (Búsqueda Global)</option>
                  <option value="netflix">Netflix</option>
                  <option value="disney">Disney+</option>
                  <option value="max">Max (HBO)</option>
                  <option value="prime">Prime Video</option>
                  <option value="spotify">Spotify</option>
                  <option value="crunchyroll">Crunchyroll</option>
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
        )}

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
                      const plat = catalogPlatforms.find((p) => p.name === e.target.value);
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
                    {catalogPlatforms.map((p) => (
                      <option key={p.id || p.name} value={p.name}>{p.name}</option>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">País / Región</label>
                    <input
                      type="text"
                      placeholder="ej: Colombia, México, Global"
                      value={formData.country || ""}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">¿Está Verificada? (Sirve)</label>
                    <select
                      value={formData.isVerified !== false ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, isVerified: e.target.value === "true" })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="true">✅ Sí (Funciona / Comprobada)</option>
                      <option value="false">⚠️ No (Caída / Falla)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Cliente / Vendido a (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: Juan Pérez (WhatsApp)"
                      value={formData.customerName || ""}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Vendedor Asignado</label>
                    <select
                      value={formData.seller}
                      onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Sin Asignar (En Stock)">Sin Asignar (En Stock)</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Notas / Observaciones</label>
                    <input
                      type="text"
                      placeholder="ej: Cuenta familiar, renovar el día 30"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
            <div className="bg-[#121826] border border-gray-700 w-full max-w-4xl rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Importar Lista de Cuentas desde Excel o CSV</h3>
                  <p className="text-xs text-gray-400">
                    Sube cuentas masivas con país, verificación, fecha de vencimiento y asignación opcional
                  </p>
                </div>
              </div>

              {/* Selector de Plataforma Destino */}
              <div className="mb-4 p-4 rounded-xl bg-[#0b0f19] border border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-semibold text-white block mb-0.5">¿Para qué plataforma es esta lista?</span>
                  <span className="text-[11px] text-gray-400">
                    Puedes forzar que todas las cuentas sean de una plataforma específica o dejar que se lea de la columna del Excel.
                  </span>
                </div>
                <div className="shrink-0">
                  <select
                    value={selectedImportPlatform}
                    onChange={(e) => setSelectedImportPlatform(e.target.value)}
                    className="w-full sm:w-auto bg-[#131b2e] border border-indigo-500/50 rounded-xl px-3 py-2 text-xs text-indigo-300 font-semibold focus:outline-none focus:border-indigo-400 shadow-sm"
                  >
                    <option value="auto">⚡ Detectar automáticamente (Columna "Plataforma")</option>
                    {catalogPlatforms.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lotes subidos en las últimas 24 horas (Revertir / Borrar) */}
              {(() => {
                const now = Date.now();
                const validBatches = recentBatches.filter(
                  (b) => now - new Date(b.importedAt).getTime() < 24 * 60 * 60 * 1000
                );
                if (validBatches.length === 0) return null;
                return (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Listas subidas hace menos de 24 horas (Puedes revertir / borrar)</span>
                      </div>
                      <span className="text-[10px] text-amber-300/80 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                        Ventana activa de 24h
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2.5">
                      ¿La lista era para otra plataforma o se subió por equivocación? Puedes borrar el lote completo y se eliminarán todas las cuentas que se importaron en esa carga:
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {validBatches.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-[#0d121f] border border-gray-800 text-xs gap-2"
                        >
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[11px] border border-indigo-500/30">
                                {b.platform}
                              </span>
                              <span>{b.count} cuentas importadas</span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                              <span>📄 {b.filename || "Lista"}</span>
                              <span>•</span>
                              <span>Subida {getTimeAgo(b.importedAt)} ({new Date(b.importedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(b.id, b.platform, b.count)}
                            className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 self-end sm:self-center shadow-sm"
                            title="Borra todas las cuentas de este lote si se subió a la plataforma equivocada"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Borrar Lote Completo ({b.count})</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Botón Descargar Plantilla Oficial */}
              <div className="mb-4 p-3.5 rounded-xl bg-[#0b0f19] border border-gray-800 flex items-center justify-between">
                <div className="text-xs text-gray-300">
                  <span className="font-semibold text-white block">Formato Oficial de Excel para Cuentas</span>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Incluye columnas: <span className="text-emerald-400 font-mono">País, Plataforma, Correo, Clave, Verificada (Sí/No), Fecha Vencimiento, Vendido a / Asignado a, Perfiles, Notas</span>.
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ml-3 shadow-sm"
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
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* Vista Previa de Filas Parseadas */}
              {excelPreviewData.length > 0 && !importSuccessMessage && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                    <span className="flex items-center gap-2">
                      <span>Vista Previa del Archivo ({excelPreviewData.length} cuentas detectadas)</span>
                      {selectedImportPlatform !== "auto" && (
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 text-[10px]">
                          Asignando a: {selectedImportPlatform}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium">✓ Archivo listo para procesar</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-gray-800 rounded-xl bg-[#0b0f19]">
                    <table className="w-full text-left text-[11px] text-gray-300">
                      <thead className="bg-[#070a12] text-gray-400 sticky top-0 border-b border-gray-800">
                        <tr>
                          <th className="py-2.5 px-3">País</th>
                          <th className="py-2.5 px-3">Plataforma</th>
                          <th className="py-2.5 px-3">Correo</th>
                          <th className="py-2.5 px-3">Clave</th>
                          <th className="py-2.5 px-3 text-center">Verificada</th>
                          <th className="py-2.5 px-3">Vencimiento</th>
                          <th className="py-2.5 px-3">Vendido a / Asignado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {excelPreviewData.slice(0, 20).map((row: any, i) => {
                          const rawVer = String(row["Verificada (Sí/No)"] || row["Verificada"] || row["Verificado"] || row["Sirve"] || "Sí").toLowerCase();
                          const isVer = !(rawVer.includes("no") || rawVer === "0" || rawVer === "false" || rawVer.includes("falla") || rawVer.includes("caida"));
                          const platDisplay = selectedImportPlatform !== "auto" 
                            ? selectedImportPlatform 
                            : (row["Plataforma"] || row["Servicio"] || "Netflix");
                          const assignedCol = row["Vendido a / Asignado a"] || row["Vendido a"] || row["Cliente"] || row["Vendedor"] || "Sin Asignar";

                          return (
                            <tr key={i} className="hover:bg-gray-800/30">
                              <td className="py-2 px-3 font-semibold text-cyan-300">
                                🌍 {row["País"] || row["Pais"] || row["Country"] || "Global"}
                              </td>
                              <td className="py-2 px-3 font-semibold text-white">
                                {platDisplay}
                              </td>
                              <td className="py-2 px-3 font-mono text-indigo-300">
                                {row["Correo"] || row["Email"] || "-"}
                              </td>
                              <td className="py-2 px-3 font-mono text-gray-400">
                                {row["Clave"] || row["Contraseña"] || "••••••••"}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isVer ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                                    ✓ Sirve
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded font-semibold">
                                    ✗ Falla
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-gray-400 font-mono">
                                {String(row["Fecha Vencimiento"] || row["Vencimiento"] || "").substring(0, 10) || "30 días"}
                              </td>
                              <td className="py-2 px-3 text-amber-300 font-medium">
                                {assignedCol}
                              </td>
                            </tr>
                          );
                        })}
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

        {/* MODAL CREAR / EDITAR PLATAFORMA EN CATÁLOGO */}
        {isCatalogModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingPlatformId ? "Editar Servicio en Catálogo" : "Nuevo Servicio de Streaming"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Configura el nombre, precio al público, costo base y cupos para este servicio
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePlatform} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Nombre de la Plataforma / Plan</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Disney+ & Star+ Combo"
                    value={platformForm.name}
                    onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-emerald-400 mb-1">Precio al Detal / Público ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={platformForm.retailPrice ?? platformForm.price ?? 3.5}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPlatformForm({
                          ...platformForm,
                          retailPrice: val,
                          price: val,
                          defaultIncome: val * (platformForm.defaultProfiles || 4)
                        });
                      }}
                      className="w-full bg-[#0b0f19] border border-emerald-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-purple-400 mb-1">Precio al Mayor / Revendedor ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej: 2.5"
                      value={platformForm.wholesalePrice ?? ""}
                      onChange={(e) => setPlatformForm({ ...platformForm, wholesalePrice: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-[#0b0f19] border border-purple-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Costo Base Invertido ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={platformForm.defaultCost}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultCost: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Cupos / Perfiles por Defecto</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      required
                      value={platformForm.defaultProfiles}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultProfiles: Number(e.target.value) })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Etiqueta Destacada (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: Más Vendido, 4K UHD"
                      value={platformForm.badge || ""}
                      onChange={(e) => setPlatformForm({ ...platformForm, badge: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Categoría / Subtítulo</label>
                    <input
                      type="text"
                      placeholder="ej: 4K HDR • 1 Pantalla Individual"
                      value={platformForm.category || ""}
                      onChange={(e) => setPlatformForm({ ...platformForm, category: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCatalogModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold shadow-lg shadow-amber-950/40"
                  >
                    {editingPlatformId ? "Guardar Cambios" : "Guardar en Catálogo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL REGISTRAR NUEVA VENTA (DETAL / MAYOR / EN PERSONA) */}
        {isSaleModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#121826] border border-emerald-500/40 w-full max-w-xl rounded-2xl p-5 sm:p-6 shadow-2xl relative my-8 animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800/80 flex items-center justify-center transition"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Registrar Venta en el Libro
                  </h3>
                  <p className="text-xs text-gray-400">
                    Venta al detal, venta al mayor o cobro en persona con ganancia personalizada
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSale} className="space-y-4 text-xs">
                {/* Selector Tipo de Venta: Detal vs Mayor */}
                <div>
                  <label className="block font-bold text-gray-300 uppercase tracking-wider text-[11px] mb-1.5">
                    Modalidad de Venta
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const plat = catalogPlatforms.find(p => p.name === saleForm.platform);
                        const newSalePrice = plat?.retailPrice || plat?.price || 3.5;
                        const newCost = Number(saleForm.costPrice) || 2.0;
                        setSaleForm({
                          ...saleForm,
                          type: "detal",
                          salePrice: newSalePrice,
                          profit: Math.max(0, newSalePrice - newCost)
                        });
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        saleForm.type === "detal"
                          ? "bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/50"
                          : "bg-[#0b0f19] border-gray-800 text-gray-400 hover:border-gray-700"
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs">Venta al Detal</span>
                      <span className="text-[10px] text-gray-400">Cliente final / 1 perfil / en mano</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const plat = catalogPlatforms.find(p => p.name === saleForm.platform);
                        const newSalePrice = plat?.wholesalePrice || ((plat?.price || 3.5) * 0.8);
                        const newCost = Number(saleForm.costPrice) || 2.0;
                        setSaleForm({
                          ...saleForm,
                          type: "mayor",
                          salePrice: newSalePrice,
                          profit: Math.max(0, newSalePrice - newCost)
                        });
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        saleForm.type === "mayor"
                          ? "bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/50"
                          : "bg-[#0b0f19] border-gray-800 text-gray-400 hover:border-gray-700"
                      }`}
                    >
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-xs">Venta al Mayor</span>
                      <span className="text-[10px] text-gray-400">Revendedor / Lote / Descuento</span>
                    </button>
                  </div>
                </div>

                {/* Venta en persona (física) checkbox pill */}
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">¿Venta realizada en persona física?</div>
                      <div className="text-[11px] text-gray-400">Se computará en la caja física de efectivo</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saleForm.isPhysicalSale}
                      onChange={(e) => setSaleForm({
                        ...saleForm,
                        isPhysicalSale: e.target.checked,
                        paymentMethod: e.target.checked ? "efectivo" : saleForm.paymentMethod
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Plataforma & Cuenta Asociada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Plataforma</label>
                    <select
                      value={saleForm.platform}
                      onChange={(e) => {
                        const platName = e.target.value;
                        const plat = catalogPlatforms.find(p => p.name === platName);
                        const defCost = plat?.defaultCost || 2.0;
                        const defPrice = saleForm.type === "mayor"
                          ? (plat?.wholesalePrice || 2.5)
                          : (plat?.retailPrice || plat?.price || 3.5);
                        setSaleForm({
                          ...saleForm,
                          platform: platName,
                          costPrice: defCost,
                          salePrice: defPrice,
                          profit: Math.max(0, defPrice - defCost)
                        });
                      }}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {catalogPlatforms.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Vincular Cuenta de Stock</label>
                    <select
                      value={saleForm.selectedAccountId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "manual") {
                          setSaleForm({ ...saleForm, selectedAccountId: "manual" });
                        } else {
                          const acc = accounts.find(a => a.id === val);
                          if (acc) {
                            const plat = catalogPlatforms.find(p => p.name === acc.platform);
                            const cost = acc.monthlyCost || plat?.defaultCost || 2.0;
                            const price = saleForm.type === "mayor"
                              ? (plat?.wholesalePrice || 2.5)
                              : (plat?.retailPrice || plat?.price || 3.5);
                            setSaleForm({
                              ...saleForm,
                              selectedAccountId: acc.id,
                              accountEmail: acc.email,
                              platform: acc.platform,
                              costPrice: cost,
                              salePrice: price,
                              profit: Math.max(0, price - cost),
                              customerName: acc.customerName || saleForm.customerName
                            });
                          }
                        }
                      }}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                    >
                      <option value="manual">Cuenta Externa / Manual</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.platform} - {a.email} ({a.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Correo si es manual */}
                {saleForm.selectedAccountId === "manual" && (
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Correo o Identificador de Cuenta (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: cliente.netflix@gmail.com"
                      value={saleForm.accountEmail}
                      onChange={(e) => setSaleForm({ ...saleForm, accountEmail: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}

                {/* Cliente & Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Nombre del Cliente / Comprador *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej: Juan Pérez (En persona)"
                      value={saleForm.customerName}
                      onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-300 mb-1">WhatsApp / Contacto (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: +57 300 123 4567"
                      value={saleForm.customerContact}
                      onChange={(e) => setSaleForm({ ...saleForm, customerContact: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Método de Pago</label>
                  <select
                    value={saleForm.paymentMethod}
                    onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="efectivo">💵 Efectivo (Dinero en Mano)</option>
                    <option value="nequi">📲 Nequi</option>
                    <option value="daviplata">📱 Daviplata</option>
                    <option value="transferencia">🏦 Transferencia Bancaria</option>
                    <option value="binance">🪙 Binance / Cripto (USDT)</option>
                    <option value="otro">💳 Otro Método</option>
                  </select>
                </div>

                {/* CÁLCULO FINANCIERO Y GANANCIA PERSONALIZADA */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#0b0f19] to-[#070a12] border border-emerald-500/30">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Finanzas de la Venta (Ganancia en Tiempo Real)</span>
                    <span className="text-gray-400 text-[10px] lowercase">editable libremente</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1 font-medium">Costo Invertido ($)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={saleForm.costPrice}
                        onChange={(e) => {
                          const cost = Number(e.target.value) || 0;
                          const sale = Number(saleForm.salePrice) || 0;
                          setSaleForm({
                            ...saleForm,
                            costPrice: cost,
                            profit: Math.max(0, sale - cost)
                          });
                        }}
                        className="w-full bg-[#121826] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1 font-medium">Precio Cobrado ($)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={saleForm.salePrice}
                        onChange={(e) => {
                          const sale = Number(e.target.value) || 0;
                          const cost = Number(saleForm.costPrice) || 0;
                          setSaleForm({
                            ...saleForm,
                            salePrice: sale,
                            profit: Math.max(0, sale - cost)
                          });
                        }}
                        className="w-full bg-[#121826] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-emerald-400 mb-1 font-bold">Ganancia Neta ($)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={saleForm.profit}
                        onChange={(e) => setSaleForm({ ...saleForm, profit: Number(e.target.value) || 0 })}
                        className="w-full bg-emerald-950/50 border border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-black focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    💡 La ganancia se calcula como (Precio Cobrado - Costo), pero puedes modificarla directamente si cobraste un recargo o ajuste.
                  </p>
                </div>

                {/* Notas */}
                <div>
                  <label className="block font-medium text-gray-300 mb-1">Notas / Detalles del Pedido (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: Perfil 3, PIN 1234, entregado personalmente en oficina"
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSaleModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar y Sumar Ganancia</span>
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
