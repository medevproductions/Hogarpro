import {
  getAccountsFromFirestore,
  saveAccountsToFirestore,
  deleteAccountsBatchFromFirestore,
  getUsersFromFirestore,
  saveUserToFirestore,
  saveUsersBatchToFirestore,
  deleteUserFromFirestore,
  getSalesFromFirestore,
  saveSaleToFirestore
} from "./firebase/firestore-service";

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "seller";
  password?: string;
  phone?: string;
  activeAccountsCount?: number;
  status: "active" | "suspended";
}

export interface StoredStreamingAccount {
  id: string;
  platform: string;
  email: string;
  password?: string;
  sellerId?: string; // id o email del vendedor
  sellerName?: string;
  maxProfiles: number;
  occupiedProfiles: number;
  expirationDate: string; // YYYY-MM-DD
  status: "available" | "assigned" | "expired";
  monthlyCost?: number;
  monthlyIncome?: number;
  notes?: string;
  country?: string; // ej: Colombia, México, Global
  isVerified?: boolean; // si la cuenta sirve / está comprobada
  customerName?: string; // cliente o a quién se le vendió (opcional)
  importBatchId?: string; // identificador único del lote importado
  importedAt?: string; // fecha ISO de cuando se importó
}

export interface ImportBatchRecord {
  id: string;
  platform: string;
  count: number;
  importedAt: string; // ISO
  filename?: string;
}

export interface CatalogPlatform {
  id: string;
  name: string;
  color: string;
  defaultProfiles: number;
  defaultCost: number;
  defaultIncome: number;
  price?: number;
  retailPrice?: number; // Precio al detal (cliente final)
  wholesalePrice?: number; // Precio al mayor (revendedor)
  category?: string;
  stock?: number;
  badge?: string;
  features?: string[];
}

export interface SaleRecord {
  id: string;
  date: string; // ISO string
  type: "detal" | "mayor"; // "detal" = Venta individual / en persona, "mayor" = Lote / revendedor
  platform: string;
  accountId?: string;
  accountEmail?: string;
  customerName: string;
  customerContact?: string;
  paymentMethod: "efectivo" | "nequi" | "daviplata" | "transferencia" | "binance" | "otro";
  costPrice: number; // Costo base invertido
  salePrice: number; // Precio cobrado al cliente
  profit: number; // Ganancia neta calculada o personalizada
  notes?: string;
  isPhysicalSale?: boolean; // Venta realizada en persona física
}

export interface ExpenseRecord {
  id: string;
  date: string; // ISO string o YYYY-MM-DD
  title: string;
  category: "proveedor" | "publicidad" | "servicios" | "comision" | "operativo" | "otro";
  amount: number;
  paymentMethod: "efectivo" | "nequi" | "daviplata" | "transferencia" | "binance" | "otro";
  supplier?: string;
  notes?: string;
}

export interface CalendarReminder {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: "renovacion" | "cobro" | "proveedor" | "general";
  priority: "urgente" | "normal" | "alta";
  completed: boolean;
  createdAt: string;
}

const STORAGE_KEY_USERS = "streamhub_registered_users";
const STORAGE_KEY_ACCOUNTS = "streamhub_master_accounts";
const STORAGE_KEY_CURRENT_USER = "streamhub_current_session";
const STORAGE_KEY_CATALOG = "streamhub_catalog_platforms";
const STORAGE_KEY_SALES = "streamhub_sales_records";
const STORAGE_KEY_EXPENSES = "streamhub_expense_records";
const STORAGE_KEY_REMINDERS = "streamhub_calendar_reminders";

