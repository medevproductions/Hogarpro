import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSecret, sanitizeInput, isValidEmail } from "@/lib/security";
import { saveIncomingCodeToFirestore } from "@/lib/firebase/firestore-service";

export type CodeActionType = 
  | "actualizar" 
  | "temporal" 
  | "login_code" 
  | "login_confirm" 
  | "reset_password";

interface ProcessCodePayload {
  account_email: string;
  extracted_code: string;
  action_type: CodeActionType;
  raw_subject?: string;
  raw_body?: string;
}

/**
 * Función central para procesar y actualizar la solicitud de código en Cloud Firestore
 * Protegida con autenticación estricta de Webhook Secret y sanitización
 */
// Memoria compartida del servidor para entrega instantánea garantizada
const memoryStore = new Map<string, { code: string; timestamp: number; service?: string; actionType?: string }>();

export { memoryStore };

export async function processIncomingCode(payload: ProcessCodePayload, authHeader: string | null) {
  try {
    // 1. Blindaje de Autenticación: Validar Secreto de Webhook
    if (!verifyWebhookSecret(authHeader)) {
      console.warn("[ALERTA SEGURIDAD] Intento no autorizado de inyección de código sin token válido.");
      return NextResponse.json(
        { success: false, error: "No autorizado. Token de autorización de webhook inválido o ausente." },
        { status: 401 }
      );
    }

    const { account_email, extracted_code, action_type = "login_code", raw_subject = "", raw_body = "" } = payload;

    if (!account_email || !extracted_code) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos: 'account_email' y 'extracted_code'" },
        { status: 400 }
      );
    }

    const cleanEmail = account_email.toLowerCase().trim();
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Formato de correo electrónico inválido" },
        { status: 400 }
      );
    }

    // Sanitizar el código o enlace recibido
    const cleanCode = sanitizeInput(String(extracted_code));

    // 2. Guardar de inmediato en memoria ultra rápida garantizada
    memoryStore.set(cleanEmail, {
      code: cleanCode,
      timestamp: Date.now(),
      actionType: action_type
    });

    console.log(`[EXITO TOTAL] Código seguro guardado para ${cleanEmail}`);

    // 3. Persistencia en Cloud Firestore (Base de datos principal)
    try {
      const firestoreResult = await saveIncomingCodeToFirestore({
        account_email: cleanEmail,
        extracted_code: cleanCode,
        action_type: action_type,
        raw_subject: raw_subject,
        raw_body: raw_body
      });

      if (firestoreResult.success) {
        return NextResponse.json({
          success: true,
          message: `Código guardado exitosamente en Firebase para ${cleanEmail}`,
          request_id: firestoreResult.id,
          code: cleanCode
        });
      }
    } catch (fsErr) {
      console.warn("[FIRESTORE] Error persistiendo en Firestore:", fsErr);
    }

    // Fallback secundario de respaldo en Supabase si está configurado
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("code_requests")
          .insert({
            account_email: cleanEmail,
            action_type: action_type,
            extracted_code: cleanCode,
            status: "completado"
          });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Código procesado y guardado para ${cleanEmail}`,
      code: cleanCode
    });
  } catch (error: any) {
    console.error("Error en processIncomingCode:", error);
    return NextResponse.json({
      success: false,
      error: "Error interno al procesar el código"
    }, { status: 500 });
  }
}
