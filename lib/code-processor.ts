import { NextRequest, NextResponse } from "next/server";
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
export function extractNetflixLinkOrCode(text: string, actionType?: string): string | null {
  if (!text) return null;

  // 1. Limpieza de saltos quoted-printable (= seguido de salto de línea) y enlaces partidos
  let cleaned = text.replace(/=\r?\n/g, "");
  // Unir URLs partidas por saltos de línea donde la siguiente línea continúa con parámetros de URL (&, ?, =, /)
  cleaned = cleaned.replace(/(https:\/\/[^\s"'<>]*(?:netflix|disneyplus|max|primevideo)\.com[^\s"'<>]*)\r?\n([&?=/#][a-zA-Z0-9_.~%!$&'()*+,;=?:@\/-]+)/gi, "$1$2");

  const isLinkRequested = actionType === "reset_password" || actionType === "actualizar" || actionType === "login_confirm";

  // Si se pide un enlace (reset de contraseña o actualizar hogar), buscar PRIMERO los enlaces oficiales
  if (isLinkRequested || !actionType) {
    // A. Buscar en botón HTML (<a href="...">) para obtener el link original sin truncar
    const htmlButtonMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:netflix|disneyplus|max|primevideo)\.com\/(?:password|account\/password|account\/travel\/verify|update-household|email\/click|nmtr)[^"']*)["']/i);
    if (htmlButtonMatch && htmlButtonMatch[1]) {
      return htmlButtonMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // B. Buscar enlace específico de restablecer contraseña o actualizar hogar en texto
    const specificRegex = /(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|account\/travel\/verify|update-household|account\/login-code|youraccount|nmtr|email\/click)[^\s"'<>]+)/i;
    const specificMatch = cleaned.match(specificRegex);
    if (specificMatch && specificMatch[1]) {
      return specificMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // C. Cualquier enlace HTTPS oficial de Netflix
    const genericRegex = /(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'<>]+)/i;
    const genericMatch = cleaned.match(genericRegex);
    if (genericMatch && genericMatch[1]) {
      const urlCandidate = genericMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
      // Asegurarse de que no sea simplemente la home corta de netflix.com
      if (urlCandidate.length > 28) {
        return urlCandidate;
      }
    }
  }

  // 2. Si no es una acción de enlace (es decir, es login_code, temporal o no especificado), buscar dígitos numéricos (OTP)
  if (!isLinkRequested) {
    // Códigos espaciados: "3 5 9 7"
    const spaced = cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9])?(?:\s+[0-9])?)\b/);
    if (spaced && spaced[1]) {
      const cleanDigits = spaced[1].replace(/\s+/g, "");
      if (cleanDigits.length >= 4 && cleanDigits.length <= 8) return cleanDigits;
    }

    // Códigos con prefijo: "Código: 849201"
    const prefixed = cleaned.match(/(?:código|code|pin|clave|acceso|verificación)[\s\:\-]+([0-9]{4,8})/i) ||
                     cleaned.match(/([0-9]{4,8})[\s]+(?:es tu código|is your code)/i);
    if (prefixed && prefixed[1]) {
      return prefixed[1].trim();
    }

    // Cualquier secuencia de 4 a 8 dígitos aislada
    const codeMatch = cleaned.match(/\b([0-9]{4,8})\b/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1];
    }
  }

  return null;
}

/**
 * Función central para procesar y actualizar la solicitud de código en Cloud Firestore
 * Protegida con autenticación estricta de Webhook Secret y sanitización
 */
// Memoria compartida del servidor para entrega instantánea garantizada (con TTL de 15 minutos)
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
      resolvedCode = extractNetflixLinkOrCode((raw_body ? raw_body + "\n" : "") + (raw_subject || ""), action_type) || "";
    } else if (raw_body && (action_type === "actualizar" || action_type === "reset_password" || action_type === "login_confirm")) {
      // Si la acción requiere enlace y lo recibido no es un enlace completo, extraer el link oficial del cuerpo
      if (!resolvedCode.startsWith("http")) {
        const linkCandidate = extractNetflixLinkOrCode(raw_body, action_type);
        if (linkCandidate && linkCandidate.startsWith("http")) {
          resolvedCode = linkCandidate;
        }
      }
    }

    // Si es enlace, decodificar entidades HTML y limpiar puntuación final
    if (resolvedCode.startsWith("http://") || resolvedCode.startsWith("https://")) {
      resolvedCode = resolvedCode.replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
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

    // 2. Guardar de inmediato en memoria ultra rápida garantizada (con clave por acción y general)
    const cacheEntry = {
      code: cleanCode,
      timestamp: Date.now(),
      actionType: action_type
    };
    memoryStore.set(`${cleanEmail}:${action_type}`, cacheEntry);
    memoryStore.set(cleanEmail, cacheEntry);

    console.log(`[EXITO TOTAL] Código seguro (${action_type}) guardado para ${cleanEmail}`);

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
