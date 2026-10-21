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
  extracted_code?: string;
  action_type: CodeActionType;
  raw_subject?: string;
  raw_body?: string;
}

/**
 * Extrae automáticamente enlaces oficiales de Netflix u OTPs del cuerpo o asunto del correo
 */
export function extractNetflixLinkOrCode(text: string): string | null {
  if (!text) return null;

  // 1. Enlace específico de Actualización de Hogar o Viaje de Netflix
  // ej: https://www.netflix.com/account/travel/verify?nftoken=... o https://www.netflix.com/update-household?...
  const netflixSpecificRegex = /(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|update-household|account\/login-code|youraccount|password|nmtr)[^\s"'<>]+)/i;
  const specificMatch = text.match(netflixSpecificRegex);
  if (specificMatch && specificMatch[1]) {
    return specificMatch[1].replace(/&amp;/g, "&");
  }

  // 2. Cualquier enlace HTTPS oficial de Netflix
  const netflixGenericRegex = /(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'<>]+)/i;
  const genericMatch = text.match(netflixGenericRegex);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].replace(/&amp;/g, "&");
  }

  // 3. Códigos numéricos de 4 dígitos (temporal/viajero) o 6-8 dígitos (OTP)
  const codeMatch = text.match(/\b([0-9]{4,8})\b/);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1];
  }

  return null;
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

    // Auto-extraer si no viene extraído directamente o si el cuerpo tiene un link oficial de Netflix
    let resolvedCode = extracted_code ? String(extracted_code).trim() : "";
    if (!resolvedCode && (raw_body || raw_subject)) {
      resolvedCode = extractNetflixLinkOrCode(raw_body || raw_subject || "") || "";
    } else if (raw_body && !resolvedCode.startsWith("http") && (action_type === "actualizar" || action_type === "login_confirm")) {
      const linkCandidate = extractNetflixLinkOrCode(raw_body);
      if (linkCandidate && linkCandidate.startsWith("http")) {
        resolvedCode = linkCandidate;
      }
    }

    if (!account_email || !resolvedCode) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos: 'account_email' y 'extracted_code' (o cuerpo de correo parseable)" },
        { status: 400 }
      );
    }

    let cleanEmail = account_email.toLowerCase().trim();
    if (cleanEmail.includes(" ")) {
      const [localPart, domainPart] = cleanEmail.split("@");
      if (domainPart) {
        cleanEmail = `${localPart.replace(/\s+/g, "+")}@${domainPart}`;
      }
    }
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Formato de correo electrónico inválido" },
        { status: 400 }
      );
    }

    // Sanitizar el código o enlace recibido (manteniendo URLs intactas si son seguras)
    const cleanCode = resolvedCode.startsWith("http://") || resolvedCode.startsWith("https://")
      ? resolvedCode
      : sanitizeInput(resolvedCode);

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
