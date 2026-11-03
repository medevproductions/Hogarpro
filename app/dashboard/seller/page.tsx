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
  ChevronDown,
  X,
  CheckCircle2,
  Globe,
  ArrowLeft,
  ArrowLeftRight,
  Menu,
  Users,
  Search,
  Plus
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { 
  getCurrentUser, 
  setCurrentUser,
  saveSystemUser,
  getStoredAccounts, 
  getSystemUsers,
  checkAccountAuthorization, 
  syncAccountsFromCloud,
  syncUsersFromCloud,
  StoredStreamingAccount,
  SystemUser
} from "@/lib/account-manager";
import { createPendingCodeRequestFirestore } from "@/lib/firebase/firestore-service";
import { updatePasswordInFirebase } from "@/lib/firebase/auth-service";
import LatamPhoneInput from "@/components/LatamPhoneInput";
import CodigoHelpGuide from "@/components/soporte/CodigoHelpGuide";

export type CodeAction = 
  | "login_code" 
  | "verification_code" 
  | "actualizar_hogar" 
  | "acceso_temporal" 
  | "reset_password";

interface ActionConfig {
  id: CodeAction;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  badge: string;
  badgeClass: string;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "login_code",
    title: "Código TV",
    subtitle: "4 dígitos en pantalla",
    icon: <Zap className="w-5 h-5 text-emerald-400" />,
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    badge: "4 dígitos",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
  },
  {
    id: "verification_code",
    title: "Código OTP",
    subtitle: "6 dígitos de verificación",
    icon: <Clock className="w-5 h-5 text-sky-400" />,
    iconBg: "bg-sky-500/10 border-sky-500/20",
    badge: "6 dígitos",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20"
  },
  {
    id: "actualizar_hogar",
    title: "Actualizar Hogar",
    subtitle: "Confirmar red doméstica",
    icon: <Home className="w-5 h-5 text-blue-400" />,
    iconBg: "bg-blue-500/10 border-blue-500/20",
    badge: "Enlace",
    badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/20"
  },
  {
    id: "acceso_temporal",
    title: "Acceso de Viaje",
    subtitle: "TV fuera del hogar",
    icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    badge: "Enlace",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20"
  },
  {
    id: "reset_password",
    title: "Cambiar Clave",
    subtitle: "Restablecer contraseña",
    icon: <Lock className="w-5 h-5 text-rose-400" />,
    iconBg: "bg-rose-500/10 border-rose-500/20",
    badge: "Enlace",
    badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/20"
  }
];

