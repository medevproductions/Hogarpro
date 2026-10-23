import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  writeBatch,
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";
import type { StoredStreamingAccount, SystemUser, SaleRecord } from "@/lib/account-manager";

export interface FirestoreCodeRequest {
  id?: string;
  account_email: string;
  action_type: string;
  extracted_code?: string;
  status: "pendiente" | "completado" | "expirado";
  service?: string;
  raw_subject?: string;
  raw_body?: string;
  created_at: string;
  updated_at: string;
}

const COLLECTION_NAME = "code_requests";
const COLLECTION_ACCOUNTS = "streaming_accounts";
const COLLECTION_USERS = "system_users";
const COLLECTION_SALES = "sales_records";

/**
 * Guarda o actualiza un código recibido en Firestore
 */
export async function saveIncomingCodeToFirestore(payload: {
  account_email: string;
  extracted_code: string;
  action_type: string;
  raw_subject?: string;
  raw_body?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!db || !isFirebaseConfigured()) {
    return { success: false, error: "Servicio de base de datos no disponible temporalmente." };
  }

  try {
    const cleanEmail = payload.account_email.toLowerCase().trim();
    const reqsRef = collection(db, COLLECTION_NAME);

    // Buscar si hay una solicitud pendiente reciente para este correo (sin requerir índice compuesto)
    const q = query(
      reqsRef,
      where("account_email", "==", cleanEmail)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const sortedDocs = [...snapshot.docs].sort((a, b) => {
        const timeA = new Date(a.data().updated_at || a.data().created_at || 0).getTime();
        const timeB = new Date(b.data().updated_at || b.data().created_at || 0).getTime();
        return timeB - timeA;
      });
      const pendingDoc = sortedDocs[0];
      const data = pendingDoc.data();

      // Si está pendiente o es reciente, actualizarla
      await updateDoc(doc(db, COLLECTION_NAME, pendingDoc.id), {
        extracted_code: payload.extracted_code,
        status: "completado",
        action_type: payload.action_type || data.action_type || "login_code",
        raw_subject: payload.raw_subject || "",
        raw_body: payload.raw_body || "",
        updated_at: new Date().toISOString()
      });

      return { success: true, id: pendingDoc.id };
    }

    // Si no había solicitud previa, crear nuevo documento
    const newDoc = await addDoc(reqsRef, {
      account_email: cleanEmail,
      extracted_code: payload.extracted_code,
      action_type: payload.action_type || "login_code",
      status: "completado",
      raw_subject: payload.raw_subject || "",
      raw_body: payload.raw_body || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return { success: true, id: newDoc.id };
  } catch (error: any) {
    console.error("[FIRESTORE] Error guardando código:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Consulta solicitudes pendientes en los últimos X minutos
 */
export async function getPendingCodeRequestsFirestore(minutes: number = 15): Promise<FirestoreCodeRequest[]> {
  if (!db || !isFirebaseConfigured()) {
    return [];
  }

  try {
    const thresholdMs = Date.now() - minutes * 60 * 1000;
    const reqsRef = collection(db, COLLECTION_NAME);

    // Consulta simple por estado (no requiere índice compuesto)
    const q = query(
      reqsRef,
      where("status", "==", "pendiente")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as FirestoreCodeRequest))
      .filter(d => new Date(d.created_at || 0).getTime() >= thresholdMs)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 10);
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando pendientes:", error?.message);
    return [];
  }
}

/**
 * Consulta el código más reciente de una cuenta en Firestore
 */
export async function getRecentCodeFromFirestore(accountEmail: string, actionType?: string): Promise<FirestoreCodeRequest | null> {
  if (!db || !isFirebaseConfigured()) {
    return null;
  }

  try {
    const cleanEmail = accountEmail.toLowerCase().trim();
    const reqsRef = collection(db, COLLECTION_NAME);

    // Consulta por correo (no requiere índice compuesto)
    const q = query(
      reqsRef,
      where("account_email", "==", cleanEmail)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const now = Date.now();
    const MAX_AGE_MS = 15 * 60 * 1000; // Máximo 15 minutos de antigüedad

    const sorted = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as FirestoreCodeRequest))
      .sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

    const matched = sorted.find(r => {
      if (!r.extracted_code || r.status !== "completado") return false;
      // Solo aceptar si la acción solicitada coincide con la acción del registro (soporta aliases)
      if (actionType && r.action_type) {
        const reqA = actionType.toLowerCase().replace(/_/g, "");
        const recA = r.action_type.toLowerCase().replace(/_/g, "");
        const matches = reqA === recA ||
          (reqA.includes("hogar") && recA.includes("actualizar")) ||
          (reqA.includes("actualizar") && recA.includes("hogar")) ||
          (reqA.includes("temporal") && recA.includes("temporal")) ||
          (reqA.includes("login") && recA.includes("login")) ||
          (reqA.includes("verific") && recA.includes("verific")) ||
          (reqA.includes("pass") && recA.includes("pass")) ||
          (reqA.includes("clave") && recA.includes("pass"));
        if (!matches) return false;
      }
      const timeStr = r.updated_at || r.created_at;
      if (timeStr) {
        const age = now - new Date(timeStr).getTime();
        if (age > MAX_AGE_MS) return false; // Descartar códigos expirados (>15 min)
      }
      return true;
    });

    return matched || null;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando código reciente:", error?.message);
    return null;
  }
}

/**
 * Inserta una nueva solicitud pendiente en Firestore
 */
export async function createPendingCodeRequestFirestore(payload: {
  account_email: string;
  action_type: string;
  service?: string;
}): Promise<{ success: boolean; id?: string }> {
  if (!db || !isFirebaseConfigured()) {
    return { success: false };
  }

  try {
    const cleanEmail = payload.account_email.toLowerCase().trim();
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      account_email: cleanEmail,
      action_type: payload.action_type,
      service: payload.service || "all",
      status: "pendiente",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.warn("[FIRESTORE] Advertencia creando pendiente:", error);
    return { success: false };
  }
}

// ==========================================
// CUENTAS DE STREAMING (streaming_accounts)
// ==========================================

export async function getAccountsFromFirestore(): Promise<StoredStreamingAccount[]> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured()) return [];
  try {
    const colRef = collection(firestore, COLLECTION_ACCOUNTS);
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data
      } as StoredStreamingAccount;
    });
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando streaming_accounts:", error?.message);
    return [];
  }
}

