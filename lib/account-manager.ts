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
  category?: string;
  stock?: number;
  badge?: string;
  features?: string[];
}

const STORAGE_KEY_USERS = "streamhub_registered_users";
const STORAGE_KEY_ACCOUNTS = "streamhub_master_accounts";
const STORAGE_KEY_CURRENT_USER = "streamhub_current_session";
const STORAGE_KEY_CATALOG = "streamhub_catalog_platforms";

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

export function getSystemUsers(): SystemUser[] {
  if (typeof window === "undefined") return DEFAULT_SELLERS;
  const stored = localStorage.getItem(STORAGE_KEY_USERS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_SELLERS));
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
  }
}

export function deleteSystemUser(userId: string) {
  const users = getSystemUsers();
  const filtered = users.filter(u => u.id !== userId);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered));
    window.dispatchEvent(new Event("streamhub_users_updated"));
  }
}

export function getStoredAccounts(): StoredStreamingAccount[] {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;
  const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
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
  }
}

export function deleteImportBatch(batchId: string): number {
  const accounts = getStoredAccounts();
  const toKeep = accounts.filter(a => a.importBatchId !== batchId);
  const deletedCount = accounts.length - toKeep.length;
  saveStoredAccounts(toKeep);
  return deletedCount;
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
  } else {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
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
  const isAssignedToUser = 
    match.sellerId === user.id || 
    match.sellerId === user.email || 
    match.sellerName?.toLowerCase() === user.name?.toLowerCase();

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
