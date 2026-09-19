export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "seller";
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
}

const STORAGE_KEY_USERS = "streamhub_registered_users";
const STORAGE_KEY_ACCOUNTS = "streamhub_master_accounts";
const STORAGE_KEY_CURRENT_USER = "streamhub_current_session";

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
  }
}

export function saveSystemUser(user: SystemUser) {
  const users = getSystemUsers();
  const existingIndex = users.findIndex(u => u.id === user.id || u.email === user.email);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
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
  }
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