export default function SellerLiveCodesPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("netflix01@hogarpro.com");
  const [activeAction, setActiveAction] = useState<CodeAction | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [currentUser, setCurrentUserState] = useState<SystemUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [assignedAccounts, setAssignedAccounts] = useState<Array<{ id: string; service: string; email: string; profiles: string; country: string }>>([]);
  const [rawSellerAccounts, setRawSellerAccounts] = useState<StoredStreamingAccount[]>([]);

  // Estados de Revendedores para simulación de vistas (Owner)
  const [availableSellers, setAvailableSellers] = useState<SystemUser[]>([]);
  const [simulatedSellerId, setSimulatedSellerId] = useState<string>("all");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(true);
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>("");
  const [showAllCards, setShowAllCards] = useState<boolean>(false);

  const router = useRouter();

  // Menú móvil deslizante de 3 rayas (Drawer)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    updatePasswordInFirebase(currentUser.id, newPasswordInput.trim()).catch(console.warn);
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
    const isOwner = currentUser?.role === "owner" || (currentUser?.role as string) === "admin";
    setCurrentUser(null);
    if (isOwner) {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  // Cambiar revendedor simulado (para Owner / Administrador)
  const handleSwitchSeller = (newSellerId: string) => {
    setSimulatedSellerId(newSellerId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (newSellerId === "all") {
        url.searchParams.delete("sellerId");
      } else {
        url.searchParams.set("sellerId", newSellerId);
      }
      window.history.replaceState(null, "", url.toString());
    }
    reloadSellerAccounts(newSellerId);
  };

  // Cargar cuentas asignadas al vendedor logueado o simular revendedor para el Owner
  const reloadSellerAccounts = (targetSellerIdOverride?: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/?error=login_required");
      return;
    }

    setCurrentUserState(user);

    // Cargar y almacenar lista de revendedores
    const allUsers = getSystemUsers();
    setAvailableSellers(allUsers);

    const allAccounts = getStoredAccounts();
    const isOwner = user.role === "owner" || (user.role as string) === "admin";
    const effectiveSimId = targetSellerIdOverride !== undefined ? targetSellerIdOverride : simulatedSellerId;

    let validAccs: StoredStreamingAccount[] = [];

    if (isOwner) {
      if (effectiveSimId === "all") {
        validAccs = allAccounts;
        setProfileName("Vista Global Admin");
        setProfilePhone("Acceso Total");
      } else {
        const foundSeller = allUsers.find(
          u => u.id === effectiveSimId || (u.email && u.email.toLowerCase() === effectiveSimId.toLowerCase())
        );

        if (foundSeller) {
          setProfileName(foundSeller.name);
          setProfilePhone(foundSeller.phone || "Sin teléfono");

          const sId = (foundSeller.id || "").toLowerCase().trim();
          const sName = (foundSeller.name || "").toLowerCase().trim();
          const sEmail = (foundSeller.email || "").toLowerCase().trim();

          validAccs = allAccounts.filter(a => {
            const accSellerId = (a.sellerId || "").toLowerCase().trim();
            const accSellerName = (a.sellerName || (a as any).seller || "").toLowerCase().trim();
            const accCustomer = (a.customerName || "").toLowerCase().trim();

            return (
              (accSellerId && (accSellerId === sId || accSellerId === sEmail)) ||
              (accSellerName && (accSellerName === sName || accSellerName === sEmail || sName.includes(accSellerName) || accSellerName.includes(sName))) ||
              (accCustomer && (accCustomer === sName || accCustomer === sEmail))
            );
          });
        } else {
          validAccs = allAccounts;
          setProfileName(user.name || "Administrador");
          setProfilePhone(user.phone || "");
        }
      }
    } else {
      setProfileName(user.name || "");
      setProfilePhone(user.phone || "");

      const uName = (user.name || "").toLowerCase().trim();
      const uEmail = (user.email || "").toLowerCase().trim();
      const uId = (user.id || "").toLowerCase().trim();

      validAccs = allAccounts.filter(a => {
        const sId = (a.sellerId || "").toLowerCase().trim();
        const sName = (a.sellerName || (a as any).seller || "").toLowerCase().trim();
        const sCustomer = (a.customerName || "").toLowerCase().trim();

        return (
          (sId && (sId === uId || sId === uEmail)) ||
          (sName && (sName === uName || sName === uEmail || uName.includes(sName) || sName.includes(uName))) ||
          (sCustomer && (sCustomer === uName || sCustomer === uEmail))
        );
      });
    }

    // Ordenar primero las cuentas que están por vencer
    validAccs.sort((a, b) => {
      const timeA = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      const validA = !isNaN(timeA) ? timeA : Number.MAX_SAFE_INTEGER;
      const validB = !isNaN(timeB) ? timeB : Number.MAX_SAFE_INTEGER;
      return validA - validB;
    });

    const formatted = validAccs.map((a) => ({
      id: a.id,
      service: a.platform || "Netflix",
      email: a.email || "sin_correo@hogarpro.com",
      profiles: `${a.occupiedProfiles || 0}/${a.maxProfiles || 5}`,
      country: a.country || "Global"
    }));

    setAssignedAccounts(formatted);
    setRawSellerAccounts(validAccs);
    setIsLoadingAccounts(false);

    if (formatted.length > 0) {
      setSelectedAccount((prev) => {
        if (prev && formatted.some(f => (f.email || "").toLowerCase().trim() === (prev || "").toLowerCase().trim())) {
          return prev;
        }
        return formatted[0].email;
      });
    } else {
      setSelectedAccount("");
    }
  };

  useEffect(() => {
    let initialSellerId = "all";
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam === "calendario" || tabParam === "configuracion" || tabParam === "cuentas") {
        setActiveTab(tabParam);
      }
      const sellerParam = urlParams.get("sellerId");
      if (sellerParam) {
        initialSellerId = sellerParam;
        setSimulatedSellerId(sellerParam);
      }
    }

    reloadSellerAccounts(initialSellerId);

    // Sincronizar cuentas y revendedores desde Cloud Firestore
    Promise.all([
      syncAccountsFromCloud(true),
      syncUsersFromCloud(true)
    ]).then(() => {
      reloadSellerAccounts(initialSellerId);
    }).catch(console.warn);

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

  const simulatedSellerObj = React.useMemo(() => {
    if (simulatedSellerId === "all") return null;
    return availableSellers.find(s => s.id === simulatedSellerId || (s.email && s.email.toLowerCase() === simulatedSellerId.toLowerCase())) || null;
  }, [simulatedSellerId, availableSellers]);

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

  // SUSCRIPCIÓN EN TIEMPO REAL CON FIREBASE FIRESTORE & POLLING DE RESPALDO
  useEffect(() => {
    if (!isWaiting || !currentRequestId) return;

    // 1. Escuchar actualizaciones en tiempo real de Firebase Firestore
    let unsub: (() => void) | null = null;
    if (db) {
      try {
        unsub = onSnapshot(doc(db, "code_requests", currentRequestId), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === "completado" && data.extracted_code) {
              setReceivedCode(data.extracted_code);
              setIsWaiting(false);
            }
          }
        }, (err) => {
          console.warn("[FIRESTORE REALTIME] Listener error:", err?.message);
        });
      } catch (e) {
        console.warn("[FIRESTORE] Error inicializando listener:", e);
      }
    }

    // 2. Polling cada 3 segundos como respaldo automático (máximo 15 intentos = 45s)
    let attempts = 0;
    const maxAttempts = 15;
    const pollingInterval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollingInterval);
        setIsWaiting(false);
        return;
      }

      try {
        const cleanEmail = selectedAccount.trim().toLowerCase();
        if (!cleanEmail) return;
        const res = await fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&actionType=${encodeURIComponent(activeAction || "login_code")}&service=netflix&t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.code) {
            setReceivedCode(json.code);
            setIsWaiting(false);
            clearInterval(pollingInterval);
          }
        }
      } catch (err) {
        // Silencioso
      }
    }, 3000);

    pollingIntervalRef.current = pollingInterval;

    return () => {
      if (unsub) unsub();
      clearInterval(pollingInterval);
    };
  }, [isWaiting, currentRequestId, selectedAccount, activeAction]);

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

    // Consulta inicial inmediata a través del proxy seguro
    try {
      fetch(`/api/codes/check?email=${encodeURIComponent(cleanEmail)}&service=netflix&actionType=${encodeURIComponent(action)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.code) {
            setReceivedCode(data.code);
            setIsWaiting(false);
          }
        })
        .catch(() => {});
    } catch (e) {}

    // Registrar solicitud pendiente en Cloud Firestore y vincular el listener realtime al ID exacto
    try {
      const pendingRes = await createPendingCodeRequestFirestore({
        account_email: cleanEmail,
        action_type: action,
        service: "netflix"
      });
      if (pendingRes && pendingRes.success && pendingRes.id) {
        setCurrentRequestId(pendingRes.id);
      }
    } catch (e) {}

    // Timeout de seguridad: Si tras 90 segundos no hay respuesta del correo, detener la espera limpiamente
    setTimeout(() => {
      setIsWaiting((prev) => {
        if (prev) return false;
        return false;
      });
    }, 90000);
  };

  const handleCopy = () => {
    if (!receivedCode) return;
    navigator.clipboard.writeText(receivedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUrl = receivedCode && (receivedCode.startsWith("http://") || receivedCode.startsWith("https://"));
  const isOwnerOrAdmin = currentUser?.role === "owner" || (currentUser?.role as string) === "admin";

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col md:flex-row w-full max-w-full selection:bg-rose-500/30 selection:text-rose-200">
      {/* BARRA SUPERIOR MÓVIL STICKY CON MENÚ DE 3 RAYAS */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0E121B]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <Link href={isOwnerOrAdmin ? "/dashboard/owner" : "/dashboard/seller"} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center font-bold text-white shadow-sm">
            H
          </div>
          <div>
            <div className="font-bold text-slate-100 text-xs tracking-tight leading-none">HOGAR<span className="text-rose-500">PRO</span></div>
            <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
              {isOwnerOrAdmin ? "VISTA VENDEDOR (ADMIN)" : "PORTAL REVENDEDOR"}
            </div>
          </div>
        </Link>

        {/* CONTROLES DERECHA */}
        <div className="flex items-center gap-2">
          {isOwnerOrAdmin && (
            <Link
              href="/dashboard/owner"
              className="px-2.5 py-1.5 text-[11px] text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1 font-semibold transition shadow-sm"
              title="Regresar a Panel Owner"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Owner</span>
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-[#141A25] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 active:scale-95 transition shadow-sm flex items-center justify-center"
            title="Abrir menú de opciones"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5 text-slate-200" />
          </button>
        </div>
      </div>

      {/* DRAWER MÓVIL DESLIZABLE DESDE LA DERECHA (MENÚ DE 3 RAYAS) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Fondo con desenfoque (Backdrop Blur) */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-backdrop-fade transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menú deslizable desde la derecha */}
          <div className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-[#111111] border-l border-[#262626] shadow-2xl flex flex-col justify-between p-5 z-10 animate-drawer-right">
            <div>
              {/* Cabecera del Drawer con Logo y botón de cerrar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#222222]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E50914] flex items-center justify-center font-black text-white shadow-md shadow-red-600/40">
                    H
                  </div>
                  <div>
                    <div className="font-black text-white text-sm tracking-wider leading-none">
                      HOGAR<span className="text-[#E50914]">PRO</span>
                    </div>
                    <div className="text-[9px] text-[#E50914] font-bold uppercase tracking-wider mt-0.5">
                      {isOwnerOrAdmin ? "VISTA VENDEDOR (ADMIN)" : "PORTAL REVENDEDOR"}
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

              {/* Perfil del Vendedor en el Drawer */}
              <div className="mb-4 p-3 rounded-xl bg-[#181818] border border-[#262626] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-[#E50914] flex items-center justify-center font-bold border border-red-500/30 text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span>{simulatedSellerObj ? simulatedSellerObj.name : (currentUser?.name || "Vendedor")}</span>
                    {isOwnerOrAdmin && (
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#E50914] text-white font-black uppercase">
                        {simulatedSellerObj ? "Simulación" : "Owner"}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">{simulatedSellerObj ? simulatedSellerObj.email : (currentUser?.email || "vendedor@ventas.com")}</div>
                </div>
              </div>

              {/* Indicador de secciones */}
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-2 py-1 mb-2">
                OPCIONES DE NAVEGACIÓN
              </div>

              {/* Lista Vertical de Opciones */}
              <nav className="space-y-1 text-xs font-medium overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                <button
                  onClick={() => {
                    setActiveTab("cuentas");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                    activeTab === "cuentas"
                      ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-blue-400" />
                    <span>Mis Cuentas y Códigos</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                    {assignedAccounts.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("calendario");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                    activeTab === "calendario"
                      ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Vencimientos</span>
                  </div>
                  {expiringSoonAccounts.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/50 font-mono font-medium">
                      {expiringSoonAccounts.length} prox
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab("configuracion");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition ${
                    activeTab === "configuracion"
                      ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
                  }`}
                >
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span>Mi Cuenta</span>
                </button>
              </nav>
            </div>

            {/* Accesos Rápidos Inferiores del Drawer (Cerrar Sesión & Volver a Owner) */}
            <div className="pt-4 border-t border-[#262626] space-y-2 text-xs">
              {isOwnerOrAdmin && (
                <Link
                  href="/dashboard/owner"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-red-950/50 to-black border border-red-500/40 text-white font-bold hover:bg-red-900/30 transition shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4 text-[#E50914]" />
                    <span>Volver a Panel Owner</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-500/20 transition font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR DESKTOP FIJO CONSTANTEMENTE VISIBLE */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0E121B] p-5 hidden md:flex flex-col justify-between fixed inset-y-0 left-0 z-30">
        <div className="flex-1 min-h-0 flex flex-col">
          <Link href={isOwnerOrAdmin ? "/dashboard/owner" : "/dashboard/seller"} className="flex items-center gap-3 mb-6 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center font-bold text-xl text-white shadow-sm group-hover:scale-105 transition-transform">
              H
            </div>
            <div>
              <div className="font-bold text-slate-100 tracking-tight text-base">HOGAR<span className="text-rose-500">PRO</span></div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {isOwnerOrAdmin ? "VISTA VENDEDOR (ADMIN)" : "PORTAL REVENDEDOR"}
              </div>
            </div>
          </Link>

          {/* BOTÓN REGRESAR A OWNER SI ES ADMINISTRADOR */}
          {isOwnerOrAdmin && (
            <div className="mb-5 p-3 rounded-xl bg-[#141A25] border border-slate-800 shadow-sm shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sesión Owner Activa
                </span>
              </div>
              <Link
                href="/dashboard/owner"
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Panel Owner</span>
              </Link>
            </div>
          )}

          {/* NAVEGACIÓN PRINCIPAL */}
          <nav className="space-y-1 text-sm font-medium overflow-y-auto flex-1 pr-1">
            <button
              onClick={() => setActiveTab("cuentas")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left ${
                activeTab === "cuentas"
                  ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className={`w-4 h-4 ${activeTab === "cuentas" ? "text-blue-400" : "text-slate-400"}`} />
                <span>Mis Cuentas y Códigos</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 font-mono">
                {assignedAccounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calendario")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left ${
                activeTab === "calendario"
                  ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className={`w-4 h-4 ${activeTab === "calendario" ? "text-blue-400" : "text-slate-400"}`} />
                <span>Vencimientos</span>
              </div>
              {expiringSoonAccounts.length > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/50 font-mono font-medium">
                  {expiringSoonAccounts.length} prox
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab("configuracion")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition text-left ${
                activeTab === "configuracion"
                  ? "bg-[#182030] text-slate-100 border-l-2 border-blue-500 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#141A25]"
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === "configuracion" ? "text-blue-400" : "text-slate-400"}`} />
              <span>Mi Cuenta</span>
            </button>
          </nav>
        </div>

        {/* PIE DEL SIDEBAR */}
        <div className="pt-4 mt-2 border-t border-slate-800/80 space-y-2 shrink-0 bg-[#0E121B]">
          {isOwnerOrAdmin && (
            <Link
              href="/dashboard/owner"
              className="w-full flex items-center justify-center gap-2 text-xs text-white bg-slate-800 hover:bg-slate-700 transition py-2 px-3 rounded-lg font-medium border border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Panel Owner</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 transition py-2 px-3 rounded-lg hover:bg-rose-950/20 font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 md:ml-64 p-3.5 sm:p-6 md:p-8 max-w-full overflow-x-hidden">
        {/* BANNER MODO VISTA OWNER CON SELECTOR DE REVENDEDORES */}
        {isOwnerOrAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-zinc-900 to-black border-2 border-red-500/50 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-[#E50914] shrink-0 mt-1 sm:mt-0">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-white uppercase tracking-wider">Modo Vista de Revendedor</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                      Sesión Owner Activa
                    </span>
                    {simulatedSellerObj ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E50914]/20 text-[#ff8888] border border-red-500/30 font-bold">
                        Viendo como: {simulatedSellerObj.name}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        Vista Global (Todas las Cuentas)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">
                    Puedes alternar entre cualquier revendedor para simular exactamente su portal y códigos disponibles.
                  </p>
                </div>
              </div>

              {/* CONTROLES DEL BANNER: SELECTOR DE REVENDEDOR Y VOLVER */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-[#181818] border border-zinc-700/80 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <Users className="w-3.5 h-3.5 text-[#E50914] shrink-0" />
                  <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">Ver como:</span>
                  <select
                    value={simulatedSellerId}
                    onChange={(e) => handleSwitchSeller(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all" className="bg-[#181818] text-white">
                      🌟 Todas las Cuentas ({getStoredAccounts().length})
                    </option>
                    {availableSellers.filter(s => s.role !== "owner").map((s) => {
                      const count = getStoredAccounts().filter(a => 
                        a.sellerId === s.id || a.sellerId === s.email || a.sellerName === s.name || a.customerName === s.name
                      ).length;
                      return (
                        <option key={s.id} value={s.id} className="bg-[#181818] text-white">
                          👤 {s.name} ({count} {count === 1 ? "cuenta" : "cuentas"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <Link
                  href="/dashboard/owner"
                  className="px-3.5 py-2 bg-[#E50914] hover:bg-[#b80710] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-md shadow-red-950/60 active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Owner</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-7 bg-[#E50914] rounded-full shadow-sm shadow-red-600/50" />
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeTab === "cuentas" ? "Gestión y Solicitud de Códigos" : activeTab === "calendario" ? "Calendario de Vencimientos" : "Configuración de tu Cuenta"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 pl-4">
              {activeTab === "cuentas" 
                ? "Selecciona tu cuenta autorizada y pulsa la acción deseada para extraer el código o enlace en segundos." 
                : activeTab === "calendario"
                ? "Consulta las fechas en que vencen tus cuentas asignadas para renovarlas con el administrador a tiempo."
                : "Actualiza tus datos de revendedor y tu contraseña personal de acceso."}
            </p>
          </div>

          {/* PERFIL DEL VENDEDOR */}
          <div className="flex items-center gap-3 bg-[#121722] border border-slate-800/80 p-2.5 px-4 rounded-2xl shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <span>{simulatedSellerObj ? simulatedSellerObj.name : (currentUser?.name || "Vendedor")}</span>
                {isOwnerOrAdmin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold uppercase tracking-wider">
                    {simulatedSellerObj ? "Simulación" : "Owner"}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">{simulatedSellerObj ? simulatedSellerObj.email : (currentUser?.email || "vendedor@ventas.com")}</div>
            </div>
            {activeTab !== "configuracion" && (
              <button
                onClick={() => setActiveTab("configuracion")}
                className="ml-2 px-3 py-1.5 bg-[#1C2433] hover:bg-[#253043] border border-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition"
                title="Ir a Configuración"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
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
            <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    <h2 className="text-base font-semibold text-slate-100">Datos Personales del Revendedor</h2>
                  </div>
                  <p className="text-xs text-slate-400 pl-3.5 mt-0.5">Información de contacto asociada a tu cuenta</p>
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
                    <label className="block font-medium text-slate-300 mb-1">Nombre Completo</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Teléfono / WhatsApp (LATAM)</label>
                    <LatamPhoneInput
                      value={profilePhone}
                      onChange={(phone) => setProfilePhone(phone)}
                      placeholder="300 123 4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Correo Electrónico (Solo Lectura)</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.email || ""}
                    className="w-full bg-[#080B10] border border-slate-800 text-slate-500 rounded-xl px-3 py-2.5 font-mono cursor-not-allowed"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    El correo es tu identificador único de vendedor y no se puede modificar.
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-sm transition flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Datos</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Tarjeta 2: Cambiar Contraseña */}
            <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold border border-rose-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h2 className="text-base font-semibold text-slate-100">Seguridad y Cambio de Contraseña</h2>
                  </div>
                  <p className="text-xs text-slate-400 pl-3.5 mt-0.5">Actualiza tu clave de acceso para iniciar sesión en tu portal</p>
                </div>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
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
                    <label className="block font-medium text-slate-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-medium text-slate-300">Nueva Contraseña</label>
                      <button
                        type="button"
                        onClick={() => setShowPassModalText(!showPassModalText)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
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
                      className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      required
                      placeholder="Repite la nueva clave"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl shadow-sm transition flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Actualizar Contraseña</span>
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
            {/* Acceso Directo a los 5 Botones de Códigos */}
            <div className="p-4 rounded-2xl bg-[#121722] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">¿Necesitas consultar un código o enlace para tus clientes?</div>
                  <div className="text-[11px] text-slate-400">Accede directamente al panel para solicitar códigos OTP o enlaces de Netflix.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("cuentas")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shrink-0 shadow-sm flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Solicitar Códigos</span>
              </button>
            </div>

            {/* Encabezado del Calendario */}
            <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <span>Calendario de Vencimiento de Cuentas</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Fechas de expiración de tus cuentas asignadas.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Total Asignadas: <strong className="text-slate-200">{rawSellerAccounts.length}</strong>
                </div>
              </div>

              {/* KPIs de Alerta de Vencimientos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="p-3.5 rounded-xl bg-[#0E131E] border border-amber-500/30 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
                    <span>Por Vencer (7 Días)</span>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono">{expiringSoonAccounts.length}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Requieren renovación pronto</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0E131E] border border-rose-500/30 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
                    <span>Ya Vencidas</span>
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono">{expiredAccounts.length}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Contacta al admin para renovar</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0E131E] border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                    <span>Mis Cuentas Activas</span>
                    <Tv className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono">
                    {rawSellerAccounts.filter(a => !a.expirationDate || new Date(a.expirationDate) >= new Date()).length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Operando normalmente</div>
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
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E50914]/20 text-[#ff6666] border border-[#E50914]/30 truncate max-w-[120px]">
                                      {acc.platform}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-300 bg-black/60 border border-zinc-700 shrink-0">
                                      <Globe className="w-2.5 h-2.5 text-[#E50914]" />
                                      <span>{acc.country || "Global"}</span>
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-950 text-red-400 border border-red-500/40 uppercase shrink-0">
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
                                    const targetEmail = acc.email.trim();
                                    setSelectedAccount(targetEmail);
                                    setActiveTab("cuentas");
                                    setAuthError(null);
                                    setReceivedCode(null);
                                    setIsWaiting(false);
                                    setTimeout(() => {
                                      window.scrollTo({ top: 120, behavior: "smooth" });
                                    }, 80);
                                  }}
                                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>Seleccionar y Pedir Códigos</span>
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
              <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-200 flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm text-rose-200">Acción Bloqueada</div>
                  <div className="text-xs text-rose-200/90 mt-0.5">{authError}</div>
                </div>
              </div>
            )}

            {/* SECCIÓN 1: CUENTA ACTIVA */}
            <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-5 mb-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Cuenta Activa
                  </label>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>
                    Revendedor: <strong className="text-slate-200">{simulatedSellerObj ? simulatedSellerObj.name : (currentUser?.name || "Vendedor")}</strong>
                  </span>
                  {assignedAccounts.length > 0 && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="font-mono text-emerald-400 font-medium">
                        {assignedAccounts.length} {assignedAccounts.length === 1 ? "cuenta disponible" : "cuentas disponibles"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {isLoadingAccounts ? (
                <div className="p-6 rounded-xl bg-[#0E131E] border border-slate-800 flex items-center justify-center gap-3 text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-rose-500 rounded-full animate-spin" />
                  <span>Cargando cuentas asignadas...</span>
                </div>
              ) : assignedAccounts.length === 0 ? (
                <div className="p-6 sm:p-8 rounded-xl bg-[#0E131E] border border-dashed border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                      {isOwnerOrAdmin && simulatedSellerObj
                        ? `El revendedor "${simulatedSellerObj.name}" no tiene cuentas asignadas`
                        : "No tienes cuentas asignadas actualmente"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {isOwnerOrAdmin
                        ? "Puedes asignarle cuentas libres desde el inventario del Panel Owner o cambiar a la vista global."
                        : "Solicita a tu proveedor o administrador que te asigne tus cuentas para poder solicitar códigos."}
                    </p>
                  </div>

                  {isOwnerOrAdmin ? (
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => handleSwitchSeller("all")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ver Todas ({getStoredAccounts().length})</span>
                      </button>
                      <Link
                        href="/dashboard/owner?tab=vendedores"
                        className="px-4 py-2 bg-[#1C2433] hover:bg-[#253043] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                        <span>Ir a Asignar en Panel Owner</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selector Desplegable */}
                  <div>
                    <select
                      value={selectedAccount}
                      onChange={(e) => {
                        setSelectedAccount(e.target.value);
                        setAuthError(null);
                        setReceivedCode(null);
                        setIsWaiting(false);
                      }}
                      className="w-full bg-[#0E131E] border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:outline-none transition cursor-pointer shadow-sm"
                    >
                      {assignedAccounts.map((a) => (
                        <option key={a.id} value={a.email}>
                          {a.email} — {a.service} ({a.country}) • Perfiles: {a.profiles}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fila de Resumen de Cuenta Activa con Botón de Copiado */}
                  {(() => {
                    const activeAcc = rawSellerAccounts.find(a => (a.email || "").toLowerCase().trim() === (selectedAccount || "").toLowerCase().trim()) || rawSellerAccounts[0];
                    if (!activeAcc) return null;
                    const isExp = activeAcc.expirationDate ? new Date(activeAcc.expirationDate) < new Date() : false;

                    return (
                      <div className="p-3.5 rounded-xl bg-[#0E131E] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              {activeAcc.platform}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700">
                              <Globe className="w-2.5 h-2.5 text-blue-400" />
                              <span>{activeAcc.country || "Global"}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700">
                              Perfiles: <strong className="text-slate-100">{activeAcc.occupiedProfiles || 0}/{activeAcc.maxProfiles || 5}</strong>
                            </span>
                            {activeAcc.expirationDate && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                isExp 
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/50" 
                                  : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                              }`}>
                                {isExp ? "Vencida: " : "Vence: "}{activeAcc.expirationDate}
                              </span>
                            )}
                          </div>

                          <div className="font-mono text-xs sm:text-sm font-semibold text-slate-100 break-all flex items-center gap-2">
                            <span>{activeAcc.email}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(activeAcc.email);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                              title="Copiar correo"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            Lista para Extraer
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: 5 BOTONES DE ACCIÓN */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Solicitar Código o Enlace
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {ACTIONS.map((action) => {
                  const isDisabled = isWaiting || assignedAccounts.length === 0;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleTriggerAction(action.id)}
                      disabled={isDisabled}
                      title={assignedAccounts.length === 0 ? "Asigna una cuenta primero" : ""}
                      className="group relative p-3.5 rounded-2xl bg-[#121722] hover:bg-[#182030] border border-slate-800/80 hover:border-slate-700 text-left shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 disabled:transform-none flex flex-col justify-between min-h-[135px]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${action.iconBg}`}>
                          {action.icon}
                        </div>
                        <span className={`text-[10px] font-medium border px-2 py-0.5 rounded-md ${action.badgeClass}`}>
                          {action.badge}
                        </span>
                      </div>

                      <div>
                        <div className="font-semibold text-slate-100 text-xs sm:text-sm tracking-tight group-hover:text-white transition">
                          {action.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {action.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 3: RESULTADO EN TIEMPO REAL */}
            <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Terminal de Resultado</span>
                  </div>
                  <div className="font-mono text-xs text-slate-400 mt-1 pl-3.5">
                    Cuenta: <strong className="text-slate-200">{selectedAccount || "Ninguna seleccionada"}</strong>
                  </div>
                </div>

                {isWaiting && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Consultando correo ({timerSeconds}s)...</span>
                  </div>
                )}
              </div>

              {/* CONTENEDOR PRINCIPAL DEL CÓDIGO */}
              <div className="my-6 text-center">
                {isWaiting ? (
                  <div className="py-8 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mb-3" />
                    <h3 className="text-base font-semibold text-slate-100">Buscando código en tiempo real...</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Consultando el correo de la cuenta para extraer el código o enlace en segundos.
                    </p>
                  </div>
                ) : receivedCode ? (
                  <div className="py-2">
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                      ¡Código Recibido con Éxito!
                    </span>

                    {/* VISUALIZACIÓN DEL CÓDIGO O ENLACE */}
                    {isUrl ? (
                      <div className="mt-5 max-w-2xl mx-auto p-4 sm:p-5 rounded-2xl bg-[#0E131E] border border-slate-800 text-left shadow-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <ExternalLink className="w-4 h-4 text-blue-400" />
                            Enlace Oficial:
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded font-mono">
                            {activeAction === "actualizar_hogar" ? "Actualización Hogar" : activeAction === "acceso_temporal" ? "Acceso de Viaje" : "Cambiar Clave"}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-blue-300 break-all bg-[#080B10] p-3 rounded-xl border border-slate-800 select-all mb-4">
                          {receivedCode}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <a
                            href={receivedCode}
                            target="_blank"
                            rel="noreferrer"
                            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Abrir Enlace Oficial</span>
                          </a>
                          <button
                            onClick={handleCopy}
                            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">¡Enlace Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar Enlace</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 inline-block bg-[#0E131E] border border-slate-800 rounded-2xl px-8 sm:px-12 py-5 shadow-inner">
                          <span className="text-4xl sm:text-6xl font-bold font-mono tracking-widest text-slate-100 select-all">
                            {receivedCode}
                          </span>
                        </div>

                        {/* BOTÓN DE COPIADO RÁPIDO */}
                        <div className="mt-5 flex justify-center">
                          <button
                            onClick={handleCopy}
                            className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition transform active:scale-95"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-white" />
                                <span>¡Copiado al Portapapeles!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar Código</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-slate-500 flex flex-col items-center justify-center">
                    <KeyRound className="w-10 h-10 text-slate-700 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-400">Listo para consultar</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Haz clic en cualquiera de los 5 botones para solicitar el código o enlace.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Los códigos expiran automáticamente a los 5 minutos.</span>
                </div>
                {receivedCode && (
                  <button
                    onClick={() => setReceivedCode(null)}
                    className="text-slate-400 hover:text-slate-200 underline transition text-xs"
                  >
                    Limpiar pantalla
                  </button>
                )}
              </div>
            </div>

            {/* SECCIÓN 4: CATÁLOGO DE CUENTAS ASIGNADAS */}
            {assignedAccounts.length > 0 && (
              <div className="bg-[#121722] border border-slate-800/80 rounded-2xl p-5 sm:p-6 mb-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Mis Cuentas Asignadas ({assignedAccounts.length})
                    </h3>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por correo o país..."
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      className="w-full bg-[#0E131E] border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                {(() => {
                  const filteredAccounts = assignedAccounts.filter(a => {
                    if (!accountSearchQuery.trim()) return true;
                    const q = accountSearchQuery.toLowerCase().trim();
                    return (
                      (a.email || "").toLowerCase().includes(q) ||
                      (a.service || "").toLowerCase().includes(q) ||
                      (a.country || "").toLowerCase().includes(q)
                    );
                  });

                  const displayAccounts = showAllCards ? filteredAccounts : filteredAccounts.slice(0, 4);

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {displayAccounts.map((acc) => {
                          const isSelected = (selectedAccount || "").toLowerCase().trim() === (acc.email || "").toLowerCase().trim();
                          return (
                            <div
                              key={acc.id}
                              onClick={() => {
                                setSelectedAccount((acc.email || "").trim());
                                setAuthError(null);
                                setReceivedCode(null);
                                setIsWaiting(false);
                                window.scrollTo({ top: 120, behavior: "smooth" });
                              }}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-[#182234] border border-blue-500/80 text-slate-100 shadow-sm ring-1 ring-blue-500/30"
                                  : "bg-[#0E131E] border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-[#131926]"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-xs font-semibold truncate max-w-[120px] ${isSelected ? "text-slate-100" : "text-slate-300"}`}>
                                  {acc.service}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">
                                  {acc.profiles}
                                </span>
                              </div>
                              <div className="font-mono text-xs text-slate-200 truncate mb-2">{acc.email}</div>
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                                <span className="inline-flex items-center gap-1 text-slate-400 font-mono">
                                  <Globe className="w-2.5 h-2.5 text-blue-400" />
                                  <span>{acc.country}</span>
                                </span>
                                {isSelected ? (
                                  <span className="text-blue-400 font-semibold text-[9px] uppercase tracking-wider">
                                    Seleccionada
                                  </span>
                                ) : (
                                  <span className="text-slate-500 hover:text-slate-300 transition">
                                    Seleccionar
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {filteredAccounts.length > 4 && (
                        <div className="flex justify-center pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAllCards(!showAllCards)}
                            className="text-xs text-slate-400 hover:text-slate-200 bg-[#0E131E] hover:bg-slate-800 border border-slate-800 px-4 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllCards ? "rotate-180" : ""}`} />
                            <span>
                              {showAllCards 
                                ? "Mostrar solo 4 cuentas" 
                                : `Ver todas las cuentas (${filteredAccounts.length})`}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SECCIÓN 5: GUÍA DE AYUDA */}
            <div className="mb-8">
              <CodigoHelpGuide />
            </div>
          </>
        )}

        {/* MODAL CAMBIAR CONTRASEÑA */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121722] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h3 className="text-base font-semibold text-slate-100">Cambiar Contraseña</h3>
                  </div>
                  <p className="text-xs text-slate-400 pl-3.5 mt-0.5">
                    Actualiza tu clave de acceso personal
                  </p>
                </div>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
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
                    <label className="block font-medium text-slate-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-slate-300">Nueva Contraseña</label>
                    <button
                      type="button"
                      onClick={() => setShowPassModalText(!showPassModalText)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
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
                    className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                  <input
                    type={showPassModalText ? "text" : "password"}
                    required
                    placeholder="Repite la nueva contraseña"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full bg-[#0E131E] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#1C2433] hover:bg-[#253043] text-slate-300 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm transition"
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