export async function saveAccountsToFirestore(accounts: StoredStreamingAccount[]): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !accounts || accounts.length === 0) return false;
  try {
    const BATCH_SIZE = 450;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = accounts.slice(i, i + BATCH_SIZE);
      chunk.forEach(acc => {
        const docId = acc.id || `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const docRef = doc(firestore, COLLECTION_ACCOUNTS, docId);
        batch.set(docRef, { ...acc, id: docId, updated_at: new Date().toISOString() }, { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia guardando streaming_accounts:", error?.message);
    return false;
  }
}

export async function saveSingleAccountToFirestore(account: StoredStreamingAccount): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !account) return false;
  try {
    const docId = account.id || `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(firestore, COLLECTION_ACCOUNTS, docId);
    await setDoc(docRef, { ...account, id: docId, updated_at: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia guardando cuenta individual:", error?.message);
    return false;
  }
}

export async function deleteAccountFromFirestore(accountId: string): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !accountId) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTION_ACCOUNTS, accountId));
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia eliminando cuenta:", error?.message);
    return false;
  }
}

export async function deleteAccountsBatchFromFirestore(batchId: string): Promise<number> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !batchId) return 0;
  try {
    const colRef = collection(firestore, COLLECTION_ACCOUNTS);
    const q = query(colRef, where("importBatchId", "==", batchId));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    
    const batch = writeBatch(firestore);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return snap.docs.length;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia eliminando lote de cuentas:", error?.message);
    return 0;
  }
}

// ==========================================
// REVENDEDORES Y USUARIOS (system_users)
// ==========================================

export async function getUsersFromFirestore(): Promise<SystemUser[]> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured()) return [];
  try {
    const colRef = collection(firestore, COLLECTION_USERS);
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data
      } as SystemUser;
    });
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando system_users:", error?.message);
    return [];
  }
}

export async function saveUserToFirestore(user: SystemUser): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !user) return false;
  try {
    const docId = user.id || `s-${Date.now().toString().slice(-4)}`;
    const docRef = doc(firestore, COLLECTION_USERS, docId);
    await setDoc(docRef, { ...user, id: docId, updated_at: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia guardando usuario:", error?.message);
    return false;
  }
}

export async function saveUsersBatchToFirestore(users: SystemUser[]): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !users || users.length === 0) return false;
  try {
    const batch = writeBatch(firestore);
    users.forEach(u => {
      const docId = u.id || `s-${Date.now().toString().slice(-4)}`;
      const docRef = doc(firestore, COLLECTION_USERS, docId);
      batch.set(docRef, { ...u, id: docId, updated_at: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia guardando lote de usuarios:", error?.message);
    return false;
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !userId) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTION_USERS, userId));
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia eliminando usuario:", error?.message);
    return false;
  }
}

// ==========================================
// REGISTROS DE VENTAS (sales_records)
// ==========================================

export async function getSalesFromFirestore(): Promise<SaleRecord[]> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured()) return [];
  try {
    const colRef = collection(firestore, COLLECTION_SALES);
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data
      } as SaleRecord;
    });
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando sales_records:", error?.message);
    return [];
  }
}

export async function saveSaleToFirestore(sale: SaleRecord): Promise<boolean> {
  const firestore = db;
  if (!firestore || !isFirebaseConfigured() || !sale) return false;
  try {
    const docId = sale.id || `sale-${Date.now()}`;
    const docRef = doc(firestore, COLLECTION_SALES, docId);
    await setDoc(docRef, { ...sale, id: docId, updated_at: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia guardando venta:", error?.message);
    return false;
  }
}

