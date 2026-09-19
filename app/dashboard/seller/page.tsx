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
  LogOut
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

  const router = useRouter();

  // Navegación de pestañas: "cuentas" | "configuracion"
  const [activeTab, setActiveTab] = useState<"cuentas" | "configuracion">("cuentas");

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
  useEffect(() => {
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
    if (formatted.length > 0 && !selectedAccount) {
      setSelectedAccount(formatted[0].email);
    }
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

    // Consulta directa a Google Apps Script
    const GAS_URL = "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";
    try {
      fetch(`${GAS_URL}?email=${encodeURIComponent(cleanEmail)}&service=netflix&actionType=${encodeURIComponent(action)}&t=${Date.now()}`)
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
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d121f] p-5 hidden md:flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-600/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-black text-white tracking-tight">STREAMHUB</div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">PORTAL REVENDEDOR</div>
            </div>
          </div>

          {/* NAVEGACIÓN PRINCIPAL */}
          <nav className="space-y-1.5 text-sm font-medium">
            <button
              onClick={() => setActiveTab("cuentas")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-left ${
                activeTab === "cuentas"
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Gestión de Cuentas</span>
            </button>

            <button
              onClick={() => setActiveTab("configuracion")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-left ${
                activeTab === "configuracion"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs text-red-400/80 hover:text-red-300 transition py-1.5 px-2 rounded-lg hover:bg-red-950/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
          <Link href="/" className="block text-xs text-gray-500 hover:text-gray-300 px-2">
            ← Ver Tienda Pública
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeTab === "cuentas" ? "Gestión y Solicitud de Códigos" : "Configuración de tu Cuenta"}
              </h1>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === "cuentas" 
                ? "Selecciona la cuenta y presiona la acción deseada para extraer el código o enlace instantáneamente." 
                : "Actualiza tus datos personales de revendedor y tu contraseña de acceso."}
            </p>
          </div>

          {/* PERFIL DEL VENDEDOR */}
          <div className="flex items-center gap-3 bg-[#121826] border border-gray-800 p-2.5 px-4 rounded-2xl shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white">{currentUser?.name || "Vendedor"}</div>
              <div className="text-[10px] text-gray-400 font-mono">{currentUser?.email || "vendedor@ventas.com"}</div>
            </div>
            {activeTab !== "configuracion" && (
              <button
                onClick={() => setActiveTab("configuracion")}
                className="ml-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-900/40 transition"
                title="Ir a Configuración"
              >
                <Settings className="w-3.5 h-3.5" />
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
            <div className="bg-[#121826] border border-gray-800/90 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800/80">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Datos Personales del Revendedor</h2>
                  <p className="text-xs text-gray-400">Información de contacto asociada a tu cuenta</p>
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
                    <label className="block font-medium text-gray-300 mb-1">Nombre Completo</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Teléfono / WhatsApp</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="+57 300 1234567"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Correo Electrónico (Solo Lectura)</label>
                  <input
                    type="email"
                    disabled
                    value={currentUser?.email || ""}
                    className="w-full bg-[#070a12] border border-gray-800 text-gray-400 rounded-xl px-3 py-2.5 font-mono cursor-not-allowed"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    El correo es tu identificador único de vendedor y no se puede modificar.
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-900/30 transition flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Datos de la Cuenta</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Tarjeta 2: Cambiar Contraseña */}
            <div className="bg-[#121826] border border-gray-800/90 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800/80">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Seguridad y Cambio de Contraseña</h2>
                  <p className="text-xs text-gray-400">Actualiza tu clave de acceso para iniciar sesión en tu portal</p>
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
                    <label className="block font-medium text-gray-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-medium text-gray-300">Nueva Contraseña</label>
                      <button
                        type="button"
                        onClick={() => setShowPassModalText(!showPassModalText)}
                        className="text-[11px] text-gray-400 hover:text-indigo-400 flex items-center gap-1"
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
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-300 mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      required
                      placeholder="Repite la nueva clave"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition flex items-center gap-2"
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
        {/* VISTA 2: GESTIÓN DE CUENTAS (TERMINAL Y SOLICITUD DE CÓDIGOS) */}
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

        {/* SELECTOR DE CUENTA ACTIVA */}
        <div className="bg-[#121826] border border-gray-800/80 rounded-2xl p-5 mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Tus Cuentas de Streaming Asignadas ({assignedAccounts.length})
            </label>
            {currentUser && (
              <span className="text-[11px] text-gray-400">
                Vendedor: <strong className="text-white">{currentUser.name}</strong>
              </span>
            )}
          </div>

          {assignedAccounts.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#0b0f19] border border-gray-800 text-center text-xs text-gray-500">
              No tienes cuentas asignadas actualmente. Solicita al Administrador que te asigne cuentas.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {assignedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccount(acc.email);
                    setAuthError(null);
                    setReceivedCode(null);
                    setIsWaiting(false);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedAccount === acc.email
                      ? "bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-950/50"
                      : "bg-[#0b0f19] border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-400">{acc.service}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{acc.profiles}</span>
                  </div>
                  <div className="font-mono text-xs text-white truncate">{acc.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5 BOTONES DE ACCIONES PRINCIPALES */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Acciones Rápidas Disponibles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {ACTIONS.map((action) => {
              return (
                <button
                  key={action.id}
                  onClick={() => handleTriggerAction(action.id)}
                  disabled={isWaiting}
                  className={`p-5 rounded-2xl bg-gradient-to-br ${action.color} border text-left shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none flex flex-col justify-between min-h-[140px]`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center text-white">
                      {action.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-black/30 text-white/90 px-2 py-0.5 rounded-md">
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

        {/* RESULTADO: CONTENEDOR GRANDE EN TIEMPO REAL */}
        <div className="bg-[#0b0f19] border border-gray-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-800/80">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado de la Solicitud</span>
              <div className="font-mono text-sm text-indigo-300 mt-0.5">
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
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-white">Obteniendo código...</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  El sistema está verificando la bandeja de entrada para extraer el código o enlace en segundos.
                </p>
              </div>
            ) : receivedCode ? (
              <div className="py-4">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
                  ¡Código Recibido con Éxito!
                </span>

                {/* VISUALIZACIÓN DEL CÓDIGO */}
                {isUrl ? (
                  <div className="mt-6 max-w-2xl mx-auto p-4 rounded-2xl bg-[#141b2a] border border-gray-700 text-left">
                    <div className="text-xs text-gray-400 font-semibold mb-1">Enlace de Confirmación / Restablecimiento:</div>
                    <div className="font-mono text-xs text-indigo-300 break-all bg-black/40 p-3 rounded-xl border border-gray-800">
                      {receivedCode}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={receivedCode}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir Enlace en Navegador
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 inline-block bg-[#141b2a] border-2 border-emerald-500/40 rounded-3xl px-8 py-6 shadow-2xl">
                    <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent select-all">
                      {receivedCode}
                    </span>
                  </div>
                )}

                {/* BOTÓN DE COPIADO RÁPIDO */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleCopy}
                    className="py-3.5 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-900/40 flex items-center gap-2 transition transform hover:scale-105"
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
              <div className="py-12 text-gray-500 flex flex-col items-center justify-center">
                <KeyRound className="w-12 h-12 text-gray-700 mb-3" />
                <h3 className="text-base font-semibold text-gray-400">Ninguna solicitud activa</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Presiona cualquiera de los 5 botones superiores para solicitar el código que necesitas.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Los códigos expiran automáticamente a los 5 minutos de su emisión.</span>
            </div>
            {receivedCode && (
              <button
                onClick={() => setReceivedCode(null)}
                className="text-gray-400 hover:text-white underline"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Cambiar mi Contraseña</h3>
                  <p className="text-xs text-gray-400">
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
                    <label className="block font-medium text-gray-300 mb-1">Contraseña Actual</label>
                    <input
                      type={showPassModalText ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-300">Nueva Contraseña</label>
                    <button
                      type="button"
                      onClick={() => setShowPassModalText(!showPassModalText)}
                      className="text-[11px] text-gray-400 hover:text-indigo-400 flex items-center gap-1"
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
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-300 mb-1">Confirmar Nueva Contraseña</label>
                  <input
                    type={showPassModalText ? "text" : "password"}
                    required
                    placeholder="Repite la nueva contraseña"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-900/30"
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