export const DEFAULT_PLATFORMS: CatalogPlatform[] = [
  { 
    id: "plat-netflix",
    name: "Netflix Premium 4K", 
    color: "text-red-500 bg-red-950/40 border-red-500/30", 
    defaultProfiles: 5, 
    defaultCost: 2.00, 
    defaultIncome: 15.00,
    price: 3.50,
    category: "4K HDR • 1 Pantalla",
    stock: 14,
    badge: "Más Vendido",
    features: [
      "Calidad 4K Ultra HD + HDR",
      "Perfil individual con PIN exclusivo",
      "Códigos de acceso al instante 24/7",
      "Garantía total de 30 días"
    ]
  },
  { 
    id: "plat-disney",
    name: "Disney+ Standard", 
    color: "text-blue-400 bg-blue-950/40 border-blue-500/30", 
    defaultProfiles: 4, 
    defaultCost: 1.50, 
    defaultIncome: 10.00,
    price: 2.50,
    category: "Full HD • 1 Pantalla",
    stock: 8,
    features: [
      "Catálogo Disney, Marvel, Star & ESPN",
      "Sin interrupciones ni caídas",
      "Descargas offline disponibles",
      "Soporte inmediato por WhatsApp"
    ]
  },
  { 
    id: "plat-max",
    name: "Max (HBO Max)", 
    color: "text-indigo-400 bg-indigo-950/40 border-indigo-500/30", 
    defaultProfiles: 5, 
    defaultCost: 1.20, 
    defaultIncome: 12.50,
    price: 2.80,
    category: "4K UHD • 3 Dispositivos",
    stock: 12,
    badge: "Estreno House of Dragon",
    features: [
      "Series HBO, Warner Bros, Discovery & DC",
      "Perfiles simultáneos activos",
      "Audio Dolby Atmos envolvente",
      "Activación inmediata al pagar"
    ]
  },
  { 
    id: "plat-prime",
    name: "Prime Video", 
    color: "text-sky-400 bg-sky-950/40 border-sky-500/30", 
    defaultProfiles: 3, 
    defaultCost: 1.00, 
    defaultIncome: 6.00,
    price: 1.80,
    category: "4K HDR • 2 Pantallas",
    stock: 20,
    features: [
      "Envíos Prime + Video streaming",
      "Contenido original exclusivo Amazon",
      "Modo niños y control parental",
      "Acceso garantizado mes a mes"
    ]
  },
  { 
    id: "plat-spotify",
    name: "Spotify Familiar", 
    color: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30", 
    defaultProfiles: 6, 
    defaultCost: 0.90, 
    defaultIncome: 12.00,
    price: 2.20,
    category: "Música Sin Límites",
    stock: 15,
    badge: "A tu propio correo",
    features: [
      "Sin anuncios, música offline",
      "Máxima calidad de audio (320kbps)",
      "Saltos de canción ilimitados",
      "Renovación limpia mes a mes"
    ]
  },
  { 
    id: "plat-crunchyroll",
    name: "Crunchyroll Mega Fan", 
    color: "text-amber-500 bg-amber-950/40 border-amber-500/30", 
    defaultProfiles: 4, 
    defaultCost: 1.10, 
    defaultIncome: 8.00,
    price: 2.00,
    category: "Anime HD • Sin Anuncios",
    stock: 11,
    features: [
      "Simulcast estreno 1h después de Japón",
      "Visionado sin anuncios ni restricciones",
      "Acceso ilimitado a manga",
      "Garantía mes completo"
    ]
  }
];

export function getCatalogPlatforms(): CatalogPlatform[] {
  if (typeof window === "undefined") return DEFAULT_PLATFORMS;
  const stored = localStorage.getItem(STORAGE_KEY_CATALOG);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(DEFAULT_PLATFORMS));
    return DEFAULT_PLATFORMS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_PLATFORMS;
  }
}

export function saveCatalogPlatforms(platforms: CatalogPlatform[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(platforms));
    window.dispatchEvent(new Event("streamhub_catalog_updated"));
  }
}

// Datos por defecto si no hay nada en storage
const DEFAULT_SELLERS: SystemUser[] = [
  { id: "s-1", email: "carlos@ventas.com", name: "Carlos Vendedor", role: "seller", phone: "+58 412 1112233", status: "active" },
  { id: "s-2", email: "maria@ventas.com", name: "Maria Ventas", role: "seller", phone: "+57 300 4445566", status: "active" },
  { id: "s-3", email: "andres@ventas.com", name: "Andrés Gomez", role: "seller", phone: "+57 311 9998877", status: "active" }
];

