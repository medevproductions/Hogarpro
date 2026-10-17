import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";

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
    return { success: false, error: "Firebase no está configurado aún en las variables de entorno." };
  }

  try {
    const cleanEmail = payload.account_email.toLowerCase().trim();
    const reqsRef = collection(db, COLLECTION_NAME);

    // Buscar si hay una solicitud pendiente reciente para este correo
    const q = query(
      reqsRef,
      where("account_email", "==", cleanEmail),
      orderBy("created_at", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const pendingDoc = snapshot.docs[0];
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
    const thresholdDate = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const reqsRef = collection(db, COLLECTION_NAME);

    const q = query(
      reqsRef,
      where("status", "==", "pendiente"),
      where("created_at", ">=", thresholdDate),
      orderBy("created_at", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreCodeRequest));
  } catch (error: any) {
    console.warn("[FIRESTORE] Advertencia consultando pendientes:", error?.message);
    return [];
  }
}

/**
 * Consulta el código más reciente de una cuenta en Firestore
 */
export async function getRecentCodeFromFirestore(accountEmail: string): Promise<FirestoreCodeRequest | null> {
  if (!db || !isFirebaseConfigured()) {
    return null;
  }

  try {
    const cleanEmail = accountEmail.toLowerCase().trim();
    const reqsRef = collection(db, COLLECTION_NAME);

    const q = query(
      reqsRef,
      where("account_email", "==", cleanEmail),
      orderBy("created_at", "desc"),
      limit(3)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const matched = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as FirestoreCodeRequest))
      .find(r => r.extracted_code && r.status === "completado");

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
