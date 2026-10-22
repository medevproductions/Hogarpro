import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";
import { SystemUser, saveSystemUser, setCurrentUser } from "@/lib/account-manager";

export interface AuthResult {
  success: boolean;
  user?: SystemUser;
  error?: string;
}

/**
 * Autentica un usuario (Admin o Revendedor) directamente contra Firebase Cloud Firestore
 */
export async function authenticateWithFirebase(
  email: string, 
  password: string
): Promise<AuthResult> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanEmail || !cleanPass) {
    return { success: false, error: "Por favor ingresa tu correo y contraseña." };
  }

  const firestore = db;

  // 1. Si Firebase está configurado, autenticar directamente contra Firestore
  if (firestore && isFirebaseConfigured()) {
    try {
      const usersCol = collection(firestore, "system_users");
      const q = query(usersCol, where("email", "==", cleanEmail));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const userData = { id: docSnap.id, ...docSnap.data() } as SystemUser;

        // Verificar estado de la cuenta
        if (userData.status === "suspended") {
          return {
            success: false,
            error: "Tu cuenta se encuentra suspendida. Contacta al administrador."
          };
        }

        // Validar contraseña
        const storedPassword = (userData.password || "").trim();
        if (storedPassword && storedPassword !== cleanPass) {
          return {
            success: false,
            error: "Contraseña incorrecta. Por favor verifica tus datos."
          };
        }

        // Registrar timestamp de último acceso en segundo plano
        updateDoc(doc(firestore, "system_users", userData.id), {
          last_login_at: new Date().toISOString()
        }).catch(() => {});

        // Sincronizar en caché local y establecer sesión
        saveSystemUser(userData);
        setCurrentUser(userData);

        return { success: true, user: userData };
      }

      // Si no se encontró en Firestore, verificar si son las credenciales maestras del administrador
      const isMasterAdmin = 
        (cleanEmail === "admin@hogarpro.com" && cleanPass === "admin2026") ||
        (cleanEmail === "owner@hogarpro.com" && cleanPass === "owner123");

      if (isMasterAdmin) {
        const masterAdmin: SystemUser = {
          id: "owner-1",
          email: cleanEmail,
          name: "Administrador Maestro",
          role: "owner",
          password: cleanPass,
          status: "active"
        };

        // Sembrar el administrador en Firebase Firestore para que persista
        await setDoc(doc(firestore, "system_users", masterAdmin.id), {
          ...masterAdmin,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });

        saveSystemUser(masterAdmin);
        setCurrentUser(masterAdmin);

        return { success: true, user: masterAdmin };
      }

      return {
        success: false,
        error: "Usuario o contraseña incorrectos. Si eres revendedor nuevo, por favor regístrate."
      };
    } catch (err: any) {
      console.warn("[FIREBASE AUTH] Error consultando Firestore:", err?.message);
    }
  }

  // 2. Fallback de respaldo: Verificar usuarios guardados localmente
  const localUsers = typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("streamhub_registered_users") || "[]")) : [];
  const matchedLocal = localUsers.find((u: SystemUser) => u.email.toLowerCase().trim() === cleanEmail);
  if (matchedLocal) {
    if (matchedLocal.status === "suspended") {
      return { success: false, error: "Tu cuenta se encuentra suspendida. Contacta al administrador." };
    }
    const storedPass = (matchedLocal.password || "").trim();
    if (storedPass && storedPass !== cleanPass) {
      return { success: false, error: "Contraseña incorrecta. Por favor verifica tus datos." };
    }
    setCurrentUser(matchedLocal);
    return { success: true, user: matchedLocal };
  }

  // 3. Fallback de respaldo para Administrador Maestro
  const isMasterAdminFallback = 
    (cleanEmail === "admin@hogarpro.com" && cleanPass === "admin2026") ||
    (cleanEmail === "owner@hogarpro.com" && cleanPass === "owner123");

  if (isMasterAdminFallback) {
    const adminUser: SystemUser = {
      id: "owner-1",
      email: cleanEmail,
      name: "Administrador Maestro",
      role: "owner",
      status: "active"
    };
    saveSystemUser(adminUser);
    setCurrentUser(adminUser);
    return { success: true, user: adminUser };
  }

  return {
    success: false,
    error: "Usuario o contraseña incorrectos. Si no tienes cuenta, por favor regístrate."
  };
}

/**
 * Registra un nuevo revendedor directamente en Firebase Cloud Firestore
 */
export async function registerSellerWithFirebase(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const cleanEmail = (data.email || "").trim().toLowerCase();
  const cleanPass = (data.password || "").trim();
  const cleanName = (data.name || "").trim();
  const cleanPhone = (data.phone || "").trim() || "Sin teléfono";

  if (!cleanEmail || !cleanPass || !cleanName) {
    return { success: false, error: "Por favor completa todos los campos requeridos." };
  }

  const firestore = db;

  const newSeller: SystemUser = {
    id: `s-${Date.now().toString().slice(-5)}`,
    name: cleanName,
    email: cleanEmail,
    password: cleanPass,
    phone: cleanPhone,
    role: "seller",
    status: "active",
    activeAccountsCount: 0
  };

  if (firestore && isFirebaseConfigured()) {
    try {
      const usersCol = collection(firestore, "system_users");
      const q = query(usersCol, where("email", "==", cleanEmail));
      const existingSnap = await getDocs(q);

      if (!existingSnap.empty) {
        return {
          success: false,
          error: "Este correo ya se encuentra registrado. Por favor inicia sesión."
        };
      }

      await setDoc(doc(firestore, "system_users", newSeller.id), {
        ...newSeller,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      saveSystemUser(newSeller);
      setCurrentUser(newSeller);

      return { success: true, user: newSeller };
    } catch (err: any) {
      console.warn("[FIREBASE REGISTER] Error registrando usuario en la nube:", err?.message);
      // Guardar localmente y permitir acceso de inmediato
      saveSystemUser(newSeller);
      setCurrentUser(newSeller);
      return { success: true, user: newSeller };
    }
  }

  // Fallback seguro
  saveSystemUser(newSeller);
  setCurrentUser(newSeller);
  return { success: true, user: newSeller };
}

/**
 * Actualiza la contraseña de un usuario en Firebase Firestore
 */
export async function updatePasswordInFirebase(
  userId: string, 
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPass = (newPassword || "").trim();
  if (!cleanPass) return { success: false, error: "La contraseña no puede estar vacía." };

  const firestore = db;
  if (!firestore || !isFirebaseConfigured()) {
    return { success: false, error: "Servicio de contraseñas no disponible temporalmente." };
  }

  try {
    const userRef = doc(firestore, "system_users", userId);
    await updateDoc(userRef, {
      password: cleanPass,
      updated_at: new Date().toISOString()
    });
    return { success: true };
  } catch (err: any) {
    console.warn("[FIREBASE PASS] Error actualizando contraseña:", err?.message);
    return { success: false, error: err?.message };
  }
}
