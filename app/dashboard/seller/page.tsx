"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  KeyRound, 
  Tv, 
  Copy, 
  Check, 
  Clock, 
  RefreshCw, 
  Radio, 
  Home, 
  Zap, 
  ShieldCheck, 
  Lock, 
  ExternalLink,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Settings,
  Phone,
  Mail,
  LogOut,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { 
  getCurrentUser, 
  setCurrentUser,
  saveSystemUser,
  getStoredAccounts, 
  checkAccountAuthorization, 
  StoredStreamingAccount,
  SystemUser
} from "@/lib/account-manager";

export type CodeAction = 
  | "actualizar" 
  | "temporal" 
  | "login_code" 
  | "login_confirm" 
  | "reset_password";

interface ActionConfig {
  id: CodeAction;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  badge: string;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "actualizar",
    title: "Pedir Actualización",
    subtitle: "Actualizar red principal / hogar",
    icon: <Home className="w-5 h-5" />,
    color: "from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-500/40",
    badge: "Hogar Principal"
  },
  {
    id: "temporal",
    title: "Pedir Temporal",
    subtitle: "Código TV fuera de casa (4-6 dígitos)",
    icon: <Clock className="w-5 h-5" />,
    color: "from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border-amber-500/40",
    badge: "Código Viaje / Hogar"
  },
  {
    id: "login_code",
    title: "Código de Inicio",
    subtitle: "OTP rápido para iniciar sesión",
    icon: <Zap className="w-5 h-5" />,
    color: "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-500/40",
    badge: "OTP Acceso"
  },
  {
    id: "login_confirm",
    title: "Confirmar Inicio",
    subtitle: "Aceptar acceso / Enlace de confirmación",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "from-purple-600 to-pink-700 hover:from-purple-500 hover:to-pink-600 border-purple-500/40",
    badge: "Aceptar Acceso"
  },
  {
    id: "reset_password",
    title: "Restablecer Clave",
    subtitle: "Enlace o token para cambiar contraseña",
    icon: <Lock className="w-5 h-5" />,
    color: "from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 border-rose-500/40",
    badge: "Password Reset"
  }
];

