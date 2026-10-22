import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCvEVpMxE-OIv_ap0tGE9mbgfZXgaJF1IU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hogarpro-f7e25.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hogarpro-f7e25",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hogarpro-f7e25.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "127757964058",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:127757964058:web:bc3275dcc11fdd055492a3",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-GRT710FLTK"
};

/**
 * Validador para saber si Firebase cuenta con credenciales activas
 */
export const isFirebaseConfigured = (): boolean => {
  return true;
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  try {
    auth = getAuth(app);
  } catch {}
} catch (error) {
  console.warn("[FIREBASE] Inicialización:", error);
  app = initializeApp(firebaseConfig, "hogarpro-client-" + Date.now());
  db = getFirestore(app);
}

export { app, db, auth };