const DEFAULT_ACCOUNTS: StoredStreamingAccount[] = [
  {
    id: "acc-1",
    platform: "Netflix",
    email: "hogaryutu+acido@gmail.com",
    password: "Password2026*",
    sellerId: "s-1",
    sellerName: "Carlos Vendedor",
    maxProfiles: 5,
    occupiedProfiles: 4,
    expirationDate: "2026-10-31",
    status: "assigned",
    notes: "Cuenta de prueba activa asignada a Carlos"
  },
  {
    id: "acc-2",
    platform: "Netflix",
    email: "ishowhogar+gorra@gmail.com",
    password: "Password2026*",
    sellerId: "s-2",
    sellerName: "Maria Ventas",
    maxProfiles: 5,
    occupiedProfiles: 2,
    expirationDate: "2026-08-01", // Ya vencida para probar bloqueo de expiración
    status: "expired",
    notes: "Cuenta con plazo vencido"
  }
];

export async function syncAccountsFromCloud(force: boolean = false): Promise<StoredStreamingAccount[]> {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;
  try {
    const cloudAccounts = await getAccountsFromFirestore();
    const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    const local = stored ? JSON.parse(stored) : [];

    if (cloudAccounts && cloudAccounts.length > 0) {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(cloudAccounts));
      window.dispatchEvent(new Event("streamhub_accounts_updated"));
      return cloudAccounts;
    } else if (local && local.length > 0) {
      // Subir a la nube SOLO si no son las 2 cuentas dummy
      const isDummyOnly = local.length <= 2 && local.every((a: any) => a.id === "acc-1" || a.id === "acc-2");
      if (!isDummyOnly) {
        saveAccountsToFirestore(local).catch(console.warn);
      }
    }
    return local.length > 0 ? local : DEFAULT_ACCOUNTS;
  } catch (err) {
    console.warn("[SYNC] Error sincronizando cuentas desde Firestore:", err);
    const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    return stored ? JSON.parse(stored) : DEFAULT_ACCOUNTS;
  }
}

export async function syncUsersFromCloud(force: boolean = false): Promise<SystemUser[]> {
  if (typeof window === "undefined") return DEFAULT_SELLERS;
  try {
    const cloudUsers = await getUsersFromFirestore();
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    const local = stored ? JSON.parse(stored) : [];

    if (cloudUsers && cloudUsers.length > 0) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(cloudUsers));
      window.dispatchEvent(new Event("streamhub_users_updated"));
      return cloudUsers;
    } else if (local && local.length > 0) {
      const isDummyOnly = local.length <= 3 && local.every((u: any) => u.id === "s-1" || u.id === "s-2" || u.id === "s-3");
      if (!isDummyOnly) {
        saveUsersBatchToFirestore(local).catch(console.warn);
      }
    }
    return local.length > 0 ? local : DEFAULT_SELLERS;
  } catch (err) {
    console.warn("[SYNC] Error sincronizando usuarios desde Firestore:", err);
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    return stored ? JSON.parse(stored) : DEFAULT_SELLERS;
  }
}

export function getSystemUsers(): SystemUser[] {
  if (typeof window === "undefined") return DEFAULT_SELLERS;

  // Disparar sincronización con la nube
  syncUsersFromCloud().catch(console.warn);

  const stored = localStorage.getItem(STORAGE_KEY_USERS);
  if (!stored) {
    return DEFAULT_SELLERS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_SELLERS;
  }
}

export function saveSystemUsers(users: SystemUser[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    window.dispatchEvent(new Event("streamhub_users_updated"));
    // Guardar en Cloud Firestore
    saveUsersBatchToFirestore(users).catch(err => {
      console.warn("[CLOUD] Error guardando usuarios en Firestore:", err);
    });
  }
}

export function saveSystemUser(user: SystemUser) {
  const users = getSystemUsers();
  const existingIndex = users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...user };
  } else {
    users.push(user);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    window.dispatchEvent(new Event("streamhub_users_updated"));
    // Guardar en Cloud Firestore
    saveUserToFirestore(user).catch(err => {
      console.warn("[CLOUD] Error guardando usuario en Firestore:", err);
    });
  }
}

export function deleteSystemUser(userId: string) {
  const users = getSystemUsers();
  const filtered = users.filter(u => u.id !== userId);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered));
    window.dispatchEvent(new Event("streamhub_users_updated"));
    // Eliminar de Cloud Firestore
    deleteUserFromFirestore(userId).catch(err => {
      console.warn("[CLOUD] Error eliminando usuario en Firestore:", err);
    });
  }
}