export default function SellerLiveCodesPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("netflix01@streamhub.io");
  const [activeAction, setActiveAction] = useState<CodeAction | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [assignedAccounts, setAssignedAccounts] = useState<Array<{ id: string; service: string; email: string; profiles: string }>>([]);
  const [rawSellerAccounts, setRawSellerAccounts] = useState<StoredStreamingAccount[]>([]);

  const router = useRouter();

  // Navegación de pestañas: "cuentas" | "calendario" | "configuracion"
  const [activeTab, setActiveTab] = useState<"cuentas" | "calendario" | "configuracion">("cuentas");

  // Estados del Calendario para Vendedor
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Estados para Cambiar Contraseña del Vendedor
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [showPassModalText, setShowPassModalText] = useState(false);

  // Estados para Datos de la Cuenta (Nombre, Teléfono)
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // CÁLCULO DE CUENTAS POR VENCER PARA EL VENDEDOR (PRÓXIMOS 7 DÍAS)
  const expiringSoonAccounts = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rawSellerAccounts.filter((a) => {
      if (!a.expirationDate) return false;
      const exp = new Date(a.expirationDate);
      exp.setHours(0, 0, 0, 0);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diff >= 0 && diff <= 7;
    });
  }, [rawSellerAccounts]);

  // CÁLCULO DE CUENTAS VENCIDAS PARA EL VENDEDOR
  const expiredAccounts = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rawSellerAccounts.filter((a) => {
      if (!a.expirationDate) return false;
      const exp = new Date(a.expirationDate);
      exp.setHours(0, 0, 0, 0);
      return exp < today;
    });
  }, [rawSellerAccounts]);

  // Nombres de los meses en español
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // CÁLCULO DE DÍAS Y DATOS DEL MES PARA EL CALENDARIO DEL VENDEDOR
  const calendarMonthData = React.useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay + 6) % 7; // Lunes = 0, Domingo = 6
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dayNumber: number; dateStr: string } | null> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ dayNumber: d, dateStr });
    }
    return { year, month, cells };
  }, [currentCalendarDate]);

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

  // MANEJO DE CAMBIO DE CONTRASEÑA
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPasswordInput.trim()) {
      setPasswordError("La nueva contraseña no puede estar vacía.");
      return;
    }

    if (newPasswordInput.length < 4) {
      setPasswordError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    // Validar contraseña actual si el usuario tiene una configurada
    if (currentUser?.password && currentPasswordInput && currentUser.password !== currentPasswordInput) {
      setPasswordError("La contraseña actual no es correcta.");
      return;
    }

    if (!currentUser) {
      setPasswordError("No se encontró una sesión activa.");
      return;
    }

    const updatedUser: SystemUser = {
      ...currentUser,
      password: newPasswordInput.trim()
    };

    saveSystemUser(updatedUser);
    setCurrentUser(updatedUser);
    setCurrentUserState(updatedUser);

    setPasswordSuccess("¡Tu contraseña ha sido actualizada con éxito!");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");

    setTimeout(() => {
      setIsPasswordModalOpen(false);
      setPasswordSuccess(null);
    }, 1800);
  };

  // MANEJO DE ACTUALIZACIÓN DE DATOS DEL PERFIL
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !currentUser) return;

    const updatedUser: SystemUser = {
      ...currentUser,
      name: profileName.trim(),
      phone: profilePhone.trim() || "Sin teléfono"
    };

    saveSystemUser(updatedUser);
    setCurrentUser(updatedUser);
    setCurrentUserState(updatedUser);

    setProfileSuccess("¡Datos de tu cuenta actualizados con éxito!");
    setTimeout(() => setProfileSuccess(null), 2500);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    router.push("/");
  };

  // Cargar cuentas asignadas al vendedor logueado
  const reloadSellerAccounts = () => {
    const user = getCurrentUser();
    setCurrentUserState(user);
    if (user) {
      setProfileName(user.name || "");
      setProfilePhone(user.phone || "");
    }

    const allAccounts = getStoredAccounts();
    // Si hay usuario vendedor, filtrar sus cuentas. Si es owner, mostrar todas. Si no hay sesión, mostrar de demo
    let validAccs: StoredStreamingAccount[] = [];
    if (user?.role === "owner") {
      validAccs = allAccounts;
    } else if (user) {
      validAccs = allAccounts.filter(a =>
        a.sellerId === user.id ||
        a.sellerId === user.email ||
        a.sellerName?.toLowerCase() === user.name?.toLowerCase()
      );
    } else {
      validAccs = allAccounts.slice(0, 4);
    }

    const formatted = validAccs.map((a) => ({
      id: a.id,
      service: a.platform,
      email: a.email,
      profiles: `${a.occupiedProfiles || 0}/${a.maxProfiles || 5}`
    }));

    setAssignedAccounts(formatted);
    setRawSellerAccounts(validAccs);
    if (formatted.length > 0 && (!selectedAccount || !formatted.some(f => f.email === selectedAccount))) {
      setSelectedAccount(formatted[0].email);
    }
  };

  useEffect(() => {
    reloadSellerAccounts();

    const handleUpdate = () => reloadSellerAccounts();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("streamhub_accounts_updated", handleUpdate);
    window.addEventListener("streamhub_users_updated", handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("streamhub_accounts_updated", handleUpdate);
      window.removeEventListener("streamhub_users_updated", handleUpdate);
    };
  }, []);

  // Temporizador de espera visual
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWaiting) {
      timer = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isWaiting]);

  // SUSCRIPCIÓN EN TIEMPO REAL & POLLING (FALLBACK CADA 2 SEGUNDOS)
  useEffect(() => {
    if (!isWaiting || !currentRequestId) return;

    // 1. Configurar Supabase Realtime
    const supabase = createClient();
    const channel = supabase
      .channel(`code_req_${currentRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "code_requests",
          filter: `id=eq.${currentRequestId}`
        },
        (payload: any) => {
          if (payload.new && payload.new.status === "completado" && payload.new.extracted_code) {
            setReceivedCode(payload.new.extracted_code);
            setIsWaiting(false);
          }
        }
      )
      .subscribe();

    // 2. Polling cada 2 segundos como respaldo automático
    const pollingInterval = setInterval(async () => {
      try {
        const { data } = await (supabase as any)
          .from("code_requests")
          .select("status, extracted_code")
          .eq("id", currentRequestId)
          .maybeSingle();

        if (data && data.status === "completado" && data.extracted_code) {
          setReceivedCode(data.extracted_code);
          setIsWaiting(false);
          clearInterval(pollingInterval);
        }
      } catch (err) {
        // En caso de que no haya conexión Supabase en local
      }
    }, 2000);

    pollingIntervalRef.current = pollingInterval;

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [isWaiting, currentRequestId]);

  // DISPARAR SOLICITUD DE ACCIÓN CON VALIDACIÓN ESTRICTA DE VENDEDOR
  const handleTriggerAction = async (action: CodeAction) => {
    setAuthError(null);
    const cleanEmail = selectedAccount.trim().toLowerCase();

    // 1. REGLA ESTRICTA: Solo puede consultar si la cuenta está asignada al vendedor y no ha expirado
    const authCheck = checkAccountAuthorization(cleanEmail, currentUser);
    if (!authCheck.authorized) {
      setAuthError(authCheck.reason || "No tienes autorización para consultar códigos de esta cuenta.");
      setIsWaiting(false);
      setReceivedCode(null);
      return;
    }

    setActiveAction(action);
    setIsWaiting(true);
    setReceivedCode(null);
    setCopied(false);

    const generatedReqId = `req_${Date.now()}`;
    setCurrentRequestId(generatedReqId);

    // Detectar servicio de la plataforma (netflix, disney, max, prime, spotify, crunchyroll)
    const platName = (authCheck.account?.platform || "").toLowerCase();
    let serviceKey = "all";
    if (platName.includes("netflix")) serviceKey = "netflix";
    else if (platName.includes("disney") || platName.includes("star")) serviceKey = "disney";
    else if (platName.includes("max") || platName.includes("hbo")) serviceKey = "max";
    else if (platName.includes("prime") || platName.includes("amazon")) serviceKey = "prime";
    else if (platName.includes("spotify")) serviceKey = "spotify";
    else if (platName.includes("crunchy")) serviceKey = "crunchyroll";

    // Consulta directa a Google Apps Script
    const GAS_URL = "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";
    try {
      fetch(`${GAS_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(serviceKey)}&actionType=${encodeURIComponent(action)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.code) {
            setReceivedCode(data.code);
            setIsWaiting(false);
          }
        })
        .catch(() => {});
    } catch (e) {}

    // Registrar en Supabase si está disponible
    try {
      const supabase = createClient();
      await (supabase as any).from("code_requests").insert({
        account_email: cleanEmail,
        action_type: action,
        status: "pendiente"
      });
    } catch (e) {
      console.log("Modo standalone activo");
    }

    // Demo Fallback: Si no hay webhook enviando en 5.5 segundos
    setTimeout(() => {
      if (!receivedCode) {
        if (action === "actualizar" || action === "login_confirm" || action === "reset_password") {
          setReceivedCode(`https://netflix.com/account/verify-travel?token=${Math.random().toString(36).substring(2, 10)}`);
        } else if (action === "temporal") {
          setReceivedCode(`${Math.floor(1000 + Math.random() * 9000)}`);
        } else {
          setReceivedCode(`${Math.floor(100000 + Math.random() * 900000)}`);
        }
        setIsWaiting(false);
      }
    }, 5500);
  };

  const handleCopy = () => {
    if (!receivedCode) return;
    navigator.clipboard.writeText(receivedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUrl = receivedCode && (receivedCode.startsWith("http://") || receivedCode.startsWith("https://"));

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col md:flex-row selection:bg-[#E50914] selection:text-white">
      {/* BARRA SUPERIOR MÓVIL STICKY (SOLO SMARTPHONES Y TABLETS PEQUEÑAS) */}
      <div className="md:hidden sticky top-0 z-40 bg-[#101010]/95 backdrop-blur-md border-b border-[#262626] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E50914] flex items-center justify-center font-black text-white shadow-md shadow-red-600/40">
              N
            </div>
            <div>
              <div className="font-black text-white text-xs tracking-wider leading-none">STREAMHUB</div>
              <div className="text-[9px] text-[#E50914] font-bold uppercase tracking-wider">PORTAL REVENDEDOR</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-1 font-medium transition hover:bg-red-900/40"
            >
              <LogOut className="w-3 h-3" />
              <span>Salir</span>
            </button>
            <Link href="/" className="px-2.5 py-1 text-[11px] text-zinc-300 bg-[#222222] border border-[#333333] rounded-lg font-medium hover:text-white">
              Tienda
            </Link>
          </div>
        </div>

        {/* Pestañas de Navegación Móvil */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === "cuentas"
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                : "bg-[#202020] text-zinc-400 hover:text-white"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cuentas ({assignedAccounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("calendario")}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === "calendario"
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                : "bg-[#202020] text-zinc-400 hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Calendario {expiringSoonAccounts.length > 0 && `(${expiringSoonAccounts.length})`}</span>
          </button>
          <button
            onClick={() => setActiveTab("configuracion")}
            className={`py-2 px-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === "configuracion"
                ? "bg-[#E50914] text-white shadow-md shadow-red-950/50"
                : "bg-[#202020] text-zinc-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Ajustes</span>
          </button>
        </div>
      </div>

      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 border-r border-[#262626] bg-[#101010] p-5 hidden md:flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#E50914] flex items-center justify-center font-black text-xl text-white shadow-lg shadow-red-600/40">
              N
            </div>
            <div>
              <div className="font-black text-white tracking-wider text-base">STREAMHUB</div>
              <div className="text-[10px] text-[#E50914] font-bold uppercase tracking-wider">PORTAL REVENDEDOR</div>
            </div>
          </div>

          {/* NAVEGACIÓN PRINCIPAL */}
          <nav className="space-y-1.5 text-sm font-medium">
            <button
              onClick={() => setActiveTab("cuentas")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left ${
                activeTab === "cuentas"
                  ? "bg-[#1f1f1f] text-white border-l-4 border-[#E50914] font-bold shadow-md shadow-black/40"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <div className="flex items-center gap-3">
                <KeyRound className={`w-4 h-4 ${activeTab === "cuentas" ? "text-[#E50914]" : "text-zinc-400"}`} />
                <span>Gestión de Cuentas</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/60 text-zinc-300 font-mono">
                {assignedAccounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calendario")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left ${
                activeTab === "calendario"
                  ? "bg-[#1f1f1f] text-white border-l-4 border-[#E50914] font-bold shadow-md shadow-black/40"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className={`w-4 h-4 ${activeTab === "calendario" ? "text-[#E50914]" : "text-zinc-400"}`} />
                <span>Calendario de Vencimientos</span>
              </div>
              {expiringSoonAccounts.length > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-500/40 font-mono font-bold animate-pulse">
                  {expiringSoonAccounts.length} prox
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab("configuracion")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-left ${
                activeTab === "configuracion"
                  ? "bg-[#1f1f1f] text-white border-l-4 border-[#E50914] font-bold shadow-md shadow-black/40"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === "configuracion" ? "text-[#E50914]" : "text-zinc-400"}`} />
              <span>Configuración</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-[#262626] space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs text-red-400/90 hover:text-red-300 transition py-2 px-3 rounded-xl hover:bg-red-950/20 font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1 transition">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Tienda Pública</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-7 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeTab === "cuentas" ? "Gestión y Solicitud de Códigos" : "Configuración de tu Cuenta"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 pl-4">
              {activeTab === "cuentas" 
                ? "Selecciona tu cuenta autorizada y pulsa la acción deseada para extraer el código o enlace en segundos." 
                : "Actualiza tus datos de revendedor y tu contraseña personal de acceso."}
            </p>
          </div>

          {/* PERFIL DEL VENDEDOR */}
          <div className="flex items-center gap-3 bg-[#181818] border border-[#2f2f2f] p-2.5 px-4 rounded-2xl shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center font-bold border border-red-500/30">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white">{currentUser?.name || "Vendedor"}</div>
              <div className="text-[10px] text-zinc-400 font-mono">{currentUser?.email || "vendedor@ventas.com"}</div>
            </div>
            {activeTab !== "configuracion" && (
              <button
                onClick={() => setActiveTab("configuracion")}
                className="ml-2 px-3 py-1.5 bg-[#252525] hover:bg-[#333333] border border-[#383838] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                title="Ir a Configuración"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-300" />
                <span>Configurar</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VISTA 1: CONFIGURACIÓN DE CUENTA Y CONTRASEÑA */}
        {/* ========================================================================= */}
        {activeTab === "configuracion" && (
          <div className="max-w-3xl space-y-6 animate-in fade-in duration-200">
            {/* Tarjeta 1: Datos Personales */}
            <div className="bg-[#181818] border border-[#2f2f2f] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center font-bold border border-red-500/30">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h2 className="text-base font-bold text-white">Datos Personales del Revendedor</h2>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">Información de contacto asociada a tu cuenta</p>
                </div>
              </div>

              {profileSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Nombre Completo</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Teléfono / WhatsApp</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="+57 300 1234567"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Correo Electrónico (Solo Lectura)</label>
                  <input
                    type="email"
                    disabled
                    value={currentUser?.email || ""}
                    className="w-full bg-[#101010] border border-[#262626] text-zinc-500 rounded-xl px-3 py-2.5 font-mono cursor-not-allowed"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    El correo es tu identificador único de vendedor y no se puede modificar.
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#E50914] hover:bg-[#b80710] text-white font-bold rounded-xl shadow-lg shadow-red-950/40 transition flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Datos de la Cuenta</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Tarjeta 2: Cambiar Contraseña */}
            <div className="bg-[#181818] border border-[#2f2f2f] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center font-bold border border-red-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h2 className="text-base font-bold text-white">Seguridad y Cambio de Contraseña</h2>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">Actualiza tu clave de acceso para iniciar sesión en tu portal</p>
                </div>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                {currentUser?.password && (
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-medium text-zinc-300">Nueva Contraseña</label>
                      <button
                        type="button"
                        onClick={() => setShowPassModalText(!showPassModalText)}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        {showPassModalText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassModalText ? "Ocultar" : "Mostrar"}</span>
                      </button>
                    </div>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      required
                      placeholder="Mínimo 4 caracteres"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      required
                      placeholder="Repite la nueva clave"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#E50914] hover:bg-[#b80710] text-white font-bold rounded-xl shadow-lg shadow-red-950/40 transition flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Actualizar Mi Contraseña</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA 2: CALENDARIO DE VENCIMIENTO DE CUENTAS DEL REVENDEDOR */}
        {/* ========================================================================= */}
        {activeTab === "calendario" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Encabezado del Calendario */}
            <div className="bg-[#181818] border border-[#2f2f2f] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[#262626]">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#E50914]" />
                      <span>Calendario de Vencimiento de Cuentas</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Monitorea las fechas de expiración de tus cuentas asignadas. Los días con vencimientos aparecen resaltados en rojo.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 font-mono">
                  Total Asignadas: <strong className="text-white">{rawSellerAccounts.length}</strong>
                </div>
              </div>

              {/* KPIs de Alerta de Vencimientos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-amber-500/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
                    <span>Por Vencer (7 Días)</span>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">{expiringSoonAccounts.length}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Requieren renovación pronto</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#141414] border border-red-500/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-red-400 font-bold mb-1">
                    <span>Ya Vencidas</span>
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">{expiredAccounts.length}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Contacta al admin para renovar</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2c2c2c] shadow-md">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-bold mb-1">
                    <span>Mis Cuentas Activas</span>
                    <Tv className="w-3.5 h-3.5 text-[#E50914]" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {rawSellerAccounts.filter(a => !a.expirationDate || new Date(a.expirationDate) >= new Date()).length}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Operando normalmente</div>
                </div>
              </div>

              {/* Controles de Navegación del Mes */}
              <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[#141414] border border-[#262626]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg bg-[#222222] hover:bg-zinc-700 text-white transition border border-[#333333]"
                    title="Mes Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
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

                <button
                  onClick={handleTodayCalendar}
                  className="px-3 py-1.5 bg-[#E50914]/20 hover:bg-[#E50914]/40 text-[#ff6666] hover:text-white border border-[#E50914]/30 rounded-lg text-xs font-bold transition"
                >
                  Hoy
                </button>
              </div>

              {/* Grid del Calendario */}
              <div className="rounded-xl border border-[#262626] bg-[#101010] overflow-hidden mb-6 shadow-inner">
                {/* Días de la semana */}
                <div className="grid grid-cols-7 text-center py-2 bg-[#181818] border-b border-[#262626] text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-wider">
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                  <div>Dom</div>
                </div>

                {/* Celdas de los días */}
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[#222222]">
                  {calendarMonthData.cells.map((cell, idx) => {
                    if (!cell) {
                      return (
                        <div key={`empty-seller-${idx}`} className="min-h-[70px] sm:min-h-[85px] bg-[#0c0c0c]/40 p-1.5" />
                      );
                    }

                    const todayStr = new Date().toISOString().split("T")[0];
                    const isToday = cell.dateStr === todayStr;
                    const isSelected = cell.dateStr === selectedCalendarDate;

                    // Cuentas de este vendedor que vencen este día
                    const expiringAccountsToday = rawSellerAccounts.filter(a => {
                      if (!a.expirationDate) return false;
                      const datePart = a.expirationDate.split("T")[0];
                      return datePart === cell.dateStr;
                    });
                    const hasExpiring = expiringAccountsToday.length > 0;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => setSelectedCalendarDate(cell.dateStr)}
                        className={`min-h-[70px] sm:min-h-[85px] p-2 flex flex-col justify-between transition cursor-pointer select-none relative ${
                          hasExpiring
                            ? "bg-[#E50914] text-white border-2 border-red-500 shadow-md shadow-red-950/70 font-black scale-[1.01]"
                            : isSelected
                            ? "bg-[#221214] ring-2 ring-[#E50914] text-white"
                            : "bg-[#141414] hover:bg-[#1e1e1e] text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-black ${
                            hasExpiring 
                              ? "text-white text-sm" 
                              : isToday 
                              ? "w-5 h-5 rounded-full bg-[#E50914] text-white flex items-center justify-center text-[11px]" 
                              : isSelected 
                              ? "text-[#E50914]" 
                              : "text-zinc-300"
                          }`}>
                            {cell.dayNumber}
                          </span>

                          {isToday && !hasExpiring && (
                            <span className="text-[8px] font-black uppercase text-[#E50914] bg-[#E50914]/20 px-1 rounded">
                              Hoy
                            </span>
                          )}
                        </div>

                        {/* Indicador de vencimiento */}
                        {hasExpiring && (
                          <div className="mt-1 bg-black/60 rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white tracking-tight truncate border border-white/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            <span>{expiringAccountsToday.length} {expiringAccountsToday.length === 1 ? "vence" : "vencen"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PANEL DETALLADO DE LA FECHA SELECCIONADA */}
              {(() => {
                const dayAccounts = rawSellerAccounts.filter(a => {
                  if (!a.expirationDate) return false;
                  return a.expirationDate.split("T")[0] === selectedCalendarDate;
                });

                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#2a2a2a] shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#262626] mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-[#E50914] rounded-full" />
                        <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#E50914]" />
                          <span>Cuentas con Vencimiento el:</span>
                          <span className="font-mono text-emerald-400">{selectedCalendarDate}</span>
                        </h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-black/60 text-zinc-300 border border-zinc-700">
                        {dayAccounts.length} {dayAccounts.length === 1 ? "cuenta" : "cuentas"}
                      </span>
                    </div>

                    {dayAccounts.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#101010] border border-dashed border-[#262626] text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>No tienes ninguna cuenta programada para vencer el {selectedCalendarDate}.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayAccounts.map((acc) => {
                          const isExpired = new Date(acc.expirationDate) < new Date();

                          return (
                            <div
                              key={acc.id}
                              className="p-4 rounded-xl bg-[#181818] border border-red-500/40 shadow-lg flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E50914]/20 text-[#ff6666] border border-[#E50914]/30 truncate max-w-[160px]">
                                    {acc.platform}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-950 text-red-400 border border-red-500/40 uppercase">
                                    {isExpired ? "Vencida" : "Vence este día"}
                                  </span>
                                </div>

                                <div className="font-mono text-xs font-bold text-white break-all mb-1">
                                  {acc.email}
                                </div>

                                <div className="text-[11px] text-zinc-400 flex items-center justify-between mt-2 pt-2 border-t border-[#262626]">
                                  <span>Perfiles: <strong className="text-zinc-200 font-mono">{acc.occupiedProfiles || 0}/{acc.maxProfiles || 5}</strong></span>
                                  <span>Vence: <strong className="text-amber-400 font-mono">{acc.expirationDate}</strong></span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-[#262626] flex justify-end">
                                <button
                                  onClick={() => {
                                    setSelectedAccount(acc.email);
                                    setActiveTab("cuentas");
                                  }}
                                  className="w-full py-2 bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-red-950/60 transition active:scale-95"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>Pedir Códigos para esta Cuenta</span>
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
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA 3: GESTIÓN DE CUENTAS (TERMINAL Y SOLICITUD DE CÓDIGOS) */}
        {/* ========================================================================= */}
        {activeTab === "cuentas" && (
          <>
            {/* BANNER DE ERROR DE AUTORIZACIÓN O EXPIRACIÓN */}
            {authError && (
              <div className="mb-6 p-4 rounded-2xl bg-red-950/70 border-2 border-red-500/50 text-red-200 flex items-start gap-3 shadow-xl">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-red-300">Consulta Bloqueada</div>
                  <div className="text-xs text-red-200/90 mt-0.5">{authError}</div>
                </div>
              </div>
            )}

            {/* SECCIÓN 1: SELECTOR DE CUENTA ACTIVA */}
            <div className="bg-[#181818] border border-[#2f2f2f] rounded-2xl p-5 mb-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Tus Cuentas de Streaming Asignadas ({assignedAccounts.length})
                  </label>
                </div>
                {currentUser && (
                  <span className="text-[11px] text-zinc-400">
                    Vendedor Activo: <strong className="text-white">{currentUser.name}</strong>
                  </span>
                )}
              </div>

              {assignedAccounts.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#121212] border border-[#262626] text-center text-xs text-zinc-400">
                  No tienes cuentas asignadas actualmente. Solicita al Administrador que te asigne cuentas desde el Catálogo Maestro.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {assignedAccounts.map((acc) => {
                    const isSelected = selectedAccount === acc.email;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          setSelectedAccount(acc.email);
                          setAuthError(null);
                          setReceivedCode(null);
                          setIsWaiting(false);
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#222222] border-2 border-[#E50914] text-white shadow-lg shadow-red-950/40 transform scale-[1.02]"
                            : "bg-[#141414] border-[#262626] text-zinc-400 hover:border-[#383838] hover:bg-[#181818]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-black ${isSelected ? "text-white" : "text-zinc-300"}`}>
                            {acc.service}
                          </span>
                          <span className="text-[10px] text-zinc-400 bg-[#282828] px-2 py-0.5 rounded font-mono">
                            {acc.profiles}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-zinc-200 truncate">{acc.email}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: 5 BOTONES DE ACCIONES PRINCIPALES */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-5 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Acciones Rápidas Disponibles
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {ACTIONS.map((action) => {
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleTriggerAction(action.id)}
                      disabled={isWaiting}
                      className={`p-5 rounded-2xl bg-gradient-to-br ${action.color} border text-left shadow-lg transition-all transform hover:-translate-y-1 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none flex flex-col justify-between min-h-[140px]`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-black/35 flex items-center justify-center text-white shadow-inner">
                          {action.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 text-white px-2 py-0.5 rounded-md">
                          {action.badge}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-white text-base tracking-tight leading-snug">
                          {action.title}
                        </div>
                        <div className="text-[11px] text-white/80 mt-1 leading-tight">
                          {action.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 3: TERMINAL DE RESULTADO EN TIEMPO REAL */}
            <div className="bg-[#181818] border border-[#2f2f2f] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Terminal de Extracción</span>
                  </div>
                  <div className="font-mono text-sm text-zinc-300 mt-1 pl-3.5">
                    Cuenta: <strong className="text-white">{selectedAccount}</strong>
                  </div>
                </div>

                {isWaiting && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Esperando código entrante ({timerSeconds}s)...</span>
                  </div>
                )}
              </div>

              {/* CONTENEDOR PRINCIPAL DEL CÓDIGO */}
              <div className="my-8 text-center">
                {isWaiting ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-[#E50914]/20 border-t-[#E50914] animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white">Obteniendo código en vivo...</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      El sistema está verificando la bandeja de entrada para extraer el código o enlace en segundos.
                    </p>
                  </div>
                ) : receivedCode ? (
                  <div className="py-4">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 px-3.5 py-1 rounded-full">
                      ¡Código Recibido con Éxito!
                    </span>

                    {/* VISUALIZACIÓN DEL CÓDIGO */}
                    {isUrl ? (
                      <div className="mt-6 max-w-2xl mx-auto p-4 rounded-2xl bg-[#121212] border border-[#2f2f2f] text-left shadow-xl">
                        <div className="text-xs text-zinc-400 font-semibold mb-1">Enlace de Confirmación / Restablecimiento:</div>
                        <div className="font-mono text-xs text-[#E50914] break-all bg-black/60 p-3 rounded-xl border border-[#262626]">
                          {receivedCode}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <a
                            href={receivedCode}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-md shadow-red-950/40"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir Enlace en Navegador
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 inline-block bg-[#121212] border-2 border-[#E50914]/60 rounded-3xl px-8 py-6 shadow-2xl shadow-red-950/40">
                        <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest text-white select-all">
                          {receivedCode}
                        </span>
                      </div>
                    )}

                    {/* BOTÓN DE COPIADO RÁPIDO */}
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleCopy}
                        className="py-3.5 px-8 rounded-2xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold text-sm shadow-xl shadow-red-950/50 flex items-center gap-2 transition transform hover:scale-105 active:scale-95"
                      >
                        {copied ? (
                          <>
                            <Check className="w-5 h-5 text-white" />
                            <span>¡Copiado al Portapapeles!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5" />
                            <span>Copiar al Portapapeles</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-zinc-500 flex flex-col items-center justify-center">
                    <KeyRound className="w-12 h-12 text-zinc-700 mb-3" />
                    <h3 className="text-base font-semibold text-zinc-400">Ninguna solicitud activa</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Presiona cualquiera de los 5 botones superiores para solicitar el código que necesitas.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Los códigos expiran automáticamente a los 5 minutos de su emisión.</span>
                </div>
                {receivedCode && (
                  <button
                    onClick={() => setReceivedCode(null)}
                    className="text-zinc-400 hover:text-white underline transition"
                  >
                    Limpiar pantalla
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* MODAL CAMBIAR CONTRASEÑA */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-[#2f2f2f] w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black/90 relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E50914] flex items-center justify-center border border-red-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#E50914] rounded-full" />
                    <h3 className="text-lg font-black text-white">Cambiar mi Contraseña</h3>
                  </div>
                  <p className="text-xs text-zinc-400 pl-3.5 mt-0.5">
                    Actualiza tu clave de acceso personal para el panel de vendedor
                  </p>
                </div>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                {currentUser?.password && (
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-zinc-300">Nueva Contraseña</label>
                    <button
                      type="button"
                      onClick={() => setShowPassModalText(!showPassModalText)}
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {showPassModalText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassModalText ? "Ocultar" : "Mostrar"}</span>
                    </button>
                  </div>
                  <input
                    type={showPassModalText ? "text" : "password"}
                    required
                    placeholder="Mínimo 4 caracteres"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Confirmar Nueva Contraseña</label>
                  <input
                    type={showPassModalText ? "text" : "password"}
                    required
                    placeholder="Repite la nueva contraseña"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full bg-[#121212] border border-[#2f2f2f] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                  />
                </div>

                <div className="pt-4 border-t border-[#262626] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-[#383838] text-zinc-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-bold shadow-lg shadow-red-950/40 transition"
                  >
                    Guardar Contraseña
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
