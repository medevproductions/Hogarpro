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
  ChevronLeft,
  Bell,
  Pin,
  CalendarDays,
  CheckCircle2,
  CheckCircle,
  User,
  Briefcase,
  Phone,
  Bookmark,
  FileText,
  Info,
  ArrowLeftRight,
  ArrowLeft
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import LatamPhoneInput from "@/components/LatamPhoneInput";
import HogarProEmailInput from "@/components/HogarProEmailInput";
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
  getStoredExpenses,
  saveStoredExpenses,
  getStoredReminders,
  saveStoredReminders,
  addCalendarReminder,
  deleteCalendarReminder,
  toggleCalendarReminder,
  syncAccountsFromCloud,
  syncUsersFromCloud,
  CalendarReminder,
  SaleRecord,
  ExpenseRecord,
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
  status: "assigned" | "available" | "expiring" | "expired";
  monthlyCost: number;
  monthlyIncome: number;
  notes?: string;
  country?: string; // ej: Colombia, México, Global
  isVerified?: boolean | "verified" | "payment_failed" | "unreviewed"; // estado de verificación (verde=verificada, roja=caída por pago, amarilla=sin revisar)
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

// Helper para normalizar el estado de verificación de las cuentas
function getVerificationStatus(val: any): "verified" | "payment_failed" | "unreviewed" {
  if (val === "verified" || val === "funciona" || val === "comprobada" || val === true) {
    return "verified";
  }
  if (val === "payment_failed" || val === "caida_pago" || val === "caida" || val === false) {
    return "payment_failed";
  }
  if (val === "unreviewed" || val === "sin_revisar") {
    return "unreviewed";
  }
  if (val === undefined || val === null) {
    return "unreviewed";
  }
  return "verified";
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
  const [activeTab, setActiveTab] = useState<"resumen" | "ventas" | "cuentas" | "vendedores" | "calendario" | "catalogo" | "codigos" | "todo">("resumen");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // SELECCIÓN DE VENDEDOR PARA VER CUENTAS ASIGNADAS
  const [selectedSellerForAccounts, setSelectedSellerForAccounts] = useState<string | null>(null);
  const [sellerAccountSearch, setSellerAccountSearch] = useState<string>("");

  // CALENDARIO DE VENCIMIENTOS Y RECORDATORIOS (EXCLUSIVO OWNER)
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminder[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderCategory, setNewReminderCategory] = useState<"renovacion" | "cobro" | "proveedor" | "general">("renovacion");
  const [newReminderPriority, setNewReminderPriority] = useState<"urgente" | "normal" | "alta">("normal");
  const [reminderFilter, setReminderFilter] = useState<"all" | "pending" | "completed">("all");
  const [calendarViewTab, setCalendarViewTab] = useState<"cuentas" | "recordatorios" | "proximos">("cuentas");

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
  // SUB-PESTAÑA DE FINANZAS ("ventas" | "gastos" | "grafica")
  const [financeSubTab, setFinanceSubTab] = useState<"ventas" | "gastos" | "grafica">("ventas");

  // SECCIÓN DE GASTOS
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>("all");
  const [expenseFilterPayment, setExpenseFilterPayment] = useState<string>("all");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseSuccessMessage, setExpenseSuccessMessage] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<{
    id: string;
    date: string;
    title: string;
    category: "proveedor" | "publicidad" | "servicios" | "comision" | "operativo" | "otro";
    amount: number;
    paymentMethod: "efectivo" | "nequi" | "daviplata" | "transferencia" | "binance" | "otro";
    supplier: string;
    notes: string;
  }>({
    id: "",
    date: new Date().toISOString().split("T")[0],
    title: "",
    category: "proveedor",
    amount: 0,
    paymentMethod: "efectivo",
    supplier: "",
    notes: ""
  });

  // GRÁFICA FINANCIERA (CONSULTA MENSUAL Y ANUAL)
  const [chartPeriod, setChartPeriod] = useState<"mensual" | "anual">("mensual");
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState<number>(new Date().getMonth());
  const [chartHoveredIndex, setChartHoveredIndex] = useState<number | null>(null);

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

    // Cargar Libro de Gastos
    const rawExpenses = getStoredExpenses();
    setExpenses(rawExpenses);

    // Cargar Recordatorios del Calendario
    const rawReminders = getStoredReminders();
    setCalendarReminders(rawReminders);

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
      let calculatedStatus: "assigned" | "available" | "expiring" | "expired" = a.sellerId ? "assigned" : "available";
      if (a.expirationDate) {
        const exp = new Date(a.expirationDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 0) {
          calculatedStatus = "expired";
        } else if (diffDays <= 5) {
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
        isVerified: a.isVerified !== undefined ? a.isVerified : "verified",
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
    if (!user || (user.role !== "owner" && (user.role as string) !== "admin")) {
      router.push("/admin?error=unauthorized");
      return;
    }

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam && ["resumen", "ventas", "cuentas", "vendedores", "calendario", "catalogo", "codigos", "todo"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }

    reloadData();

    // Sincronizar inmediatamente desde Cloud Firestore para asegurar que cualquier dispositivo tenga todas las cuentas
    syncAccountsFromCloud(true).then(() => reloadData()).catch(console.warn);
    syncUsersFromCloud(true).then(() => reloadData()).catch(console.warn);

    // Escuchar cambios entre pestañas o eventos locales
    const handleStorageChange = () => reloadData();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("streamhub_accounts_updated", handleStorageChange);
    window.addEventListener("streamhub_users_updated", handleStorageChange);
    window.addEventListener("streamhub_reminders_updated", handleStorageChange);
    window.addEventListener("streamhub_sales_updated", handleStorageChange);
    window.addEventListener("streamhub_expenses_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("streamhub_accounts_updated", handleStorageChange);
      window.removeEventListener("streamhub_users_updated", handleStorageChange);
      window.removeEventListener("streamhub_reminders_updated", handleStorageChange);
      window.removeEventListener("streamhub_sales_updated", handleStorageChange);
      window.removeEventListener("streamhub_expenses_updated", handleStorageChange);
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

  // Alternar rápidamente el estado de verificación de una cuenta (Verificada -> Caída por pago -> Sin revisar)
  const handleToggleVerification = (acc: StreamingAccount) => {
    const current = getVerificationStatus(acc.isVerified);
    let next: "verified" | "payment_failed" | "unreviewed" = "verified";
    if (current === "verified") {
      next = "payment_failed";
    } else if (current === "payment_failed") {
      next = "unreviewed";
    } else {
      next = "verified";
    }

    const updated = accounts.map(a => a.id === acc.id ? { ...a, isVerified: next } : a);
    persistAccounts(updated);
  };

  // Estado del Formulario de Cuenta
  const [formData, setFormData] = useState<{
    platform: string;
    email: string;
    password: string;
    maxProfiles: number;
    profilesOccupied: number;
    seller: string;
    purchaseDate: string;
    expirationDate: string;
    monthlyCost: number;
    monthlyIncome: number;
    notes: string;
    country: string;
    isVerified: "verified" | "payment_failed" | "unreviewed";
    customerName: string;
  }>({
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
    isVerified: "verified",
    customerName: ""
  });

  // FILTRADO DINÁMICO DE CUENTAS (Búsqueda + Estado + Ordenamiento por Vencimiento)
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          !q ||
          acc.email.toLowerCase().includes(q) ||
          acc.platform.toLowerCase().includes(q) ||
          acc.seller.toLowerCase().includes(q) ||
          (acc.country && acc.country.toLowerCase().includes(q)) ||
          (acc.notes && acc.notes.toLowerCase().includes(q));

        // Coincidencia inteligente de estado
        let matchStatus = true;
        if (statusFilter !== "all") {
          if (statusFilter === "assigned") {
            matchStatus = Boolean(acc.sellerId || (acc.seller && !acc.seller.includes("Sin Asignar")));
          } else if (statusFilter === "available") {
            matchStatus = !acc.sellerId && (!acc.seller || acc.seller.includes("Sin Asignar"));
          } else if (statusFilter === "expiring") {
            matchStatus = acc.status === "expiring" || acc.status === "expired";
          } else if (statusFilter === "verified") {
            matchStatus = getVerificationStatus(acc.isVerified) === "verified";
          } else if (statusFilter === "payment_failed") {
            matchStatus = getVerificationStatus(acc.isVerified) === "payment_failed";
          } else if (statusFilter === "unreviewed") {
            matchStatus = getVerificationStatus(acc.isVerified) === "unreviewed";
          }
        }

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        // Cuentas por vencer (o ya vencidas) más arriba
        const parseTime = (dateStr?: string) => {
          if (!dateStr) return Number.MAX_SAFE_INTEGER;
          const t = new Date(dateStr).getTime();
          return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
        };
        return parseTime(a.expirationDate) - parseTime(b.expirationDate);
      });
  }, [accounts, searchQuery, statusFilter]);

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

  // FILTRADO DINÁMICO DE GASTOS
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = expenseFilterCategory === "all" || e.category === expenseFilterCategory;
      const matchPayment = expenseFilterPayment === "all" || e.paymentMethod === expenseFilterPayment;
      const q = expenseSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.supplier && e.supplier.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q));

      return matchCat && matchPayment && matchSearch;
    });
  }, [expenses, expenseFilterCategory, expenseFilterPayment, expenseSearchQuery]);

  // CÁLCULO DE MÉTRICAS CONSOLIDADAS (VENTAS + GASTOS)
  const financeConsolidatedStats = useMemo(() => {
    const totalCollected = sales.reduce((acc, s) => acc + Number(s.salePrice || 0), 0);
    const totalAccountCosts = sales.reduce((acc, s) => acc + Number(s.costPrice || 0), 0);
    const totalOpExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const grandTotalExpenses = totalAccountCosts + totalOpExpenses;
    const realNetProfit = totalCollected - grandTotalExpenses;
    const realMargin = totalCollected > 0 ? ((realNetProfit / totalCollected) * 100).toFixed(1) : "0";

    return {
      totalCollected,
      totalAccountCosts,
      totalOpExpenses,
      grandTotalExpenses,
      realNetProfit,
      realMargin,
      totalSalesCount: sales.length,
      totalExpensesCount: expenses.length
    };
  }, [sales, expenses]);

  // DATOS PARA LA GRÁFICA FINANCIERA (MENSUAL / ANUAL)
  const chartData = useMemo(() => {
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    if (chartPeriod === "anual") {
      const shortMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

      const items = shortMonths.map((name, idx) => {
        const monthSales = sales.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === chartYear && d.getMonth() === idx;
        });
        const income = monthSales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0);
        const accountCost = monthSales.reduce((sum, s) => sum + Number(s.costPrice || 0), 0);

        const monthExpenses = expenses.filter((e) => {
          const d = new Date(e.date);
          return d.getFullYear() === chartYear && d.getMonth() === idx;
        });
        const opExpense = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const totalExpense = accountCost + opExpense;
        const profit = income - totalExpense;

        return {
          label: name,
          fullName: `${monthNames[idx]} ${chartYear}`,
          income,
          accountCost,
          opExpense,
          totalExpense,
          profit,
          salesCount: monthSales.length,
          expensesCount: monthExpenses.length
        };
      });

      const maxVal = Math.max(...items.map((i) => Math.max(i.income, i.totalExpense)), 10);
      const totalYearIncome = items.reduce((s, i) => s + i.income, 0);
      const totalYearExpense = items.reduce((s, i) => s + i.totalExpense, 0);
      const totalYearProfit = totalYearIncome - totalYearExpense;

      return {
        type: "anual" as const,
        year: chartYear,
        items,
        maxVal,
        totalIncome: totalYearIncome,
        totalExpense: totalYearExpense,
        totalProfit: totalYearProfit
      };
    } else {
      const weeks = [
        { label: "Sem 1", daysLabel: "Días 1 - 7", start: 1, end: 7 },
        { label: "Sem 2", daysLabel: "Días 8 - 14", start: 8, end: 14 },
        { label: "Sem 3", daysLabel: "Días 15 - 21", start: 15, end: 21 },
        { label: "Sem 4", daysLabel: "Días 22 - 28", start: 22, end: 28 },
        { label: "Sem 5", daysLabel: "Días 29+", start: 29, end: 31 }
      ];

      const items = weeks.map((w) => {
        const weekSales = sales.filter((s) => {
          const d = new Date(s.date);
          const day = d.getDate();
          return d.getFullYear() === chartYear && d.getMonth() === chartMonth && day >= w.start && day <= w.end;
        });
        const income = weekSales.reduce((sum, s) => sum + Number(s.salePrice || 0), 0);
        const accountCost = weekSales.reduce((sum, s) => sum + Number(s.costPrice || 0), 0);

        const weekExpenses = expenses.filter((e) => {
          const d = new Date(e.date);
          const day = d.getDate();
          return d.getFullYear() === chartYear && d.getMonth() === chartMonth && day >= w.start && day <= w.end;
        });
        const opExpense = weekExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const totalExpense = accountCost + opExpense;
        const profit = income - totalExpense;

        return {
          label: w.label,
          daysLabel: w.daysLabel,
          fullName: `${w.label} (${w.daysLabel})`,
          income,
          accountCost,
          opExpense,
          totalExpense,
          profit,
          salesCount: weekSales.length,
          expensesCount: weekExpenses.length
        };
      });

      const maxVal = Math.max(...items.map((i) => Math.max(i.income, i.totalExpense)), 10);
      const totalMonthIncome = items.reduce((s, i) => s + i.income, 0);
      const totalMonthExpense = items.reduce((s, i) => s + i.totalExpense, 0);
      const totalMonthProfit = totalMonthIncome - totalMonthExpense;

      return {
        type: "mensual" as const,
        year: chartYear,
        month: chartMonth,
        monthName: monthNames[chartMonth],
        items,
        maxVal,
        totalIncome: totalMonthIncome,
        totalExpense: totalMonthExpense,
        totalProfit: totalMonthProfit
      };
    }
  }, [sales, expenses, chartPeriod, chartYear, chartMonth]);

  // CÁLCULO DE CUENTAS POR VENCER (PRÓXIMOS 7 DÍAS)
  const expiringSoonAccounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return accounts.filter((a) => {
      if (!a.expirationDate) return false;
      const exp = new Date(a.expirationDate);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
  }, [accounts]);

  // CÁLCULO DE CUENTAS YA VENCIDAS
  const expiredAccounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return accounts.filter((a) => {
      if (!a.expirationDate) return false;
      const exp = new Date(a.expirationDate);
      exp.setHours(0, 0, 0, 0);
      return exp < today;
    });
  }, [accounts]);

  // CÁLCULO DE DÍAS Y DATOS DEL MES PARA EL CALENDARIO
  const calendarMonthData = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth(); // 0 a 11
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    const startOffset = (firstDay + 6) % 7; // Lunes = 0, Domingo = 6
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dayNumber: number; dateStr: string } | null> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ dayNumber: d, dateStr });
    }
    return { year, month, cells };
  }, [currentCalendarDate]);

  // Nombres de los meses en español
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // NAVEGACIÓN DEL CALENDARIO
  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
  };

  const handleTodayCalendar = () => {
    const now = new Date();
    setCurrentCalendarDate(now);
    setSelectedCalendarDate(now.toISOString().split("T")[0]);
  };

  // AGREGAR RECORDATORIO
  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    addCalendarReminder({
      title: newReminderTitle.trim(),
      date: selectedCalendarDate,
      category: newReminderCategory,
      priority: newReminderPriority,
      completed: false
    });
    setNewReminderTitle("");
    reloadData();
  };

  // TOGGLE RECORDATORIO COMPLETADO
  const handleToggleReminder = (id: string) => {
    toggleCalendarReminder(id);
    reloadData();
  };

  // ELIMINAR RECORDATORIO
  const handleDeleteReminder = (id: string) => {
    deleteCalendarReminder(id);
    reloadData();
  };

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
            seller: saleForm.customerName.trim(),
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
    XLSX.writeFile(wb, `Libro_Ventas_HogarPro_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ABRIR MODAL PARA REGISTRAR GASTO
  const handleOpenCreateExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      title: "",
      category: "proveedor",
      amount: 0,
      paymentMethod: "efectivo",
      supplier: "",
      notes: ""
    });
    setIsExpenseModalOpen(true);
  };

  // ABRIR MODAL PARA EDITAR GASTO
  const handleOpenEditExpense = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      id: expense.id,
      date: expense.date.split("T")[0],
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
      supplier: expense.supplier || "",
      notes: expense.notes || ""
    });
    setIsExpenseModalOpen(true);
  };

  // GUARDAR GASTO
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || Number(expenseForm.amount) <= 0) {
      alert("Por favor indica el concepto del gasto y un monto mayor a cero.");
      return;
    }

    const newExpenseRecord: ExpenseRecord = {
      id: editingExpenseId || `exp-${Date.now()}`,
      date: expenseForm.date || new Date().toISOString().split("T")[0],
      title: expenseForm.title.trim(),
      category: expenseForm.category,
      amount: Number(expenseForm.amount) || 0,
      paymentMethod: expenseForm.paymentMethod,
      supplier: expenseForm.supplier.trim() || undefined,
      notes: expenseForm.notes.trim() || undefined
    };

    let updated: ExpenseRecord[];
    if (editingExpenseId) {
      updated = expenses.map((item) => (item.id === editingExpenseId ? newExpenseRecord : item));
    } else {
      updated = [newExpenseRecord, ...expenses];
    }

    setExpenses(updated);
    saveStoredExpenses(updated);
    setIsExpenseModalOpen(false);
    setExpenseSuccessMessage(
      editingExpenseId ? "Gasto actualizado con éxito" : `¡Gasto registrado con éxito! Monto: ${formatCurrency(newExpenseRecord.amount)}`
    );
    setTimeout(() => setExpenseSuccessMessage(null), 3000);
  };

  // ELIMINAR GASTO
  const handleDeleteExpense = (expenseId: string) => {
    if (confirm("¿Estás seguro de eliminar este registro de gasto?")) {
      const updated = expenses.filter((e) => e.id !== expenseId);
      setExpenses(updated);
      saveStoredExpenses(updated);
    }
  };

  // EXPORTAR GASTOS A EXCEL
  const handleExportExpensesExcel = () => {
    if (filteredExpenses.length === 0) {
      alert("No hay registros de gastos para exportar con los filtros actuales.");
      return;
    }

    const exportData = filteredExpenses.map((e) => ({
      "Fecha": e.date.split("T")[0],
      "Concepto": e.title,
      "Categoría": e.category.toUpperCase(),
      "Proveedor / Beneficiario": e.supplier || "No especificado",
      "Monto ($)": e.amount,
      "Método de Pago": e.paymentMethod.toUpperCase(),
      "Notas": e.notes || ""
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Libro de Gastos");
    XLSX.writeFile(wb, `Libro_Gastos_HogarPro_${new Date().toISOString().split("T")[0]}.xlsx`);
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
      isVerified: "verified",
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
      isVerified: getVerificationStatus(acc.isVerified),
      customerName: acc.customerName || ""
    });
    setIsAccountModalOpen(true);
  };

  // GUARDAR CUENTA (CREAR O EDITAR)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (formData.email || "").trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      alert("Por favor ingresa un correo válido para la cuenta (puede contener alias con '+').");
      return;
    }

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
              email: cleanEmail,
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
        email: cleanEmail,
        sellerId: matchedSeller ? matchedSeller.id : undefined,
        platformColor: platObj.color,
        status: (isAssigned ? "assigned" : "available") as any
      };
      persistAccounts([newAcc, ...accounts]);
    }
    setActiveTab("cuentas");
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

        // Verificada: 3 estados (funciona/comprobada=verified, caida por pago=payment_failed, sin revisar=unreviewed)
        const rawVerified = String(row["Verificada (Sí/No)"] || row["Verificada"] || row["Verificado"] || row["Sirve"] || row["Estado de Verificación"] || "Sí").toLowerCase().trim();
        let isVerified: "verified" | "payment_failed" | "unreviewed" = "verified";
        if (rawVerified.includes("caida") || rawVerified.includes("pago") || rawVerified.includes("no") || rawVerified === "false" || rawVerified === "0" || rawVerified.includes("falla")) {
          isVerified = "payment_failed";
        } else if (rawVerified.includes("sin") || rawVerified.includes("revisar") || rawVerified.includes("pendiente") || rawVerified.includes("amarill")) {
          isVerified = "unreviewed";
        } else {
          isVerified = "verified";
        }

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
        setActiveTab("cuentas");
        setTimeout(() => {
          setIsExcelModalOpen(false);
          setExcelFile(null);
          setExcelPreviewData([]);
          setImportSuccessMessage(null);
        }, 2000);
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
        "Plataforma": "Netflix Premium 4K",
        "Correo": "ejemplo.netflix2@hogarpro.com",
        "Clave": "NetflixPass2026#",
        "Verificada (Sí/No)": "Sí",
        "Fecha Vencimiento": "2026-11-20",
        "Vendido a / Asignado a": "Cliente Juan Pérez",
        "Perfiles": 5,
        "Notas": "Garantía de 30 días"
      },
      {
        "País": "Global",
        "Plataforma": "Netflix Premium 4K",
        "Correo": "ejemplo.netflix3@hogarpro.com",
        "Clave": "NetflixPass778!",
        "Verificada (Sí/No)": "Sí",
        "Fecha Vencimiento": "2026-12-01",
        "Vendido a / Asignado a": "",
        "Perfiles": 5,
        "Notas": "En Stock disponible"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuentas_Plantilla");
    XLSX.writeFile(wb, "Plantilla_Cuentas_Streaming_HogarPro.xlsx");
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

    // Asegurar siempre dominio @hogarpro.com
    const cleanPrefix = newSellerEmail.trim().toLowerCase();
    const finalEmail = cleanPrefix.includes("@") 
      ? (cleanPrefix.endsWith("@hogarpro.com") ? cleanPrefix : `${cleanPrefix.split("@")[0]}@hogarpro.com`)
      : `${cleanPrefix}@hogarpro.com`;

    if (editingSellerId) {
      // Editar vendedor existente
      const updatedUser: SystemUser = {
        id: editingSellerId,
        name: newSellerName.trim(),
        email: finalEmail,
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
        email: finalEmail,
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

    try {
      const res = await fetch(`/api/codes/check?email=${encodeURIComponent(testEmail.trim())}&service=${encodeURIComponent(testService)}&actionType=${encodeURIComponent(testAction)}&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success && data.code) {
        setTestResult(data.code);
      } else {
        setTestResult(data?.message || data?.error || "No se encontró código reciente para este correo.");
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
    <div className="min-h-screen bg-[#141414] text-white flex flex-col md:flex-row w-full max-w-full overflow-x-hidden selection:bg-[#E50914] selection:text-white">
      {/* MOBILE STICKY HEADER & HUD BAR */}
      <div className="md:hidden sticky top-0 z-40 bg-[#141414]/95 backdrop-blur-md border-b border-[#262626] px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Logo HogarPro a la izquierda */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E50914] to-[#B81D24] flex items-center justify-center font-bold text-white shadow-md shadow-red-600/30 shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm text-white tracking-tight leading-none">
                HOGAR<span className="text-[#E50914]">PRO</span>
              </div>
            </div>
          </div>

          {/* Botón de Venta al lado del menú, y Menú en la esquina superior derecha */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenCreateSale()}
              className="px-3 py-1.5 bg-[#E50914] hover:bg-[#b81d24] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 active:scale-95 transition"
              title="Registrar Venta"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Venta</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-[#222222] text-zinc-300 hover:text-white hover:bg-zinc-800 border border-[#333333] active:scale-95 transition shadow-sm flex items-center justify-center"
              title="Abrir menú de navegación"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* DRAWER MÓVIL DESLIZABLE DESDE LA DERECHA CON DESENFOQUE (BACKDROP BLUR) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Fondo con desenfoque (Backdrop Blur) */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-backdrop-fade transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menú deslizable desde la derecha con animación suave */}
          <div className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-[#111111] border-l border-[#262626] shadow-2xl flex flex-col justify-between p-5 z-10 animate-drawer-right">
            <div>
              {/* Cabecera del Drawer con Logo y botón de cerrar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#222222]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E50914] to-[#B81D24] flex items-center justify-center font-bold text-white shadow-lg shadow-red-600/30">
                    <Tv className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white text-base tracking-tight leading-none">
                      HOGAR<span className="text-[#E50914]">PRO</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-[#222222] text-zinc-400 hover:text-white border border-[#333333] transition"
                  title="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Indicador de secciones */}
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-3 py-1 mb-2">
                MENÚ DE SECCIONES
              </div>

              {/* Lista Vertical de Secciones */}
              <nav className="space-y-1.5 text-xs font-semibold overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
                <button
                  onClick={() => {
                    setActiveTab("resumen");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "resumen" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4" />
                    <span>Resumen & KPIs</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("ventas");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "ventas" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="w-4 h-4" />
                    <span>Libro Contable & Finanzas</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                    {sales.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("cuentas");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "cuentas" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Tv className="w-4 h-4" />
                    <span>Stock de Cuentas</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-zinc-300 border border-zinc-700 font-mono font-bold">
                    {accounts.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("vendedores");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "vendedores" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4" />
                    <span>Vendedores & Revendedores</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-zinc-300 border border-zinc-700 font-mono font-bold">
                    {sellers.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("calendario");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "calendario" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4" />
                    <span>Calendario & Vencimientos</span>
                  </div>
                  {expiringSoonAccounts.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono font-bold animate-pulse">
                      {expiringSoonAccounts.length}
                    </span>
                  )}
                </button>


                <button
                  onClick={() => {
                    setActiveTab("codigos");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "codigos" 
                      ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-4 h-4" />
                    <span>Extractor de Códigos</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("todo");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    activeTab === "todo" 
                      ? "bg-zinc-700 text-white shadow-lg font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4" />
                    <span>Ver Todas las Secciones</span>
                  </div>
                </button>
              </nav>
            </div>

            {/* Accesos Rápidos Inferiores del Drawer */}
            <div className="pt-4 border-t border-[#262626] space-y-1.5 text-xs">
              <Link
                href="/dashboard/seller"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c1c1c] text-[#E50914] font-bold hover:bg-zinc-800 transition"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Cambiar a Vista Vendedor</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>

            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR DASHBOARD */}
      <aside className="w-64 border-r border-[#262626] bg-[#101010] p-5 hidden md:flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E50914] to-[#B81D24] flex items-center justify-center font-bold text-white shadow-lg shadow-red-600/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-white text-base tracking-tight leading-none">
                HOGAR<span className="text-[#E50914]">PRO</span>
              </div>
            </div>
          </div>

          <nav className="space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("resumen")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "resumen" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
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
                activeTab === "ventas" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4" />
                <span>Libro de Ventas (Sheet)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/60 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                {sales.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("cuentas")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "cuentas" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Tv className="w-4 h-4" />
                <span>Stock de Cuentas</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/60 text-zinc-300 font-mono">
                {accounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("vendedores")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "vendedores" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Revendedores</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/60 text-zinc-300 font-mono">
                {sellers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calendario")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "calendario" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4" />
                <span>Calendario & Vencimientos</span>
              </div>
              {expiringSoonAccounts.length > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono font-bold animate-pulse">
                  {expiringSoonAccounts.length} prox
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/60 text-zinc-400 font-mono">
                  {accounts.length}
                </span>
              )}
            </button>


            <button
              onClick={() => setActiveTab("codigos")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                activeTab === "codigos" 
                  ? "bg-[#E50914] text-white shadow-lg shadow-red-950/50 font-bold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
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
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-2 ${
                  activeTab === "todo" ? "bg-zinc-800 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                <span>Ver Todas las Secciones</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="pt-4 border-t border-[#262626] space-y-2 text-xs">
          <Link href="/dashboard/seller" className="flex items-center gap-1.5 text-[#E50914] hover:underline font-semibold">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Cambiar a Vista Vendedor</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 p-3.5 sm:p-6 md:p-8 overflow-y-auto max-w-full overflow-x-hidden">
        {/* HEADER PRINCIPAL CINEMATOGRÁFICO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#262626]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Panel de Administración
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Control centralizado de finanzas, ventas (detal/mayor), stock de cuentas y revendedores
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#181818] border border-[#333333] text-xs text-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#E50914] w-full sm:w-auto"
            >
              <option value="this_month">Este Mes</option>
              <option value="last_month">Mes Anterior</option>
              <option value="this_year">Año Completo</option>
            </select>

            {/* BOTÓN REGISTRAR VENTA PRIMARIO */}
            <button
              onClick={() => handleOpenCreateSale()}
              className="px-3 sm:px-4 py-2.5 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/60 transition-transform active:scale-95 w-full sm:w-auto"
              title="Registrar una venta al detal, al mayor o en persona"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">Registrar Venta</span>
            </button>

            {/* BOTÓN NUEVA CUENTA */}
            <button
              onClick={handleOpenCreateModal}
              className="px-3 sm:px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-white/10 backdrop-blur-md transition w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Nueva Cuenta</span>
            </button>

            {/* BOTÓN IMPORTAR EXCEL */}
            <button
              onClick={() => {
                setExcelPreviewData([]);
                setExcelFile(null);
                setImportSuccessMessage(null);
                setIsExcelModalOpen(true);
              }}
              className="px-3 sm:px-3.5 py-2.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition w-full sm:w-auto"
              title="Importar cuentas masivamente desde archivo Excel o CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Importar Excel</span>
            </button>

            {/* BOTÓN NUEVO VENDEDOR */}
            <button
              onClick={() => setIsSellerModalOpen(true)}
              className="col-span-2 sm:col-span-1 px-3 sm:px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition w-full sm:w-auto"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Vendedor</span>
            </button>
          </div>
        </div>

        {/* HUD DE SECCIONES (TABS BAR PARA ESCRITORIO Y TABLET) */}
        <div className="hidden sm:flex items-center gap-2 p-1.5 rounded-2xl bg-[#181818] border border-[#2a2a2a] mb-6 overflow-x-auto no-scrollbar shadow-lg">
          <button
            onClick={() => setActiveTab("resumen")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === "resumen" 
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/60" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Resumen Global</span>
          </button>
          <button
            onClick={() => setActiveTab("ventas")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === "ventas" 
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/60" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Libro de Ventas (Sheet)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/60 text-emerald-300 border border-emerald-500/30 font-mono">
              +{formatCurrency(salesStats.totalProfit)}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === "cuentas" 
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/60" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Stock Cuentas ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("vendedores")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === "vendedores" 
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/60" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Revendedores ({sellers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("codigos")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === "codigos" 
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/60" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Códigos</span>
          </button>
          <button
            onClick={() => setActiveTab("todo")}
            className={`ml-auto px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === "todo" ? "bg-zinc-700 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Mostrar Todo
          </button>
        </div>

        {/* FINANCIAL KPI CARDS (RESUMEN FINANCIERO) */}
        {(activeTab === "resumen" || activeTab === "todo") && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5 mb-8">
            {/* Ingresos */}
            <div className="bg-[#181818] border border-[#2a2a2a] hover:border-zinc-600 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] shadow-xl group min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">Ingresos Totales</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono tracking-tight truncate">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-[10px] sm:text-[11px] text-emerald-400 mt-1 font-semibold truncate flex items-center gap-1">
                <span>Basado en ocupación</span>
              </div>
            </div>

            {/* Gastos */}
            <div className="bg-[#181818] border border-[#2a2a2a] hover:border-zinc-600 rounded-2xl p-3.5 sm:p-5 transition-all duration-300 hover:scale-[1.02] shadow-xl group min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">Costos Cuentas</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 shrink-0">
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono tracking-tight truncate">{formatCurrency(stats.totalExpenses)}</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 font-medium truncate">
                {accounts.length} cuentas en inventario
              </div>
            </div>

            {/* Ganancia Neta */}
            <div className="bg-gradient-to-br from-[#1c1c1c] to-[#141414] border border-[#E50914]/50 rounded-2xl p-3.5 sm:p-5 shadow-2xl shadow-red-950/40 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] min-w-0">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#E50914]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#E50914] animate-pulse shrink-0" />
                  <span className="truncate">Ganancia Neta</span>
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#E50914]/20 text-[#E50914] flex items-center justify-center border border-[#E50914]/40 shrink-0">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-2 font-mono tracking-tight truncate">{formatCurrency(stats.netProfit)}</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-300 mt-1 font-bold truncate">
                Margen: <span className="text-[#E50914] font-black">{stats.marginPercentage}</span>
              </div>
            </div>

            {/* Vencimientos Próximos */}
            <div className="bg-[#181818] border border-[#2a2a2a] hover:border-zinc-600 rounded-2xl p-3.5 sm:p-5 transition-all duration-300 hover:scale-[1.02] shadow-xl group min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">Vencen en 7 días</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-2 tracking-tight truncate">{stats.expiringSoon} cuentas</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">
                Requieren renovación
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN LIBRO CONTABLE, GASTOS & BALANCE FINANCIERO */}
        {(activeTab === "ventas" || activeTab === "todo") && (
          <section id="ventas-sheet" className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl max-w-full overflow-hidden">
            {/* Cabecera Principal */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#E50914]" />
                    <span>Libro Contable, Gastos & Balance Financiero</span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Control contable de ventas (detal/mayor), registro de gastos operativos, balances netos y análisis gráfico mensual/anual
                </p>
              </div>

              {/* Botones de acción dinámicos según la sub-pestaña */}
              <div className="flex flex-wrap items-center gap-2">
                {financeSubTab === "ventas" && (
                  <>
                    <button
                      onClick={handleExportSalesExcel}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm backdrop-blur-md"
                      title="Descargar libro de ventas en formato Excel (.xlsx)"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Excel Ventas</span>
                    </button>
                    <button
                      onClick={() => handleOpenCreateSale()}
                      className="px-4 py-2 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-red-950/60 transition-transform active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Registrar Venta</span>
                    </button>
                  </>
                )}

                {financeSubTab === "gastos" && (
                  <>
                    <button
                      onClick={handleExportExpensesExcel}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm backdrop-blur-md"
                      title="Descargar libro de gastos en formato Excel (.xlsx)"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Excel Gastos</span>
                    </button>
                    <button
                      onClick={handleOpenCreateExpense}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-950/60 transition-transform active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Registrar Gasto</span>
                    </button>
                  </>
                )}

                {financeSubTab === "grafica" && (
                  <div className="inline-flex rounded-xl bg-[#141414] border border-[#2a2a2a] p-1">
                    <button
                      onClick={() => setChartPeriod("mensual")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        chartPeriod === "mensual" ? "bg-[#E50914] text-white shadow-sm" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Vista Mensual</span>
                    </button>
                    <button
                      onClick={() => setChartPeriod("anual")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        chartPeriod === "anual" ? "bg-[#E50914] text-white shadow-sm" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Vista Anual</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mensajes de feedback */}
            {saleSuccessMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{saleSuccessMessage}</span>
              </div>
            )}
            {expenseSuccessMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{expenseSuccessMessage}</span>
              </div>
            )}

            {/* 4 CARDS: CONSOLIDADO FINANCIERO GENERAL */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
              {/* Ingresos Totales */}
              <div className="bg-[#141414] border border-[#2a2a2a] hover:border-emerald-500/40 rounded-xl p-3 sm:p-4 transition group min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-xs text-zinc-400 gap-1">
                  <span className="font-bold uppercase text-[9px] sm:text-[10px] tracking-wider text-emerald-400 flex items-center gap-1.5 truncate">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Ingresos Brutos</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded shrink-0">
                    {financeConsolidatedStats.totalSalesCount} vts
                  </span>
                </div>
                <div className="text-base sm:text-xl font-black text-white mt-2 font-mono truncate">
                  {formatCurrency(financeConsolidatedStats.totalCollected)}
                </div>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                  Cobros en ventas
                </div>
              </div>

              {/* Costos de Cuentas */}
              <div className="bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/40 rounded-xl p-3 sm:p-4 transition group min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-xs text-zinc-400 gap-1">
                  <span className="font-bold uppercase text-[9px] sm:text-[10px] tracking-wider text-amber-400 flex items-center gap-1.5 truncate">
                    <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">Costo Cuentas</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded shrink-0">
                    Stock
                  </span>
                </div>
                <div className="text-base sm:text-xl font-black text-amber-300 mt-2 font-mono truncate">
                  -{formatCurrency(financeConsolidatedStats.totalAccountCosts)}
                </div>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                  Costos adquisición
                </div>
              </div>

              {/* Gastos Operativos */}
              <div className="bg-[#141414] border border-[#2a2a2a] hover:border-rose-500/40 rounded-xl p-3 sm:p-4 transition group min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-xs text-zinc-400 gap-1">
                  <span className="font-bold uppercase text-[9px] sm:text-[10px] tracking-wider text-rose-400 flex items-center gap-1.5 truncate">
                    <Wallet className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">Gastos Operativos</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded shrink-0">
                    {financeConsolidatedStats.totalExpensesCount} reg
                  </span>
                </div>
                <div className="text-base sm:text-xl font-black text-rose-400 mt-2 font-mono truncate">
                  -{formatCurrency(financeConsolidatedStats.totalOpExpenses)}
                </div>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                  Proveedores, servicios
                </div>
              </div>

              {/* Ganancia Neta Real */}
              <div className="bg-[#141414] border border-[#E50914]/40 hover:border-[#E50914] rounded-xl p-3 sm:p-4 shadow-lg shadow-red-950/20 transition group min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-xs gap-1">
                  <span className="font-black uppercase text-[9px] sm:text-[10px] tracking-wider text-white flex items-center gap-1.5 truncate">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Ganancia Neta</span>
                  </span>
                  <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                    financeConsolidatedStats.realNetProfit >= 0 ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40" : "bg-rose-950 text-rose-400 border border-rose-500/40"
                  }`}>
                    {financeConsolidatedStats.realMargin}%
                  </span>
                </div>
                <div className={`text-base sm:text-2xl font-black mt-2 font-mono truncate ${
                  financeConsolidatedStats.realNetProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {financeConsolidatedStats.realNetProfit >= 0 ? "+" : ""}{formatCurrency(financeConsolidatedStats.realNetProfit)}
                </div>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 font-medium truncate">
                  Gastos: {formatCurrency(financeConsolidatedStats.grandTotalExpenses)}
                </div>
              </div>
            </div>

            {/* BARRA DE NAVEGACIÓN DE SUB-PESTAÑAS */}
            <div className="flex items-center gap-2 border-b border-[#2a2a2a] pb-3 mb-6 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFinanceSubTab("ventas")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                  financeSubTab === "ventas"
                    ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                    : "bg-[#141414] text-zinc-400 hover:text-white border border-[#2a2a2a]"
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Libro de Ventas</span>
                <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded">
                  {sales.length}
                </span>
              </button>

              <button
                onClick={() => setFinanceSubTab("gastos")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                  financeSubTab === "gastos"
                    ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                    : "bg-[#141414] text-zinc-400 hover:text-white border border-[#2a2a2a]"
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Gastos Operativos</span>
                <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded">
                  {expenses.length}
                </span>
              </button>

              <button
                onClick={() => setFinanceSubTab("grafica")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                  financeSubTab === "grafica"
                    ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                    : "bg-[#141414] text-zinc-400 hover:text-white border border-[#2a2a2a]"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Gráfica & Balance</span>
                <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-emerald-400">
                  {chartPeriod === "anual" ? chartYear : "Mes a mes"}
                </span>
              </button>
            </div>

            {/* VISTA 1: LIBRO DE VENTAS */}
            {financeSubTab === "ventas" && (
              <div>
                {/* Métricas específicas de Ventas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {/* Ventas Detal */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-teal-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Ventas al Detal</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">{salesStats.detalCount}</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white mt-1.5 font-mono">
                      {formatCurrency(salesStats.detalRevenue)}
                    </div>
                    <div className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                      Ganancia: +{formatCurrency(salesStats.detalProfit)}
                    </div>
                  </div>

                  {/* Ventas Mayor */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-[#E50914] flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        <span>Ventas al Mayor</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">{salesStats.mayorCount}</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white mt-1.5 font-mono">
                      {formatCurrency(salesStats.mayorRevenue)}
                    </div>
                    <div className="text-[11px] text-[#ff6666] mt-0.5 font-semibold">
                      Ganancia: +{formatCurrency(salesStats.mayorProfit)}
                    </div>
                  </div>

                  {/* Ganancia Neta Ventas */}
                  <div className="bg-[#141414] border border-emerald-500/40 rounded-xl p-3.5 sm:p-4 shadow-md shadow-emerald-950/20">
                    <div className="flex items-center justify-between text-xs text-emerald-300">
                      <span className="font-black uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>Ganancia Ventas</span>
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                        +{salesStats.margin}%
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5 font-mono">
                      +{formatCurrency(salesStats.totalProfit)}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                      Cobrado: {formatCurrency(salesStats.totalCollected)}
                    </div>
                  </div>

                  {/* Caja Efectivo (En Persona) vs Digital */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-amber-400 flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        <span>Caja Efectivo</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">{salesStats.physicalCount}</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-amber-300 mt-1.5 font-mono">
                      {formatCurrency(salesStats.cashRevenue)}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                      Bancos/Nequi: {formatCurrency(salesStats.digitalRevenue)}
                    </div>
                  </div>
                </div>

                {/* Filtros del Sheet */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl bg-[#141414] border border-[#2a2a2a] p-1">
                      <button
                        onClick={() => setSaleFilterType("all")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          saleFilterType === "all" ? "bg-[#E50914] text-white shadow-sm" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Todas ({sales.length})
                      </button>
                      <button
                        onClick={() => setSaleFilterType("detal")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          saleFilterType === "detal" ? "bg-teal-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        <span>Detal ({sales.filter(s => s.type === "detal").length})</span>
                      </button>
                      <button
                        onClick={() => setSaleFilterType("mayor")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          saleFilterType === "mayor" ? "bg-[#E50914] text-white shadow-sm" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Package className="w-3 h-3" />
                        <span>Mayor ({sales.filter(s => s.type === "mayor").length})</span>
                      </button>
                    </div>

                    <select
                      value={saleFilterPayment}
                      onChange={(e) => setSaleFilterPayment(e.target.value)}
                      className="bg-[#141414] border border-[#2a2a2a] text-xs text-zinc-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#E50914]"
                    >
                      <option value="all">Todos los Métodos</option>
                      <option value="efectivo">Efectivo (En Persona)</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="transferencia">Transferencia / Banco</option>
                      <option value="binance">Binance / USDT</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar cliente, cuenta..."
                      value={saleSearchQuery}
                      onChange={(e) => setSaleSearchQuery(e.target.value)}
                      className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                </div>

                {/* TABLA SHEET DE VENTAS */}
                <div className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#141414]">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#1c1c1c] text-zinc-400 uppercase font-bold text-[11px] tracking-wider border-b border-[#2a2a2a]">
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
                    <tbody className="divide-y divide-[#222222]">
                      {filteredSales.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-zinc-500">
                            No hay ventas registradas con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                              {new Date(sale.date).toLocaleDateString()}
                              <div className="text-[10px] text-zinc-500">
                                {new Date(sale.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {sale.type === "detal" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/60 text-teal-300 border border-teal-500/30">
                                  <Tag className="w-2.5 h-2.5" /> Detal
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E50914]/20 text-[#ff6666] border border-[#E50914]/40">
                                  <Package className="w-2.5 h-2.5" /> Mayor
                                </span>
                              )}
                              {sale.isPhysicalSale && (
                                <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] text-amber-400 font-semibold">
                                  <Banknote className="w-2.5 h-2.5" /> En Persona
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-white">{sale.customerName}</div>
                              {sale.customerContact && (
                                <div className="text-[10px] text-zinc-400">{sale.customerContact}</div>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-zinc-200">{sale.platform}</div>
                              {sale.accountEmail ? (
                                <div className="font-mono text-[10px] text-zinc-400 truncate max-w-[180px]">
                                  {sale.accountEmail}
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-500 italic">Venta directa</div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#222222] border border-[#333333] text-zinc-300 uppercase">
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-white">
                              ${Number(sale.salePrice).toFixed(2)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-zinc-400 text-[11px]">
                              ${Number(sale.costPrice).toFixed(2)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-400">
                              +${Number(sale.profit).toFixed(2)}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteSale(sale.id)}
                                className="p-1 text-zinc-500 hover:text-[#E50914] transition rounded"
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
              </div>
            )}

            {/* VISTA 2: GASTOS OPERATIVOS */}
            {financeSubTab === "gastos" && (
              <div>
                {/* Desglose de Gastos en Tarjetas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {/* Proveedores */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-amber-400 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        <span>Proveedores Lotes</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">
                        {expenses.filter(e => e.category === "proveedor").length}
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white mt-1.5 font-mono">
                      {formatCurrency(expenses.filter(e => e.category === "proveedor").reduce((s, e) => s + e.amount, 0))}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Compras de cuentas y pantallas
                    </div>
                  </div>

                  {/* Publicidad */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-purple-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Publicidad & Ads</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">
                        {expenses.filter(e => e.category === "publicidad").length}
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white mt-1.5 font-mono">
                      {formatCurrency(expenses.filter(e => e.category === "publicidad").reduce((s, e) => s + e.amount, 0))}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Campañas en redes y grupos
                    </div>
                  </div>

                  {/* Servicios & Infraestructura */}
                  <div className="bg-[#141414] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl p-3.5 sm:p-4 transition">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-blue-400 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>Servicios & Hosting</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono font-bold">
                        {expenses.filter(e => e.category === "servicios").length}
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white mt-1.5 font-mono">
                      {formatCurrency(expenses.filter(e => e.category === "servicios").reduce((s, e) => s + e.amount, 0))}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Proxies, VPS y herramientas
                    </div>
                  </div>

                  {/* Total Gastos Operativos */}
                  <div className="bg-[#141414] border border-rose-500/40 rounded-xl p-3.5 sm:p-4 shadow-md shadow-rose-950/20">
                    <div className="flex items-center justify-between text-xs text-rose-300">
                      <span className="font-black uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <Wallet className="w-3 h-3" />
                        <span>Total Operativos</span>
                      </span>
                      <span className="text-[10px] font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-500/40 font-bold">
                        {expenses.length} reg
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1.5 font-mono">
                      -{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                      Deducibles de la ganancia
                    </div>
                  </div>
                </div>

                {/* Filtros de Gastos */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={expenseFilterCategory}
                      onChange={(e) => setExpenseFilterCategory(e.target.value)}
                      className="bg-[#141414] border border-[#2a2a2a] text-xs text-zinc-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-rose-500"
                    >
                      <option value="all">Todas las Categorías ({expenses.length})</option>
                      <option value="proveedor">Proveedor de Cuentas</option>
                      <option value="publicidad">Publicidad & Marketing</option>
                      <option value="servicios">Servicios / Hosting</option>
                      <option value="comision">Comisiones a Vendedores</option>
                      <option value="operativo">Operativo / Oficina</option>
                      <option value="otro">Otro Gasto</option>
                    </select>

                    <select
                      value={expenseFilterPayment}
                      onChange={(e) => setExpenseFilterPayment(e.target.value)}
                      className="bg-[#141414] border border-[#2a2a2a] text-xs text-zinc-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-rose-500"
                    >
                      <option value="all">Todos los Métodos de Pago</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="binance">Binance / USDT</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por concepto o proveedor..."
                      value={expenseSearchQuery}
                      onChange={(e) => setExpenseSearchQuery(e.target.value)}
                      className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* TABLA SHEET DE GASTOS */}
                <div className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#141414]">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#1c1c1c] text-zinc-400 uppercase font-bold text-[11px] tracking-wider border-b border-[#2a2a2a]">
                      <tr>
                        <th className="py-3 px-3.5">Fecha</th>
                        <th className="py-3 px-3.5">Concepto / Descripción</th>
                        <th className="py-3 px-3.5">Categoría</th>
                        <th className="py-3 px-3.5">Proveedor / Destino</th>
                        <th className="py-3 px-3.5 text-center">Método Pago</th>
                        <th className="py-3 px-3.5 text-right">Monto ($)</th>
                        <th className="py-3 px-3.5">Notas</th>
                        <th className="py-3 px-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-zinc-500">
                            No hay gastos registrados con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((expense) => {
                          const catStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
                            proveedor: { bg: "bg-amber-950/60", text: "text-amber-300", border: "border-amber-500/30", label: "Proveedor" },
                            publicidad: { bg: "bg-purple-950/60", text: "text-purple-300", border: "border-purple-500/30", label: "Publicidad" },
                            servicios: { bg: "bg-blue-950/60", text: "text-blue-300", border: "border-blue-500/30", label: "Servicios" },
                            comision: { bg: "bg-emerald-950/60", text: "text-emerald-300", border: "border-emerald-500/30", label: "Comisión" },
                            operativo: { bg: "bg-zinc-800", text: "text-zinc-300", border: "border-zinc-700", label: "Operativo" },
                            otro: { bg: "bg-zinc-900", text: "text-zinc-400", border: "border-zinc-800", label: "Otro" }
                          };
                          const badge = catStyles[expense.category] || catStyles.otro;

                          return (
                            <tr key={expense.id} className="hover:bg-zinc-800/40 transition-colors">
                              <td className="py-3 px-3.5 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                                {expense.date.split("T")[0]}
                              </td>
                              <td className="py-3 px-3.5 font-semibold text-white">
                                {expense.title}
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-zinc-300">
                                {expense.supplier || <span className="text-zinc-500 italic">No especificado</span>}
                              </td>
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#222222] border border-[#333333] text-zinc-300 uppercase">
                                  {expense.paymentMethod}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-400">
                                -${Number(expense.amount).toFixed(2)}
                              </td>
                              <td className="py-3 px-3.5 text-zinc-400 text-[11px] max-w-[200px] truncate">
                                {expense.notes || <span className="text-zinc-600">-</span>}
                              </td>
                              <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1">
                                <button
                                  onClick={() => handleOpenEditExpense(expense)}
                                  className="p-1 text-zinc-400 hover:text-white transition rounded"
                                  title="Editar gasto"
                                >
                                  <Edit className="w-3.5 h-3.5 inline" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  className="p-1 text-zinc-500 hover:text-rose-500 transition rounded"
                                  title="Eliminar gasto"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VISTA 3: GRÁFICA & BALANCE FINANCIERO (MENSUAL / ANUAL) */}
            {financeSubTab === "grafica" && (
              <div>
                {/* Selector de Periodo y Resumen del Periodo Seleccionado */}
                <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 sm:p-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E50914]/20 text-[#E50914] flex items-center justify-center border border-[#E50914]/40">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {chartPeriod === "anual" 
                            ? `Balance Financiero Anual (${chartYear})` 
                            : `Balance Mensual: ${(chartData as any).monthName} ${chartYear}`}
                        </h3>
                        <p className="text-[11px] text-zinc-400">
                          {chartPeriod === "anual"
                            ? "Comparativa mes a mes de ingresos, costos y gastos acumulados en el año"
                            : "Desglose por semanas dentro del mes seleccionado"}
                        </p>
                      </div>
                    </div>

                    {/* Navegador de Fecha */}
                    <div className="flex items-center gap-2">
                      {chartPeriod === "mensual" && (
                        <select
                          value={chartMonth}
                          onChange={(e) => setChartMonth(Number(e.target.value))}
                          className="bg-[#1c1c1c] border border-[#333333] text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#E50914]"
                        >
                          <option value={0}>Enero</option>
                          <option value={1}>Febrero</option>
                          <option value={2}>Marzo</option>
                          <option value={3}>Abril</option>
                          <option value={4}>Mayo</option>
                          <option value={5}>Junio</option>
                          <option value={6}>Julio</option>
                          <option value={7}>Agosto</option>
                          <option value={8}>Septiembre</option>
                          <option value={9}>Octubre</option>
                          <option value={10}>Noviembre</option>
                          <option value={11}>Diciembre</option>
                        </select>
                      )}

                      <div className="inline-flex items-center bg-[#1c1c1c] border border-[#333333] rounded-xl p-0.5">
                        <button
                          onClick={() => setChartYear(y => y - 1)}
                          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                          title="Año anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2 text-white">{chartYear}</span>
                        <button
                          onClick={() => setChartYear(y => y + 1)}
                          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                          title="Año siguiente"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Resumen numérico del periodo seleccionado */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4">
                    <div className="p-3 rounded-lg bg-[#181818] border border-[#2a2a2a]">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Ingresos Periodo
                      </div>
                      <div className="text-base sm:text-lg font-black text-white font-mono mt-1">
                        {formatCurrency(chartData.totalIncome)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#181818] border border-[#2a2a2a]">
                      <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                        Gastos Periodo (Cuentas + Op)
                      </div>
                      <div className="text-base sm:text-lg font-black text-rose-400 font-mono mt-1">
                        -{formatCurrency(chartData.totalExpense)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#181818] border border-emerald-500/30">
                      <div className="text-[10px] uppercase font-bold text-zinc-300 tracking-wider flex items-center justify-between">
                        <span>Balance Neto</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          chartData.totalProfit >= 0 ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30" : "bg-rose-950 text-rose-300 border border-rose-500/30"
                        }`}>
                          {chartData.totalIncome > 0 ? `${((chartData.totalProfit / chartData.totalIncome) * 100).toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                      <div className={`text-base sm:text-lg font-black font-mono mt-1 ${
                        chartData.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {chartData.totalProfit >= 0 ? "+" : ""}{formatCurrency(chartData.totalProfit)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRÁFICA VISUAL INTERACTIVA (BARRAS) */}
                <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 sm:p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-zinc-300">
                      Comparativa de Barras: Ingresos (Verde) vs Gastos Totales (Rojo)
                    </span>
                    <div className="flex items-center gap-4 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-emerald-500" />
                        <span className="text-zinc-300 font-medium">Ingresos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-rose-500" />
                        <span className="text-zinc-300 font-medium">Gastos Totales</span>
                      </div>
                    </div>
                  </div>

                  {/* Lienzo de Barras */}
                  <div className="h-64 sm:h-72 w-full pt-6 pb-2 px-2 flex items-end justify-between gap-1.5 sm:gap-3 border-b border-[#2e2e2e]">
                    {chartData.items.map((item, idx) => {
                      const incomeHeight = chartData.maxVal > 0 ? Math.max(4, Math.round((item.income / chartData.maxVal) * 100)) : 4;
                      const expenseHeight = chartData.maxVal > 0 ? Math.max(4, Math.round((item.totalExpense / chartData.maxVal) * 100)) : 4;
                      const isHovered = chartHoveredIndex === idx;

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setChartHoveredIndex(idx)}
                          onMouseLeave={() => setChartHoveredIndex(null)}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                        >
                          {/* Tooltip flotante al pasar el cursor */}
                          {isHovered && (
                            <div className="absolute bottom-[105%] z-30 mb-2 w-48 p-2.5 rounded-xl bg-[#1f1f1f] border border-[#3a3a3a] shadow-2xl text-[11px] pointer-events-none animate-in fade-in zoom-in-95">
                              <div className="font-bold text-white border-b border-[#2e2e2e] pb-1 mb-1.5">
                                {item.fullName}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-emerald-400">
                                  <span>Ingresos:</span>
                                  <span className="font-mono font-bold">+{formatCurrency(item.income)}</span>
                                </div>
                                <div className="flex justify-between text-amber-400 text-[10px]">
                                  <span>Costo Cuentas:</span>
                                  <span className="font-mono">-{formatCurrency(item.accountCost)}</span>
                                </div>
                                <div className="flex justify-between text-rose-400 text-[10px]">
                                  <span>Gastos Op:</span>
                                  <span className="font-mono">-{formatCurrency(item.opExpense)}</span>
                                </div>
                                <div className="flex justify-between text-rose-300 pt-1 border-t border-[#2e2e2e] font-semibold">
                                  <span>Total Gastos:</span>
                                  <span className="font-mono">-{formatCurrency(item.totalExpense)}</span>
                                </div>
                                <div className="flex justify-between text-white font-bold pt-1 border-t border-[#2e2e2e]">
                                  <span>Neto:</span>
                                  <span className={`font-mono ${item.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {item.profit >= 0 ? "+" : ""}{formatCurrency(item.profit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Las dos barras paralelas (Ingreso vs Gasto) */}
                          <div className="w-full flex items-end justify-center gap-1 h-full pb-1">
                            {/* Barra Ingreso */}
                            <div
                              style={{ height: `${item.income > 0 ? incomeHeight : 4}%` }}
                              className={`w-1/2 max-w-[20px] rounded-t transition-all duration-300 ${
                                item.income > 0
                                  ? "bg-gradient-to-t from-emerald-700 to-emerald-400 group-hover:to-emerald-300 shadow-sm shadow-emerald-950/40"
                                  : "bg-zinc-800"
                              }`}
                            />

                            {/* Barra Gasto */}
                            <div
                              style={{ height: `${item.totalExpense > 0 ? expenseHeight : 4}%` }}
                              className={`w-1/2 max-w-[20px] rounded-t transition-all duration-300 ${
                                item.totalExpense > 0
                                  ? "bg-gradient-to-t from-rose-700 to-rose-400 group-hover:to-rose-300 shadow-sm shadow-rose-950/40"
                                  : "bg-zinc-800"
                              }`}
                            />
                          </div>

                          {/* Etiqueta del Eje X */}
                          <span className={`text-[10px] font-mono mt-1.5 transition ${
                            isHovered ? "text-white font-bold" : "text-zinc-500"
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 px-1 font-mono">
                    <span>Mín: $0</span>
                    <span>Pasa el cursor por las barras para ver el desglose detallado de cada mes o semana</span>
                    <span>Máx: {formatCurrency(chartData.maxVal)}</span>
                  </div>
                </div>

                {/* TABLA COMPARATIVA DE DESGLOSE FINANCIERO */}
                <div className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#141414]">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#1c1c1c] text-zinc-400 uppercase font-bold text-[11px] tracking-wider border-b border-[#2a2a2a]">
                      <tr>
                        <th className="py-3 px-3.5">Periodo</th>
                        <th className="py-3 px-3.5 text-center">Ventas / Gastos</th>
                        <th className="py-3 px-3.5 text-right text-emerald-400">Ingresos (+)</th>
                        <th className="py-3 px-3.5 text-right text-amber-400">Costo Cuentas (-)</th>
                        <th className="py-3 px-3.5 text-right text-rose-400">Gastos Op. (-)</th>
                        <th className="py-3 px-3.5 text-right text-rose-300 font-bold">Total Gastos (-)</th>
                        <th className="py-3 px-3.5 text-right font-black">Ganancia Neta</th>
                        <th className="py-3 px-3.5 text-right">Margen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {chartData.items.map((row, idx) => {
                        const rowMargin = row.income > 0 ? ((row.profit / row.income) * 100).toFixed(1) : "0";
                        return (
                          <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">
                              {row.fullName}
                            </td>
                            <td className="py-3 px-3.5 text-center font-mono text-zinc-400 whitespace-nowrap text-[11px]">
                              {row.salesCount} vts / {row.expensesCount} exp
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                              +{formatCurrency(row.income)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-amber-400 whitespace-nowrap text-[11px]">
                              -{formatCurrency(row.accountCost)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-rose-400 whitespace-nowrap text-[11px]">
                              -{formatCurrency(row.opExpense)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-semibold text-rose-300 whitespace-nowrap">
                              -{formatCurrency(row.totalExpense)}
                            </td>
                            <td className={`py-3 px-3.5 text-right font-mono font-black whitespace-nowrap ${
                              row.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              {row.profit >= 0 ? "+" : ""}{formatCurrency(row.profit)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-semibold text-zinc-400 whitespace-nowrap text-[11px]">
                              {rowMargin}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECCIÓN CATÁLOGO DE SERVICIOS (Ocultada por solicitud) */}
        {false && (
          <section id="catalogo" className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#E50914]" />
                    <span>Catálogo Oficial de Servicios & Plataformas</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-black/60 text-[#ff6666] border border-[#E50914]/30">
                      {catalogPlatforms.length} servicios
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Configura nombres, precios de venta (detal/mayor), costos base, cupos y beneficios visibles en la tienda pública
                </p>
              </div>
              <button
                onClick={handleOpenCreatePlatform}
                className="px-4 py-2.5 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/60 transition-transform active:scale-95 w-fit"
              >
                <Plus className="w-4 h-4" />
                <span>+ Crear Plataforma</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {catalogPlatforms.map((plat) => (
                <div 
                  key={plat.id} 
                  className="p-5 rounded-2xl bg-[#141414] border border-[#2a2a2a] hover:border-[#E50914]/60 hover:scale-[1.02] flex flex-col justify-between transition-all duration-300 shadow-xl group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-white/5 to-transparent rounded-full pointer-events-none" />
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-block px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider bg-[#222222] border border-[#333333] text-white">
                            {plat.name}
                          </span>
                          {plat.badge && (
                            <span className="px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest bg-[#E50914] text-white shadow-sm">
                              {plat.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 font-medium">{plat.category || "Servicio Streaming Premium"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-emerald-400 font-mono tracking-tight">
                          ${Number(plat.retailPrice || plat.price || plat.defaultIncome || 3.5).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Detal / PVP</div>
                        {plat.wholesalePrice && (
                          <div className="text-[11px] font-black text-[#ff6666] font-mono mt-0.5">
                            ${Number(plat.wholesalePrice).toFixed(2)} <span className="text-[9px] text-zinc-500 font-normal">Mayor</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-[#1c1c1c] border border-[#282828] text-center text-xs">
                      <div>
                        <div className="text-zinc-500 text-[10px] font-bold uppercase">Perfiles</div>
                        <div className="font-black text-white mt-0.5">{plat.defaultProfiles}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px] font-bold uppercase">Costo Base</div>
                        <div className="font-black text-red-400 mt-0.5">${Number(plat.defaultCost).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px] font-bold uppercase">Margen Est.</div>
                        <div className="font-black text-emerald-400 mt-0.5">
                          ${(Number(plat.defaultIncome || 14) - Number(plat.defaultCost || 2)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#262626] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {accounts.filter(a => a.platform.toLowerCase().includes(plat.name.toLowerCase())).length} cuentas en stock
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditPlatform(plat)}
                        className="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg flex items-center gap-1 transition"
                        title="Editar características y precios de la plataforma"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlatform(plat.id, plat.name)}
                        className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg flex items-center gap-1 transition"
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

        {/* TABLA DE GESTIÓN DE CUENTAS INVENTARIO */}
        {(activeTab === "cuentas" || activeTab === "resumen" || activeTab === "todo") && (
          <section id="cuentas" className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl max-w-full overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Tv className="w-5 h-5 text-[#E50914]" />
                    <span>Inventario de Cuentas en Stock</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-black/60 text-zinc-300 border border-zinc-700">
                      {filteredAccounts.length} de {accounts.length}
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400">Control de correos, credenciales, cupos de pantalla y vendedor o comprador asignado</p>
              </div>

              {/* Acciones Rápidas: Subir Lista, Descargar Formato, Nueva Cuenta */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setExcelPreviewData([]);
                    setExcelFile(null);
                    setImportSuccessMessage(null);
                    setIsExcelModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 transition active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Lista</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-[#222222] hover:bg-zinc-700 text-zinc-200 border border-[#333333] text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Descargar archivo Excel de ejemplo con el formato requerido"
                >
                  <Download className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Descargar Formato</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/10 transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Cuenta</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Filtros y Búsqueda:</span>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por correo, vendedor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                  />
                </div>

                {/* Filtro por Estado */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#141414] border border-[#2a2a2a] text-xs text-zinc-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#E50914]"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="assigned">En Venta (Asignadas)</option>
                  <option value="available">En Stock (Libres)</option>
                  <option value="expiring">Por Vencer / Vencidas</option>
                  <option value="verified">🟢 Verificadas (Funcionan)</option>
                  <option value="payment_failed">🔴 Caídas por pago</option>
                  <option value="unreviewed">🟡 Sin revisar</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#141414]">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-[#1c1c1c] text-zinc-400 uppercase font-bold text-[11px] tracking-wider border-b border-[#2a2a2a]">
                  <tr>
                    <th className="py-3 px-4">Plataforma & País</th>
                    <th className="py-3 px-4">Correo & Contraseña</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">Verificada</th>
                    <th className="py-3 px-4">Vendido a / Asignado</th>
                    <th className="py-3 px-4 text-center">Perfiles / Cupos</th>
                    <th className="py-3 px-4 whitespace-nowrap">Vencimiento</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8">
                        {accounts.length === 0 ? (
                          <div className="text-zinc-500 text-xs">
                            Aún no hay cuentas registradas en el inventario. Agrega una nueva o importa desde Excel.
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="text-zinc-400 text-xs">
                              Hay {accounts.length} cuenta{accounts.length === 1 ? "" : "s"} en total, pero ninguna coincide con los filtros actuales.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery("");
                                setPlatformFilter("all");
                                setStatusFilter("all");
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-bold transition shadow-md shadow-red-950/40"
                            >
                              Restablecer Filtros y Ver Todas ({accounts.length})
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-block px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider bg-[#222222] border border-[#333333] text-white">
                              {acc.platform}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono bg-black/40 border border-zinc-800 px-1.5 py-0.5 rounded">
                              <Globe className="w-2.5 h-2.5 text-[#E50914]" />
                              <span>{acc.country || "Global"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-medium text-white">{acc.email}</div>
                          {acc.password && (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono mt-0.5">
                              <span>{showPassword[acc.id] ? acc.password : "••••••••••••"}</span>
                              <button
                                onClick={() => togglePasswordVisibility(acc.id)}
                                className="text-zinc-500 hover:text-white"
                                title="Mostrar/Ocultar Contraseña"
                              >
                                {showPassword[acc.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {(() => {
                            const verStatus = getVerificationStatus(acc.isVerified);
                            if (verStatus === "verified") {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleToggleVerification(acc)}
                                  className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 hover:scale-105 shadow-sm shadow-emerald-950/40 transition cursor-pointer"
                                  title="Verificada / Funciona (Clic para cambiar estado)"
                                >
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/90 animate-pulse"></span>
                                  <span>Verificada</span>
                                </button>
                              );
                            }
                            if (verStatus === "payment_failed") {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleToggleVerification(acc)}
                                  className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30 hover:border-rose-400 hover:scale-105 shadow-sm shadow-rose-950/40 transition cursor-pointer"
                                  title="Caída por pago (Clic para cambiar estado)"
                                >
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/90"></span>
                                  <span>Caída por pago</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => handleToggleVerification(acc)}
                                className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30 hover:border-amber-400 hover:scale-105 shadow-sm shadow-amber-950/40 transition cursor-pointer"
                                title="Sin revisar (Clic para cambiar estado)"
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/90"></span>
                                <span>Sin revisar</span>
                              </button>
                            );
                          })()}
                        </td>
                        <td className="py-3.5 px-4">
                          {acc.customerName ? (
                            <div>
                              <span className="text-white font-semibold flex items-center gap-1.5 text-xs">
                                <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span>{acc.customerName}</span>
                              </span>
                              {acc.sellerId && (
                                <span className="text-[10px] text-zinc-400 block mt-0.5">
                                  Revendedor: {acc.seller}
                                </span>
                              )}
                            </div>
                          ) : acc.sellerId ? (
                            <span className="text-zinc-200 font-medium flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span>{acc.seller}</span>
                            </span>
                          ) : (
                            <span className="text-amber-400/90 font-semibold text-[11px]">
                              Sin Asignar (Stock)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-black text-white">{acc.profilesOccupied}</span>
                          <span className="text-zinc-500 font-mono"> / {acc.maxProfiles}</span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className={`flex items-center gap-1.5 font-medium ${
                            acc.status === "expired" 
                              ? "text-red-400 font-bold" 
                              : acc.status === "expiring" 
                              ? "text-amber-300 font-bold" 
                              : "text-zinc-300"
                          }`}>
                            <Clock className={`w-3.5 h-3.5 ${
                              acc.status === "expired" 
                                ? "text-red-400" 
                                : acc.status === "expiring" 
                                ? "text-amber-400" 
                                : "text-zinc-500"
                            }`} />
                            <span>{formatDate(acc.expirationDate)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[110px]">
                          {acc.status === "assigned" && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>En Venta</span>
                            </span>
                          )}
                          {acc.status === "available" && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/70 text-blue-400 border border-blue-500/30 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>En Stock</span>
                            </span>
                          )}
                          {acc.status === "expiring" && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40 shadow-sm animate-pulse">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Por Vencer</span>
                            </span>
                          )}
                          {acc.status === "expired" && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-950/70 text-red-400 border border-red-500/40 shadow-sm">
                              <AlertCircle className="w-3 h-3 text-red-400" />
                              <span>Vencida</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenCreateSale(acc)}
                            className="px-2.5 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg transition inline-flex items-center gap-1 shadow-md shadow-emerald-950/40"
                            title="Registrar venta de esta cuenta al detal o mayor"
                          >
                            <DollarSign className="w-3 h-3" />
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
                            className="px-2.5 py-1 text-xs text-zinc-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition"
                            title="Asignar o cambiar vendedor"
                          >
                            {acc.sellerId ? "Cambiar" : "Asignar"}
                          </button>
                          <button
                            onClick={() => {
                              setTestEmail(acc.email);
                              setTestService("netflix");
                              const codigosEl = document.getElementById("codigos-owner");
                              codigosEl?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="px-2 py-1 text-xs text-[#ff6666] hover:text-white bg-[#E50914]/20 hover:bg-[#E50914]/40 border border-[#E50914]/30 rounded-lg transition"
                            title="Extraer códigos de esta cuenta"
                          >
                            <KeyRound className="w-3.5 h-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(acc)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-white bg-[#222222] hover:bg-zinc-700 rounded-lg transition"
                            title="Editar Cuenta"
                          >
                            <Edit className="w-3.5 h-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="px-2 py-1 text-xs text-red-400 hover:text-white bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg transition"
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
          <section id="vendedores" className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#E50914]" />
                    <span>Revendedores y Distribuidores Autorizados</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-black/60 text-zinc-300 border border-zinc-700">
                      {sellers.length} activos
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Usuarios que inician sesión en el portal de revendedor para consultar códigos y gestionar sus cuentas
                </p>
              </div>
              <button
                onClick={handleOpenCreateSeller}
                className="px-4 py-2.5 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/60 transition-transform active:scale-95 w-fit"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Registrar Vendedor</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6">
              {sellers.map((s) => {
                const assignedCount = accounts.filter(a => a.sellerId === s.id || a.sellerId === s.email || a.seller === s.name).length;
                const isSelected = selectedSellerForAccounts === s.id;
                return (
                  <div 
                    key={s.id} 
                    className={`p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 shadow-xl cursor-pointer ${
                      isSelected 
                        ? "bg-[#1f1416] border-2 border-[#E50914] shadow-2xl shadow-red-950/70 scale-[1.02]" 
                        : "bg-[#141414] border border-[#2a2a2a] hover:border-[#E50914]/50 hover:scale-[1.01]"
                    }`}
                    onClick={() => setSelectedSellerForAccounts(isSelected ? null : s.id)}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-black text-base text-white tracking-tight flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-[#E50914] animate-ping" : "bg-[#E50914]"}`} />
                            <span>{s.name}</span>
                          </div>
                          <div className="text-xs text-[#ff6666] font-mono mt-1 font-semibold">{s.email || `${s.name.toLowerCase().replace(/\s+/g, "")}@ventas.com`}</div>
                          <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span>{s.phone}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
                            Activo
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#E50914] text-white shadow-sm">
                              Seleccionado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-[#262626] space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400 text-xs font-medium">Asignadas:</span>
                          <span className="font-black text-white bg-[#222222] px-2.5 py-0.5 rounded-md text-xs border border-zinc-700 font-mono">
                            {assignedCount}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditSeller(s)}
                            className="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg flex items-center gap-1 transition"
                            title="Editar Vendedor"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSeller(s.id, s.name)}
                            className="px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg flex items-center gap-1 transition"
                            title="Eliminar Vendedor"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSellerForAccounts(isSelected ? null : s.id);
                        }}
                        className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                          isSelected
                            ? "bg-[#E50914] text-white shadow-lg shadow-red-950/60"
                            : "bg-[#202020] hover:bg-[#282828] text-white border border-[#333333]"
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5 text-[#E50914]" />
                        <span>{isSelected ? "Ocultar Cuentas Asignadas" : `Ver Cuentas Asignadas (${assignedCount})`}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PANEL DETALLADO DE CUENTAS ASIGNADAS AL VENDEDOR SELECCIONADO */}
            {selectedSellerForAccounts && (() => {
              const activeSellerObj = sellers.find(s => s.id === selectedSellerForAccounts);
              if (!activeSellerObj) return null;

              const sellerAccounts = accounts.filter(a => 
                a.sellerId === activeSellerObj.id || 
                a.sellerId === activeSellerObj.email || 
                a.seller === activeSellerObj.name
              );

              const filteredAccounts = sellerAccounts.filter(a =>
                a.email.toLowerCase().includes(sellerAccountSearch.toLowerCase()) ||
                a.platform.toLowerCase().includes(sellerAccountSearch.toLowerCase()) ||
                (a.country && a.country.toLowerCase().includes(sellerAccountSearch.toLowerCase()))
              );

              return (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#121212] border-2 border-[#E50914]/50 shadow-2xl relative overflow-hidden animate-in fade-in duration-200">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header del Panel */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#282828] mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                        <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                          <Users className="w-5 h-5 text-[#E50914]" />
                          <span>Cuentas Asignadas a:</span>
                          <span className="text-[#E50914]">{activeSellerObj.name}</span>
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#E50914]/20 text-[#ff6666] border border-[#E50914]/30">
                            {sellerAccounts.length} cuentas
                          </span>
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {activeSellerObj.email} • Tel: {activeSellerObj.phone} — Gestiona o quita las cuentas asignadas a este vendedor
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          const availableAcc = accounts.find(a => !a.sellerId);
                          if (availableAcc) {
                            setSelectedSellerToAssign(activeSellerObj.id);
                            handleOpenAssignModal(availableAcc);
                          } else {
                            alert("No hay cuentas libres en stock para asignar. Crea o importa una nueva cuenta primero.");
                          }
                        }}
                        className="px-3.5 py-2 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/60 transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Asignar Cuenta a {activeSellerObj.name}</span>
                      </button>

                      <button
                        onClick={() => setSelectedSellerForAccounts(null)}
                        className="px-3 py-2 bg-[#222222] hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold rounded-xl flex items-center gap-1 border border-[#333333] transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cerrar Vista</span>
                      </button>
                    </div>
                  </div>

                  {/* Buscador de cuentas asignadas */}
                  {sellerAccounts.length > 0 && (
                    <div className="mb-4">
                      <div className="relative max-w-md">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          placeholder="Buscar entre las cuentas de este vendedor (correo, plataforma, país)..."
                          value={sellerAccountSearch}
                          onChange={(e) => setSellerAccountSearch(e.target.value)}
                          className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Listado de cuentas asignadas */}
                  {sellerAccounts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#181818] border border-dashed border-[#333333] text-center">
                      <Tv className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                      <div className="text-sm font-bold text-white">Este vendedor no tiene ninguna cuenta asignada</div>
                      <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                        Actualmente no posee cuentas de streaming en su panel. Puedes entregarle una cuenta libre desde el inventario.
                      </p>
                      <button
                        onClick={() => {
                          const availableAcc = accounts.find(a => !a.sellerId);
                          if (availableAcc) {
                            setSelectedSellerToAssign(activeSellerObj.id);
                            handleOpenAssignModal(availableAcc);
                          } else {
                            alert("No hay cuentas libres en stock. Crea o importa una nueva cuenta primero.");
                          }
                        }}
                        className="mt-4 px-4 py-2 bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-md shadow-red-950/60"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Asignarle Cuenta Ahora</span>
                      </button>
                    </div>
                  ) : filteredAccounts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No se encontraron cuentas que coincidan con &quot;{sellerAccountSearch}&quot;.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredAccounts.map((acc) => {
                        const isExpiring = acc.status === "expiring";
                        const isExpired = acc.expirationDate && new Date(acc.expirationDate) < new Date();

                        return (
                          <div 
                            key={acc.id}
                            className="p-4 rounded-xl bg-[#181818] border border-[#2c2c2c] hover:border-[#E50914]/40 flex flex-col justify-between transition shadow-lg group"
                          >
                            <div>
                              {/* Header tarjeta */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border truncate max-w-[170px] ${acc.platformColor}`}>
                                  {acc.platform}
                                </span>
                                {isExpired ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-500/30">
                                    Vencida
                                  </span>
                                ) : isExpiring ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30 animate-pulse">
                                    Por Vencer
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                                    Activa
                                  </span>
                                )}
                              </div>

                              {/* Correo y Clave */}
                              <div className="font-mono text-xs text-white font-bold break-all flex items-center justify-between gap-1 mt-1">
                                <span>{acc.email}</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(acc.email)}
                                  className="text-zinc-500 hover:text-white shrink-0"
                                  title="Copiar Correo"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-mono">
                                <span>Clave:</span>
                                <span className="text-zinc-200">
                                  {showPassword[acc.id] ? acc.password : "••••••••"}
                                </span>
                                <button
                                  onClick={() => setShowPassword(p => ({ ...p, [acc.id]: !p[acc.id] }))}
                                  className="text-zinc-500 hover:text-white"
                                >
                                  {showPassword[acc.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>

                              {/* Datos extra */}
                              <div className="mt-2.5 pt-2 border-t border-[#262626] grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-zinc-500 block">Vencimiento:</span>
                                  <span className="text-zinc-200 font-bold font-mono">{acc.expirationDate || "Sin fecha"}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block">Perfiles:</span>
                                  <span className="text-zinc-200 font-mono">{acc.profilesOccupied}/{acc.maxProfiles}</span>
                                </div>
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="mt-3 pt-3 border-t border-[#262626] flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setTestEmail(acc.email);
                                    setTestService("netflix");
                                    const codigosEl = document.getElementById("codigos-owner");
                                    codigosEl?.scrollIntoView({ behavior: "smooth" });
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#E50914] hover:bg-[#f40612] rounded-lg flex items-center gap-1 shadow-sm transition"
                                  title="Extraer código en vivo de esta cuenta"
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>Código</span>
                                </button>

                                <button
                                  onClick={() => handleOpenCreateSale(acc)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 shadow-sm transition"
                                  title="Registrar venta de esta cuenta"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>Vender</span>
                                </button>

                                <button
                                  onClick={() => handleOpenAssignModal(acc)}
                                  className="px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition"
                                  title="Reasignar a otro vendedor"
                                >
                                  Reasignar
                                </button>
                              </div>

                              <button
                                onClick={() => handleQuickUnassign(acc)}
                                className="px-2 py-1 text-[11px] text-amber-400 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg transition"
                                title="Quitar cuenta de este vendedor y devolver al stock"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* SECCIÓN CALENDARIO DE VENCIMIENTOS Y RECORDATORIOS (EXCLUSIVO OWNER) */}
        {(activeTab === "calendario" || activeTab === "todo") && (
          <section id="calendario-owner" className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl relative overflow-hidden max-w-full">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Encabezado de Sección */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#E50914]" />
                    <span>Calendario de Vencimientos y Recordatorios</span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Control visual de fechas de expiración de cuentas, avisos de renovación y recordatorios para cobros a revendedores
                </p>
              </div>

              {/* Botones de Vista */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCalendarViewTab("cuentas")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    calendarViewTab === "cuentas"
                      ? "bg-[#E50914] text-white shadow-md shadow-red-950/60"
                      : "bg-[#222222] text-zinc-400 hover:text-white border border-[#333333]"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Vista Mensual</span>
                </button>
                <button
                  onClick={() => setCalendarViewTab("proximos")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    calendarViewTab === "proximos"
                      ? "bg-[#E50914] text-white shadow-md shadow-red-950/60"
                      : "bg-[#222222] text-zinc-400 hover:text-white border border-[#333333]"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Próximos 7 Días ({expiringSoonAccounts.length})</span>
                </button>
                <button
                  onClick={() => setCalendarViewTab("recordatorios")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    calendarViewTab === "recordatorios"
                      ? "bg-[#E50914] text-white shadow-md shadow-red-950/60"
                      : "bg-[#222222] text-zinc-400 hover:text-white border border-[#333333]"
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Recordatorios ({calendarReminders.length})</span>
                </button>
              </div>
            </div>

            {/* Barra de KPIs Operativos del Calendario */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div 
                onClick={() => setCalendarViewTab("proximos")}
                className="p-3.5 rounded-xl bg-[#141414] border border-amber-500/30 hover:border-amber-500 cursor-pointer transition shadow-md group"
              >
                <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
                  <span>Por Vencer (7 Días)</span>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-white font-mono">{expiringSoonAccounts.length}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Cuentas que requieren atención</div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-red-500/30 shadow-md">
                <div className="flex items-center justify-between text-xs text-red-400 font-bold mb-1">
                  <span>Ya Vencidas</span>
                  <X className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-white font-mono">{expiredAccounts.length}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Pendientes por reactivar</div>
              </div>

              <div 
                onClick={() => setCalendarViewTab("recordatorios")}
                className="p-3.5 rounded-xl bg-[#141414] border border-indigo-500/30 hover:border-indigo-500 cursor-pointer transition shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-indigo-400 font-bold mb-1">
                  <span>Recordatorios Activos</span>
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {calendarReminders.filter(r => !r.completed).length}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Notas y tareas pendientes</div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2f2f2f] shadow-md">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-bold mb-1">
                  <span>Vencimientos Mes</span>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {accounts.filter(a => a.expirationDate && a.expirationDate.startsWith(`${calendarMonthData.year}-${String(calendarMonthData.month + 1).padStart(2, "0")}`)).length}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Total en {monthNames[calendarMonthData.month]}</div>
              </div>
            </div>

            {/* VISTA 1: VISTA MENSUAL DEL CALENDARIO */}
            {calendarViewTab === "cuentas" && (
              <div>
                {/* Controles de Navegación de Mes */}
                <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[#141414] border border-[#2a2a2a]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg bg-[#222222] hover:bg-zinc-700 text-white transition border border-[#333333]"
                      title="Mes Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="text-base font-black text-white tracking-tight flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-[#E50914]" />
                      <span>{monthNames[calendarMonthData.month]} {calendarMonthData.year}</span>
                    </div>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg bg-[#222222] hover:bg-zinc-700 text-white transition border border-[#333333]"
                      title="Mes Siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTodayCalendar}
                      className="px-3 py-1.5 bg-[#E50914]/20 hover:bg-[#E50914]/40 text-[#ff6666] hover:text-white border border-[#E50914]/30 rounded-lg text-xs font-bold transition"
                    >
                      Hoy
                    </button>
                  </div>
                </div>

                {/* Grid del Calendario */}
                <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] overflow-hidden mb-6">
                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 text-center py-2.5 bg-[#181818] border-b border-[#282828] text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                    <div>Lun</div>
                    <div>Mar</div>
                    <div>Mié</div>
                    <div>Jue</div>
                    <div>Vie</div>
                    <div>Sáb</div>
                    <div>Dom</div>
                  </div>

                  {/* Celdas de días */}
                  <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[#222222]">
                    {calendarMonthData.cells.map((cell, idx) => {
                      if (!cell) {
                        return (
                          <div key={`empty-${idx}`} className="min-h-[75px] sm:min-h-[90px] bg-[#0c0c0c]/40 p-1.5" />
                        );
                      }

                      const todayStr = new Date().toISOString().split("T")[0];
                      const isToday = cell.dateStr === todayStr;
                      const isSelected = cell.dateStr === selectedCalendarDate;

                      // Cuentas que vencen este día
                      const expiringAccountsOnDay = accounts.filter(a => a.expirationDate && a.expirationDate.split("T")[0] === cell.dateStr);
                      // Recordatorios para este día
                      const remindersOnDay = calendarReminders.filter(r => r.date === cell.dateStr);

                      return (
                        <div
                          key={cell.dateStr}
                          onClick={() => setSelectedCalendarDate(cell.dateStr)}
                          className={`min-h-[75px] sm:min-h-[90px] p-2 flex flex-col justify-between transition cursor-pointer select-none relative ${
                            isSelected
                              ? "bg-[#221214] ring-2 ring-[#E50914] z-10 shadow-lg shadow-red-950/60"
                              : "hover:bg-[#1a1a1a]"
                          } ${isToday ? "bg-[#161214]" : ""}`}
                        >
                          {/* Número del día */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black font-mono ${
                              isToday 
                                ? "w-6 h-6 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-md shadow-red-950/60" 
                                : isSelected 
                                ? "text-[#E50914]" 
                                : "text-zinc-300"
                            }`}>
                              {cell.dayNumber}
                            </span>

                            {isToday && (
                              <span className="hidden sm:inline text-[9px] font-black uppercase text-[#E50914] bg-[#E50914]/15 px-1 rounded">
                                Hoy
                              </span>
                            )}
                          </div>

                          {/* Badges de eventos */}
                          <div className="mt-1 space-y-1">
                            {expiringAccountsOnDay.length > 0 && (
                              <div className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] sm:text-[10px] font-black tracking-tight flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                <span className="truncate">{expiringAccountsOnDay.length} {expiringAccountsOnDay.length === 1 ? "vence" : "vencen"}</span>
                              </div>
                            )}

                            {remindersOnDay.length > 0 && (
                              <div className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold flex items-center gap-1 truncate">
                                <Bookmark className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{remindersOnDay.length} rec.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PANEL DE DETALLE PARA LA FECHA SELECCIONADA */}
                {(() => {
                  const dayAccounts = accounts.filter(a => a.expirationDate && a.expirationDate.split("T")[0] === selectedCalendarDate);
                  const dayReminders = calendarReminders.filter(r => r.date === selectedCalendarDate);

                  return (
                    <div className="p-5 sm:p-6 rounded-2xl bg-[#141414] border border-[#2a2a2a] shadow-xl">
                      {/* Header de la fecha */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#262626] mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                          <div>
                            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#E50914]" />
                              <span>Agenda del Día:</span>
                              <span className="font-mono text-emerald-400">{selectedCalendarDate}</span>
                            </h3>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {dayAccounts.length} cuentas vencen hoy • {dayReminders.length} recordatorios programados
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* COLUMNA 1: CUENTAS QUE VENCEN ESTE DÍA */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5 text-[#E50914]" />
                              <span>Cuentas por Vencer ({dayAccounts.length})</span>
                            </span>
                          </div>

                          {dayAccounts.length === 0 ? (
                            <div className="p-6 rounded-xl bg-[#101010] border border-dashed border-[#2a2a2a] text-center text-xs text-zinc-500">
                              No hay cuentas de streaming programadas para vencer el {selectedCalendarDate}.
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {dayAccounts.map((acc) => (
                                <div
                                  key={acc.id}
                                  className="p-3.5 rounded-xl bg-[#101010] border border-[#282828] hover:border-[#E50914]/40 transition flex flex-col justify-between"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${acc.platformColor}`}>
                                        {acc.platform}
                                      </span>
                                      <div className="font-mono text-xs font-bold text-white mt-1 break-all">
                                        {acc.email}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 mt-0.5">
                                        Vendedor: <span className="text-zinc-200 font-semibold">{acc.seller}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30 animate-pulse">
                                        Vence Hoy
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2.5 border-t border-[#222222] flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setTestEmail(acc.email);
                                        const codigosEl = document.getElementById("codigos-owner");
                                        codigosEl?.scrollIntoView({ behavior: "smooth" });
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#E50914] hover:bg-[#f40612] rounded-lg flex items-center gap-1 transition"
                                      title="Extraer código de esta cuenta"
                                    >
                                      <Zap className="w-3 h-3" />
                                      <span>Código</span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenCreateSale(acc)}
                                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 transition"
                                    >
                                      <DollarSign className="w-3 h-3" />
                                      <span>Vender</span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditModal(acc)}
                                      className="px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-[#222222] hover:bg-zinc-700 rounded-lg transition"
                                    >
                                      <Edit className="w-3 h-3 inline" />
                                      <span>Renovar</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* COLUMNA 2: RECORDATORIOS Y NOTAS OPERATIVAS */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Pin className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Recordatorios ({dayReminders.length})</span>
                            </span>
                          </div>

                          {/* Lista de recordatorios del día */}
                          <div className="space-y-2 mb-4">
                            {dayReminders.length === 0 ? (
                              <div className="p-4 rounded-xl bg-[#101010] border border-dashed border-[#2a2a2a] text-center text-xs text-zinc-500">
                                Sin recordatorios para esta fecha. Usa el formulario de abajo para agregar uno.
                              </div>
                            ) : (
                              dayReminders.map((rem) => {
                                const priorityColors = {
                                  urgente: "bg-red-950 text-red-400 border-red-500/30",
                                  alta: "bg-amber-950 text-amber-400 border-amber-500/30",
                                  normal: "bg-blue-950 text-blue-400 border-blue-500/30"
                                };

                                const categoryLabels = {
                                  renovacion: "Renovación",
                                  cobro: "Cobro",
                                  proveedor: "Proveedor",
                                  general: "General"
                                };

                                return (
                                  <div
                                    key={rem.id}
                                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                                      rem.completed
                                        ? "bg-[#101010] border-[#222222] opacity-60"
                                        : "bg-[#101010] border-[#2c2c2c] hover:border-zinc-600"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleReminder(rem.id)}
                                        className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                                          rem.completed
                                            ? "bg-emerald-600 text-white"
                                            : "border border-zinc-600 hover:border-emerald-500 text-transparent"
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <div className={`text-xs font-semibold text-white break-words ${rem.completed ? "line-through text-zinc-500" : ""}`}>
                                          {rem.title}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${priorityColors[rem.priority]}`}>
                                            {rem.priority}
                                          </span>
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#202020] text-zinc-400 border border-[#333333]">
                                            {categoryLabels[rem.category]}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReminder(rem.id)}
                                      className="text-zinc-600 hover:text-red-400 p-1 rounded transition"
                                      title="Eliminar recordatorio"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Formulario para agregar recordatorio a esta fecha */}
                          <form onSubmit={handleAddReminder} className="p-3.5 rounded-xl bg-[#101010] border border-[#262626]">
                            <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Plus className="w-3 h-3 text-[#E50914]" />
                              <span>Nuevo Recordatorio para {selectedCalendarDate}</span>
                            </div>

                            <input
                              type="text"
                              placeholder="Ej: Cobrar mensualidad a Juan, renovar cuentas Netflix con proveedor..."
                              value={newReminderTitle}
                              onChange={(e) => setNewReminderTitle(e.target.value)}
                              required
                              className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] mb-2.5"
                            />

                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div>
                                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Categoría</label>
                                <select
                                  value={newReminderCategory}
                                  onChange={(e: any) => setNewReminderCategory(e.target.value)}
                                  className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#E50914]"
                                >
                                  <option value="renovacion">Renovación de Cuenta</option>
                                  <option value="cobro">Cobro a Revendedor</option>
                                  <option value="proveedor">Pago a Proveedor</option>
                                  <option value="general">Nota General</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Prioridad</label>
                                <select
                                  value={newReminderPriority}
                                  onChange={(e: any) => setNewReminderPriority(e.target.value)}
                                  className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#E50914]"
                                >
                                  <option value="normal">Normal</option>
                                  <option value="alta">Alta</option>
                                  <option value="urgente">Urgente</option>
                                </select>
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-[#E50914] hover:bg-[#f40612] text-white font-bold text-xs rounded-xl shadow-md shadow-red-950/60 transition active:scale-95 flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Guardar Recordatorio</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* VISTA 2: LISTADO DE PRÓXIMOS 7 DÍAS */}
            {calendarViewTab === "proximos" && (
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#2a2a2a]">
                <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Cuentas que vencen en los próximos 7 días ({expiringSoonAccounts.length})
                    </h3>
                  </div>
                </div>

                {expiringSoonAccounts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Todo al día. No hay cuentas por vencer en los próximos 7 días.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {expiringSoonAccounts.map((acc) => {
                      const exp = new Date(acc.expirationDate);
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      exp.setHours(0,0,0,0);
                      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));

                      return (
                        <div key={acc.id} className="p-4 rounded-xl bg-[#181818] border border-amber-500/30 flex flex-col justify-between shadow-lg">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${acc.platformColor}`}>
                                {acc.platform}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                                {diffDays === 0 ? "Vence Hoy" : `En ${diffDays} días`}
                              </span>
                            </div>
                            <div className="font-mono text-xs font-bold text-white break-all">{acc.email}</div>
                            <div className="text-[11px] text-zinc-400 mt-1">
                              Vendedor: <span className="text-zinc-200">{acc.seller}</span> • Vence: <span className="text-amber-400 font-mono font-bold">{acc.expirationDate}</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-[#262626] flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTestEmail(acc.email);
                                const codigosEl = document.getElementById("codigos-owner");
                                codigosEl?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#E50914] hover:bg-[#f40612] rounded-lg flex items-center gap-1 transition"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Código</span>
                            </button>
                            <button
                              onClick={() => handleOpenCreateSale(acc)}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                            >
                              Vender
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(acc)}
                              className="px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-[#222222] hover:bg-zinc-700 rounded-lg"
                            >
                              Renovar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VISTA 3: TODOS LOS RECORDATORIOS GLOBALES */}
            {calendarViewTab === "recordatorios" && (
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#2a2a2a]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626] mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Lista General de Recordatorios ({calendarReminders.length})
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setReminderFilter("all")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${reminderFilter === "all" ? "bg-[#E50914] text-white" : "bg-[#222222] text-zinc-400"}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setReminderFilter("pending")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${reminderFilter === "pending" ? "bg-[#E50914] text-white" : "bg-[#222222] text-zinc-400"}`}
                    >
                      Pendientes
                    </button>
                    <button
                      onClick={() => setReminderFilter("completed")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${reminderFilter === "completed" ? "bg-[#E50914] text-white" : "bg-[#222222] text-zinc-400"}`}
                    >
                      Completados
                    </button>
                  </div>
                </div>

                {calendarReminders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    No tienes ningún recordatorio registrado. Selecciona una fecha en el calendario para crear uno.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calendarReminders
                      .filter(r => {
                        if (reminderFilter === "pending") return !r.completed;
                        if (reminderFilter === "completed") return r.completed;
                        return true;
                      })
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((rem) => (
                        <div
                          key={rem.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                            rem.completed ? "bg-[#101010] border-[#222222] opacity-60" : "bg-[#181818] border-[#2c2c2c]"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleReminder(rem.id)}
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                                rem.completed ? "bg-emerald-600 text-white" : "border border-zinc-600 hover:border-emerald-500 text-transparent"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className={`text-xs font-bold text-white break-words ${rem.completed ? "line-through text-zinc-500" : ""}`}>
                                {rem.title}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 flex-wrap">
                                <span className="font-mono text-emerald-400 bg-black/60 px-2 py-0.5 rounded border border-zinc-700 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                                  <span>{rem.date}</span>
                                </span>
                                <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                  rem.priority === "urgente" ? "bg-red-950 text-red-400" : rem.priority === "alta" ? "bg-amber-950 text-amber-400" : "bg-blue-950 text-blue-400"
                                }`}>
                                  {rem.priority}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-[#202020] text-zinc-300">
                                  {rem.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCalendarDate(rem.date);
                                setCalendarViewTab("cuentas");
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:text-white bg-[#222222] hover:bg-zinc-700 rounded-lg transition"
                            >
                              Ver Día
                            </button>
                            <button
                              onClick={() => handleDeleteReminder(rem.id)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* SECCIÓN 3: GESTOR Y PROBADOR MAESTRO DE CÓDIGOS */}
        {(activeTab === "codigos" || activeTab === "todo") && (
          <section id="codigos-owner" className="bg-[#181818] border border-[#E50914]/40 rounded-2xl p-3.5 sm:p-6 mb-8 shadow-2xl relative overflow-hidden max-w-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[#282828]">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#E50914]" />
                    <span>Extractor y Probador de Códigos en Vivo</span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Consulta directa e instantánea de cualquier correo o servicio sin restricciones de vendedor ni expiración
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Correo de la Cuenta
                </label>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ej: hogaryutu+acido@gmail.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914] font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Servicio
                </label>
                <select
                  value={testService}
                  onChange={(e) => setTestService(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E50914]"
                >
                  <option value="netflix">Netflix</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Acción Requerida (Netflix)
                </label>
                <select
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E50914]"
                >
                  <option value="login_code">Código de inicio de sesión (4 dígitos)</option>
                  <option value="verification_code">Código de verificación (15 minutos)</option>
                  <option value="actualizar_hogar">Solicitar actualizar hogar netflix (link)</option>
                  <option value="acceso_temporal">Código de acceso temporal (link)</option>
                  <option value="reset_password">Restablecer contraseña (link)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleExecuteCodeTest}
                disabled={isTestingCode || !testEmail.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#E50914] hover:bg-[#f40612] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 transition active:scale-95 disabled:opacity-50"
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
                <span className="text-zinc-500 text-[11px] font-medium">Rápido:</span>
                {accounts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setTestEmail(a.email)}
                    className="px-2 py-1 bg-[#222222] hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-mono truncate max-w-[170px] border border-zinc-700"
                  >
                    {a.email}
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado de la extracción */}
            {testResult && (
              <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-[#2a2a2a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Resultado Obtenido:</span>
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
                      className="px-3.5 py-1.5 bg-[#E50914] hover:bg-[#f40612] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-lg rounded-2xl p-6 shadow-2xl shadow-black/90 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-1.5 h-5 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                <h3 className="text-xl font-black text-white tracking-tight">
                  {editingAccountId ? "Editar Cuenta Maestra" : "Nueva Cuenta Maestra"}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-6 pl-4">
                Ingresa las credenciales y la configuración de perfiles para tu catálogo
              </p>

              <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Plataforma</label>
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
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  >
                    {catalogPlatforms.map((p) => (
                      <option key={p.id || p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Correo de la Cuenta (+embudos permitidos)</label>
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      placeholder="ej: cuenta+embudo@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Contraseña</label>
                    <input
                      type="text"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">País / Región</label>
                    <input
                      type="text"
                      placeholder="ej: Colombia, México, Global"
                      value={formData.country || ""}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">¿Está Verificada?</label>
                    <select
                      value={formData.isVerified}
                      onChange={(e) => setFormData({ ...formData, isVerified: e.target.value as any })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    >
                      <option value="verified">🟢 Funciona (Comprobada / Verificada)</option>
                      <option value="payment_failed">🔴 Caída por pago</option>
                      <option value="unreviewed">🟡 Sin revisar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Cliente / Vendido a (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: Juan Pérez (WhatsApp)"
                      value={formData.customerName || ""}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Cupo Máximo Perfiles</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.maxProfiles}
                      onChange={(e) => setFormData({ ...formData, maxProfiles: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Perfiles Vendidos</label>
                    <input
                      type="number"
                      min={0}
                      max={formData.maxProfiles}
                      value={formData.profilesOccupied}
                      onChange={(e) => setFormData({ ...formData, profilesOccupied: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Fecha de Compra</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Costo Mensual ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.monthlyCost}
                      onChange={(e) => setFormData({ ...formData, monthlyCost: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Ingreso Esperado ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Vendedor Asignado</label>
                    <select
                      value={formData.seller}
                      onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    >
                      <option value="Sin Asignar (En Stock)">Sin Asignar (En Stock)</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Notas / Observaciones</label>
                    <input
                      type="text"
                      placeholder="ej: Cuenta familiar, renovar el día 30"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 transition"
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black/90 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center border border-red-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Asignar Cuenta a Vendedor</h3>
                  <p className="text-xs text-zinc-400">{assigningAccount.platform} • {assigningAccount.email}</p>
                </div>
              </div>

              <div className="space-y-3 my-5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Selecciona el Vendedor Responsable
                </label>
                <div className="space-y-2">
                  <div
                    onClick={() => setSelectedSellerToAssign("")}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedSellerToAssign === ""
                        ? "bg-red-950/40 border-[#E50914] text-white"
                        : "bg-[#121212] border-[#2a2a2a] text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-amber-400">Sin Asignar (Dejar en Stock Libre)</div>
                      <div className="text-[11px] text-zinc-500">Disponible para la tienda general</div>
                    </div>
                    {selectedSellerToAssign === "" && <Check className="w-4 h-4 text-[#E50914]" />}
                  </div>

                  {sellers.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSellerToAssign(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        selectedSellerToAssign === s.id
                          ? "bg-red-950/40 border-[#E50914] text-white"
                          : "bg-[#121212] border-[#2a2a2a] text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-white">{s.name}</div>
                        <div className="text-[11px] text-zinc-500">{s.phone} • {s.activeAccountsCount} cuentas asignadas</div>
                      </div>
                      {selectedSellerToAssign === s.id && <Check className="w-4 h-4 text-[#E50914]" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#282828] text-zinc-300 hover:bg-[#383838] font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 transition"
                >
                  Confirmar Asignación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL IMPORTAR EXCEL / CSV */}
        {isExcelModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-4xl rounded-2xl p-6 shadow-2xl shadow-black/90 relative animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[#262626] pr-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center border border-red-500/30 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                      <h3 className="text-lg font-black text-white">Importar Lista de Cuentas (Excel / CSV)</h3>
                    </div>
                    <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">
                      Sube cuentas masivas con país, verificación, fecha de vencimiento y asignación
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2.5 bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/60 transition active:scale-95 shrink-0"
                  title="Descargar formato oficial de Excel para subir cuentas"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Formato</span>
                </button>
              </div>

              {/* Selector de Plataforma Destino */}
              <div className="mb-4 p-4 rounded-xl bg-[#121212] border border-[#2a2a2a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-semibold text-white block mb-0.5">¿Para qué plataforma es esta lista?</span>
                  <span className="text-[11px] text-zinc-400">
                    Puedes forzar que todas las cuentas sean de una plataforma específica o dejar que se lea de la columna del Excel.
                  </span>
                </div>
                <div className="shrink-0">
                  <select
                    value={selectedImportPlatform}
                    onChange={(e) => setSelectedImportPlatform(e.target.value)}
                    className="w-full sm:w-auto bg-[#1c1c1c] border border-[#383838] rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-[#E50914] shadow-sm"
                  >
                    <option value="auto">Detectar automáticamente (Columna "Plataforma")</option>
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
                    <p className="text-[11px] text-zinc-400 mb-2.5">
                      ¿La lista era para otra plataforma o se subió por equivocación? Puedes borrar el lote completo y se eliminarán todas las cuentas que se importaron en esa carga:
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {validBatches.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-[#141414] border border-[#2a2a2a] text-xs gap-2"
                        >
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-red-950/50 text-red-300 text-[11px] border border-red-500/30">
                                {b.platform}
                              </span>
                              <span>{b.count} cuentas importadas</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span>{b.filename || "Lista"}</span>
                              </span>
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
              <div className="mb-4 p-3.5 rounded-xl bg-[#121212] border border-[#262626] flex items-center justify-between">
                <div className="text-xs text-zinc-300">
                  <span className="font-semibold text-white block">Formato Oficial de Excel para Cuentas</span>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Incluye columnas: <span className="text-emerald-400 font-mono">País, Plataforma, Correo, Clave, Verificada (Sí/No), Fecha Vencimiento, Vendido a / Asignado a, Perfiles, Notas</span>.
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-[#222222] hover:bg-[#333333] text-zinc-200 border border-[#3a3a3a] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ml-3 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla .xlsx</span>
                </button>
              </div>

              {/* Zona de Drop / Input de archivo */}
              <div className="border-2 border-dashed border-[#333333] hover:border-[#E50914] rounded-2xl p-6 text-center transition bg-[#121212] cursor-pointer relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-[#E50914] mx-auto mb-2 opacity-80 group-hover:scale-110 transition" />
                <div className="text-sm font-semibold text-white">
                  {excelFile ? excelFile.name : "Selecciona o arrastra tu archivo Excel / CSV aquí"}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
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
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-2">
                    <span className="flex items-center gap-2">
                      <span>Vista Previa del Archivo ({excelPreviewData.length} cuentas detectadas)</span>
                      {selectedImportPlatform !== "auto" && (
                        <span className="px-2 py-0.5 rounded bg-red-950/50 text-red-300 border border-red-500/30 text-[10px]">
                          Asignando a: {selectedImportPlatform}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Archivo listo para procesar</span>
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-[#2a2a2a] rounded-xl bg-[#121212]">
                    <table className="w-full text-left text-[11px] text-zinc-300">
                      <thead className="bg-[#0e0e0e] text-zinc-400 sticky top-0 border-b border-[#262626]">
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
                      <tbody className="divide-y divide-[#262626]">
                        {excelPreviewData.slice(0, 20).map((row: any, i) => {
                          const rawVer = String(row["Verificada (Sí/No)"] || row["Verificada"] || row["Verificado"] || row["Sirve"] || row["Estado de Verificación"] || "Sí").toLowerCase();
                          let verStatus: "verified" | "payment_failed" | "unreviewed" = "verified";
                          if (rawVer.includes("caida") || rawVer.includes("pago") || rawVer.includes("no") || rawVer === "false" || rawVer === "0" || rawVer.includes("falla")) {
                            verStatus = "payment_failed";
                          } else if (rawVer.includes("sin") || rawVer.includes("revisar") || rawVer.includes("pendiente") || rawVer.includes("amarill")) {
                            verStatus = "unreviewed";
                          }
                          const platDisplay = selectedImportPlatform !== "auto" 
                            ? selectedImportPlatform 
                            : (row["Plataforma"] || row["Servicio"] || "Netflix");
                          const assignedCol = row["Vendido a / Asignado a"] || row["Vendido a"] || row["Cliente"] || row["Vendedor"] || "Sin Asignar";

                          return (
                            <tr key={i} className="hover:bg-[#1a1a1a]">
                              <td className="py-2 px-3 font-semibold text-cyan-300">
                                <span className="inline-flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-cyan-400/80 shrink-0" />
                                  <span>{row["País"] || row["Pais"] || row["Country"] || "Global"}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-white">
                                {platDisplay}
                              </td>
                              <td className="py-2 px-3 font-mono text-zinc-200">
                                {row["Correo"] || row["Email"] || "-"}
                              </td>
                              <td className="py-2 px-3 font-mono text-zinc-400">
                                {row["Clave"] || row["Contraseña"] || "••••••••"}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {verStatus === "verified" && (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse"></span>
                                    <span>Verificada</span>
                                  </span>
                                )}
                                {verStatus === "payment_failed" && (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] text-rose-300 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80"></span>
                                    <span>Caída por pago</span>
                                  </span>
                                )}
                                {verStatus === "unreviewed" && (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/80"></span>
                                    <span>Sin revisar</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-zinc-400 font-mono">
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
              <div className="mt-6 pt-4 border-t border-[#262626] flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={excelPreviewData.length === 0 || isImporting}
                  onClick={handleProcessExcelImport}
                  className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 flex items-center gap-1.5 transition disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black/90 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsSellerModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center border border-red-500/30">
                  {editingSellerId ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h3 className="text-lg font-black text-white">
                      {editingSellerId ? "Editar Vendedor" : "Registrar Nuevo Vendedor"}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">
                    {editingSellerId 
                      ? "Modifica los datos de acceso y contacto del vendedor" 
                      : "Crea un vendedor para que pueda iniciar sesión y recibir cuentas"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSeller} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Nombre Completo del Vendedor</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Andrés Ventas"
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Usuario / Correo Electrónico (Para Iniciar Sesión)</label>
                  <HogarProEmailInput
                    value={newSellerEmail}
                    onChange={(email) => setNewSellerEmail(email)}
                    placeholder="ej: andres"
                    required
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Correo oficial de acceso: <span className="text-red-400 font-mono font-medium">{newSellerEmail || "usuario@hogarpro.com"}</span>
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Contraseña de Acceso para el Vendedor</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: ClaveVentas2026*"
                    value={newSellerPassword}
                    onChange={(e) => setNewSellerPassword(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Teléfono / WhatsApp (LATAM)</label>
                  <LatamPhoneInput
                    value={newSellerPhone}
                    onChange={(phone) => setNewSellerPhone(phone)}
                    placeholder="412 000 1122"
                  />
                </div>

                <div className="pt-4 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSellerModalOpen(false);
                      setEditingSellerId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 transition"
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-lg rounded-2xl p-6 shadow-2xl shadow-black/90 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center border border-red-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h3 className="text-lg font-black text-white">
                      {editingPlatformId ? "Editar Servicio en Catálogo" : "Nuevo Servicio de Streaming"}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">
                    Configura el nombre, precio al público, costo base y cupos para este servicio
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePlatform} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Nombre de la Plataforma / Plan</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Netflix Premium 4K Pantallas Extra"
                    value={platformForm.name}
                    onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] font-medium"
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
                      className="w-full bg-[#121212] border border-emerald-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
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
                      className="w-full bg-[#121212] border border-purple-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Costo Base Invertido ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={platformForm.defaultCost}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultCost: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Cupos / Perfiles por Defecto</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      required
                      value={platformForm.defaultProfiles}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultProfiles: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Etiqueta Destacada (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: Más Vendido, 4K UHD"
                      value={platformForm.badge || ""}
                      onChange={(e) => setPlatformForm({ ...platformForm, badge: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Categoría / Subtítulo</label>
                    <input
                      type="text"
                      placeholder="ej: 4K HDR • 1 Pantalla Individual"
                      value={platformForm.category || ""}
                      onChange={(e) => setPlatformForm({ ...platformForm, category: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCatalogModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 transition"
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-xl rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/90 relative my-8 animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-md">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h3 className="text-lg font-black text-white">
                      Registrar Venta en el Libro
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">
                    Venta al detal, venta al mayor o cobro en persona con ganancia personalizada
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSale} className="space-y-4 text-xs">
                {/* Selector Tipo de Venta: Detal vs Mayor */}
                <div>
                  <label className="block font-bold text-zinc-300 uppercase tracking-wider text-[11px] mb-1.5">
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
                          : "bg-[#121212] border-[#282828] text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs">Venta al Detal</span>
                      <span className="text-[10px] text-zinc-400">Cliente final / 1 perfil / en mano</span>
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
                          : "bg-[#121212] border-[#282828] text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-xs">Venta al Mayor</span>
                      <span className="text-[10px] text-zinc-400">Revendedor / Lote / Descuento</span>
                    </button>
                  </div>
                </div>

                {/* Venta en persona (física) checkbox pill */}
                <div className="p-3 rounded-xl bg-[#121212] border border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">¿Venta realizada en persona física?</div>
                      <div className="text-[11px] text-zinc-400">Se computará en la caja física de efectivo</div>
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
                    <div className="w-9 h-5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Plataforma & Cuenta Asociada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Plataforma</label>
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
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {catalogPlatforms.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Vincular Cuenta de Stock</label>
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
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
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
                    <label className="block font-medium text-zinc-300 mb-1">Correo o Identificador de Cuenta (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: cliente.netflix@gmail.com"
                      value={saleForm.accountEmail}
                      onChange={(e) => setSaleForm({ ...saleForm, accountEmail: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}

                {/* Cliente & Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Nombre del Cliente / Comprador *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej: Juan Pérez (En persona)"
                      value={saleForm.customerName}
                      onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">WhatsApp / Contacto (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej: +57 300 123 4567"
                      value={saleForm.customerContact}
                      onChange={(e) => setSaleForm({ ...saleForm, customerContact: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Método de Pago</label>
                  <select
                    value={saleForm.paymentMethod}
                    onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="efectivo">Efectivo (Dinero en Mano)</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="binance">Binance / Cripto (USDT)</option>
                    <option value="otro">Otro Método</option>
                  </select>
                </div>

                {/* CÁLCULO FINANCIERO Y GANANCIA PERSONALIZADA */}
                <div className="p-3.5 rounded-xl bg-[#141414] border border-emerald-500/30">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Finanzas de la Venta (Ganancia en Tiempo Real)</span>
                    <span className="text-zinc-400 text-[10px] lowercase">editable libremente</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1 font-medium">Costo Invertido ($)</label>
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
                        className="w-full bg-[#181818] border border-[#2f2f2f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1 font-medium">Precio Cobrado ($)</label>
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
                        className="w-full bg-[#181818] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
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
                  <p className="text-[10px] text-zinc-400 mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>La ganancia se calcula como (Precio Cobrado - Costo), pero puedes modificarla directamente si cobraste un recargo o ajuste.</span>
                  </p>
                </div>

                {/* Notas */}
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Notas / Detalles del Pedido (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: Perfil 3, PIN 1234, entregado personalmente en oficina"
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSaleModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
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

        {/* MODAL REGISTRAR / EDITAR GASTO OPERATIVO */}
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-[#282828] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {editingExpenseId ? "Editar Registro de Gasto" : "Registrar Nuevo Gasto Operativo"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Este gasto se deducirá de las ganancias netas en tus balances y gráficas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-5 space-y-4 text-xs">
                {/* Fecha y Categoría */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Fecha del Gasto</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Categoría</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="proveedor">Proveedor de Cuentas / Lotes</option>
                      <option value="publicidad">Publicidad & Marketing</option>
                      <option value="servicios">Servicios / Hosting / Proxies</option>
                      <option value="comision">Comisiones a Vendedores</option>
                      <option value="operativo">Operativo / Oficina</option>
                      <option value="otro">Otro Gasto</option>
                    </select>
                  </div>
                </div>

                {/* Concepto / Título */}
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Concepto o Descripción *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Lote 10 cuentas Netflix Premium a proveedor mayorista"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Monto y Método de Pago */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Monto del Gasto ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseForm.amount || ""}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                      className="w-full bg-[#121212] border border-rose-500/50 rounded-xl px-3 py-2 text-rose-300 font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Método de Pago</label>
                    <select
                      value={expenseForm.paymentMethod}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="binance">Binance (USDT / Cripto)</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Proveedor / Beneficiario */}
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Proveedor / Beneficiario (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: MegaStream Proveedor, Meta Ads, Hostinger..."
                    value={expenseForm.supplier}
                    onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Notas Adicionales (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Detalles sobre garantía, ID de transacción, etc."
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingExpenseId ? "Actualizar Gasto" : "Guardar Gasto"}</span>
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