export function getStoredAccounts(): StoredStreamingAccount[] {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;

  // Sincronizar en segundo plano con la nube
  syncAccountsFromCloud().catch(console.warn);

  const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  if (!stored) {
    return DEFAULT_ACCOUNTS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function saveStoredAccounts(accounts: StoredStreamingAccount[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    window.dispatchEvent(new Event("streamhub_accounts_updated"));
    // Guardar en Cloud Firestore
    saveAccountsToFirestore(accounts).catch(err => {
      console.warn("[CLOUD] Error guardando cuentas en Firestore:", err);
    });
  }
}

export function deleteImportBatch(batchId: string): number {
  const accounts = getStoredAccounts();
  const toKeep = accounts.filter(a => a.importBatchId !== batchId);
  const deletedCount = accounts.length - toKeep.length;
  saveStoredAccounts(toKeep);
  deleteAccountsBatchFromFirestore(batchId).catch(console.warn);
  return deletedCount;
}

export const DEFAULT_SALES: SaleRecord[] = [
  {
    id: "sale-101",
    date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    type: "detal",
    platform: "Netflix Premium 4K",
    accountEmail: "netflix.4k.master@hogarpro.com",
    customerName: "Carlos Gómez (WhatsApp)",
    customerContact: "+57 300 123 4567",
    paymentMethod: "nequi",
    costPrice: 2.0,
    salePrice: 4.5,
    profit: 2.5,
    notes: "Perfil 1 con PIN asignado",
    isPhysicalSale: false
  },
  {
    id: "sale-102",
    date: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    type: "detal",
    platform: "Disney+ Standard",
    accountEmail: "disney.family.plus@hogarpro.com",
    customerName: "Mateo Pérez (En Persona)",
    customerContact: "Entregado en persona",
    paymentMethod: "efectivo",
    costPrice: 1.5,
    salePrice: 3.5,
    profit: 2.0,
    notes: "Pago en efectivo en mano",
    isPhysicalSale: true
  },
  {
    id: "sale-103",
    date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    type: "mayor",
    platform: "Max (HBO Max)",
    accountEmail: "max.hbo.latam@hogarpro.com",
    customerName: "Andrés Mayorista (Revendedor)",
    customerContact: "+57 312 987 6543",
    paymentMethod: "transferencia",
    costPrice: 5.0,
    salePrice: 10.0,
    profit: 5.0,
    notes: "Lote de cuentas al mayor",
    isPhysicalSale: false
  }
];

export function getStoredSales(): SaleRecord[] {
  if (typeof window === "undefined") return DEFAULT_SALES;
  const stored = localStorage.getItem(STORAGE_KEY_SALES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(DEFAULT_SALES));
    return DEFAULT_SALES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_SALES;
  }
}

export function saveStoredSales(sales: SaleRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
    window.dispatchEvent(new Event("streamhub_sales_updated"));
  }
}

export const DEFAULT_EXPENSES: ExpenseRecord[] = [
  {
    id: "exp-1",
    date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split("T")[0],
    title: "Compra lote cuentas Netflix a proveedor",
    category: "proveedor",
    amount: 25.0,
    paymentMethod: "binance",
    supplier: "MegaStream Supplier",
    notes: "Lote de 15 cuentas con garantía 30 días"
  },
  {
    id: "exp-2",
    date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
    title: "Campaña publicitaria en redes (Facebook / WhatsApp)",
    category: "publicidad",
    amount: 12.0,
    paymentMethod: "nequi",
    notes: "Anuncios dirigidos a venta de combos"
  },
  {
    id: "exp-3",
    date: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split("T")[0],
    title: "Servidor proxy y pasarela de webhooks",
    category: "servicios",
    amount: 8.5,
    paymentMethod: "transferencia",
    notes: "Renovación mensual de infraestructura"
  }
];

export function getStoredExpenses(): ExpenseRecord[] {
  if (typeof window === "undefined") return DEFAULT_EXPENSES;
  const stored = localStorage.getItem(STORAGE_KEY_EXPENSES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
    return DEFAULT_EXPENSES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_EXPENSES;
  }
}

export function saveStoredExpenses(expenses: ExpenseRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    window.dispatchEvent(new Event("streamhub_expenses_updated"));
  }
}

export function getStoredReminders(): CalendarReminder[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY_REMINDERS);
  if (!stored) {
    // Recordatorios de demostración / iniciales si está vacío
    const initialReminders: CalendarReminder[] = [
      {
        id: "rem-1",
        date: new Date().toISOString().split("T")[0],
        title: "Revisar cuentas de Netflix por vencer esta semana",
        category: "renovacion",
        priority: "alta",
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "rem-2",
        date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        title: "Cobrar mensualidad a revendedor de lote Disney+",
        category: "cobro",
        priority: "normal",
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];
    saveStoredReminders(initialReminders);
    return initialReminders;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveStoredReminders(reminders: CalendarReminder[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
    window.dispatchEvent(new Event("streamhub_reminders_updated"));
  }
}

export function addCalendarReminder(reminder: Omit<CalendarReminder, "id" | "createdAt">): CalendarReminder {
  const current = getStoredReminders();
  const newReminder: CalendarReminder = {
    ...reminder,
    id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString()
  };
  const updated = [newReminder, ...current];
  saveStoredReminders(updated);
  return newReminder;
}

export function deleteCalendarReminder(id: string) {
  const current = getStoredReminders();
  const updated = current.filter(r => r.id !== id);
  saveStoredReminders(updated);
}

export function toggleCalendarReminder(id: string) {
  const current = getStoredReminders();
  const updated = current.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
  saveStoredReminders(updated);
}

export function getCurrentUser(): SystemUser | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: SystemUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    // Eliminar cookie de sesión
    document.cookie = "hp_session=; path=/; max-age=0; SameSite=Lax";
  } else {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    // Sincronizar cookie de sesión segura para Next.js Middleware
    try {
      const sessionData = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        exp: Date.now() + 7 * 24 * 3600 * 1000 // 7 días de validez
      };
      const token = btoa(encodeURIComponent(JSON.stringify(sessionData)));
      document.cookie = `hp_session=${token}; path=/; max-age=604800; SameSite=Lax`;
    } catch (e) {
      // Fallback seguro
    }
  }
}

/**
 * Validador Estricto de Seguridad:
 * Verifica si un correo está asignado al vendedor actual Y que su fecha no esté vencida
 */
export function checkAccountAuthorization(accountEmail: string, user: SystemUser | null): {
  authorized: boolean;
  reason?: string;
  account?: StoredStreamingAccount;
} {
  const cleanEmail = accountEmail.trim().toLowerCase();

  // El Owner tiene acceso maestro e irrestricto
  if (user?.role === "owner") {
    return { authorized: true };
  }

  if (!user) {
    return {
      authorized: false,
      reason: "Debes iniciar sesión como vendedor para consultar códigos de tus cuentas."
    };
  }

  const accounts = getStoredAccounts();
  const match = accounts.find(a => a.email.toLowerCase().trim() === cleanEmail);

  if (!match) {
    return {
      authorized: false,
      reason: "Esta cuenta no está registrada en el sistema."
    };
  }

  // Verificar si está asignada a este vendedor
  const uName = (user.name || "").toLowerCase().trim();
  const uEmail = (user.email || "").toLowerCase().trim();
  const uId = (user.id || "").toLowerCase().trim();
  const sId = (match.sellerId || "").toLowerCase().trim();
  const sName = (match.sellerName || (match as any).seller || "").toLowerCase().trim();
  const sCustomer = (match.customerName || "").toLowerCase().trim();

  const isAssignedToUser = 
    (sId && (sId === uId || sId === uEmail)) || 
    (sName && (sName === uName || sName === uEmail || uName.includes(sName) || sName.includes(uName))) ||
    (sCustomer && (sCustomer === uName || sCustomer === uEmail));

  if (!isAssignedToUser) {
    return {
      authorized: false,
      reason: "Esta cuenta no está asignada a tu usuario. No tienes permisos para ver sus códigos."
    };
  }

  // Verificar si la fecha de expiración/renovación ya pasó
  if (match.expirationDate) {
    const expDate = new Date(match.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expDate < today) {
      return {
        authorized: false,
        reason: `El plazo de renovación de esta cuenta expiró el ${match.expirationDate}. Contacta al administrador para renovarla.`
      };
    }
  }

  return { authorized: true, account: match };
}
