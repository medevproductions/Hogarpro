import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret, sanitizeInput, isValidEmail } from "@/lib/security";
import { saveIncomingCodeToFirestore } from "@/lib/firebase/firestore-service";

export type CodeActionType = 
  | "login_code" 
  | "verification_code" 
  | "actualizar_hogar" 
  | "acceso_temporal" 
  | "reset_password"
  // Compatibilidad con aliases anteriores
  | "actualizar" 
  | "temporal" 
  | "login_confirm";

export function normalizeActionType(action?: string): string {
  if (!action) return "login_code";
  const a = action.toLowerCase().trim();
  if (a === "actualizar" || a === "actualizar_hogar" || a === "hogar" || a === "household") return "actualizar_hogar";
  if (a === "temporal" || a === "acceso_temporal" || a === "viaje" || a === "travel") return "acceso_temporal";
  if (a === "login_confirm" || a === "verification_code" || a === "verificacion" || a === "verification") return "verification_code";
  if (a === "reset_password" || a === "clave" || a === "password" || a === "reset" || a === "restablecer") return "reset_password";
  if (a === "login_code" || a === "login" || a === "inicio") return "login_code";
  return a;
}

export function isLinkAction(action?: string): boolean {
  const norm = normalizeActionType(action);
  return norm === "actualizar_hogar" || norm === "acceso_temporal" || norm === "reset_password";
}

interface ProcessCodePayload {
  account_email: string;
  extracted_code?: string;
  action_type: CodeActionType | string;
  raw_subject?: string;
  raw_body?: string;
}

/**
 * Extrae con alta precisión enlaces oficiales de Netflix o códigos numéricos según la opción elegida:
 * 1. login_code: Código numérico de 4 dígitos para TV / Pantalla
 * 2. verification_code: Código numérico de verificación OTP (válido 15 minutos)
 * 3. actualizar_hogar: Enlace directo HTTPS para actualizar Hogar con Netflix
 * 4. acceso_temporal: Enlace directo HTTPS para acceso temporal / viaje fuera de casa
 * 5. reset_password: Enlace directo HTTPS para restablecer contraseña
 */
export function extractNetflixLinkOrCode(text: string, rawActionType?: string): string | null {
  if (!text) return null;

  // 1. Limpieza de saltos quoted-printable (= seguido de salto de línea) y enlaces partidos en correos MIME
  let cleaned = text.replace(/=\r?\n/g, "");
  // Unir URLs partidas por saltos de línea donde la siguiente línea continúa con parámetros de URL (&, ?, =, /)
  cleaned = cleaned.replace(/(https:\/\/[^\s"'<>]*(?:netflix|account\.netflix)\.com[^\s"'<>]*)\r?\n([&?=/#][a-zA-Z0-9_.~%!$&'()*+,;=?:@\/-]+)/gi, "$1$2");

  const action = normalizeActionType(rawActionType);

  // =========================================================================
  // CASO 1: SOLICITAR ACTUALIZAR HOGAR NETFLIX (LINK)
  // =========================================================================
  if (action === "actualizar_hogar") {
    // A. Buscar botón en HTML con enlace de update-household
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:actualizar|hogar|sí|si|solicité|household)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) {
      return btnMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // B. Buscar en texto enlace directo de update-household
    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // C. Cualquier enlace de Netflix que contenga parámetros de token en correo de hogar
    const genericMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i) ||
                         cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:email\/click|nmtr)[^\s"'<>]+)/i);
    if (genericMatch && genericMatch[1] && genericMatch[1].length > 25) {
      return genericMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // CASO 2: CÓDIGO DE ACCESO TEMPORAL (LINK)
  // =========================================================================
  if (action === "acceso_temporal") {
    // A. Buscar botón en HTML de viaje / acceso temporal
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:obtener|enviar|código|codigo|viaje|temporal|acceso|confirmar|travel)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) {
      return btnMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // B. Buscar en texto enlace directo de travel/verify
    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // C. Cualquier enlace HTTPS oficial de Netflix presente en el mensaje de viaje
    const anyNetflixLink = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyNetflixLink && anyNetflixLink[1] && anyNetflixLink[1].length > 25) {
      return anyNetflixLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // CASO 3: REESTABLECER CONTRASEÑA (LINK)
  // =========================================================================
  if (action === "reset_password") {
    // A. Buscar botón específico de restablecer contraseña en HTML
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:restablecer|cambiar|reset|password|contraseña)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) {
      return btnMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // B. Buscar enlace directo en texto
    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }
  }

  // =========================================================================
  // CASO 4: CÓDIGO DE INICIO DE SESIÓN (4 DÍGITOS ESTRICTOS PARA TV / PANTALLA)
  // =========================================================================
  if (action === "login_code") {
    // A. Dígitos espaciados de Netflix: "3 5 9 7"
    const spaced4 = cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spaced4 && spaced4[1]) {
      return spaced4[1].replace(/\s+/g, "");
    }

    // B. Código de 4 dígitos con prefijo de inicio o TV
    const prefixed4 = cleaned.match(/(?:código|code|pin|clave|acceso|iniciar\s+sesión)[\s\:\-]+([0-9]{4})\b/i) ||
                      cleaned.match(/\b([0-9]{4})[\s]+(?:es tu código|is your code)/i);
    if (prefixed4 && prefixed4[1]) {
      return prefixed4[1].trim();
    }

    // C. Secuencia aislada de exactamente 4 dígitos
    const codeMatch4 = cleaned.match(/\b([0-9]{4})\b/);
    if (codeMatch4 && codeMatch4[1]) {
      return codeMatch4[1];
    }
  }

  // =========================================================================
  // CASO 5: CÓDIGO DE VERIFICACIÓN (DURA 15 MINUTOS - OTP NUMÉRICO)
  // =========================================================================
  if (action === "verification_code") {
    // A. Dígitos con prefijo de verificación u OTP
    const prefixedOtp = cleaned.match(/(?:verificación|verification|un\s+solo\s+uso|otp|código|code)[\s\:\-]+([0-9]{4,6})\b/i) ||
                        cleaned.match(/\b([0-9]{4,6})[\s]+(?:es tu código|is your verification code)/i);
    if (prefixedOtp && prefixedOtp[1]) {
      return prefixedOtp[1].trim();
    }

    // B. Dígitos espaciados
    const spaced = cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9](?:\s+[0-9]\s+[0-9])?)\b/);
    if (spaced && spaced[1]) {
      return spaced[1].replace(/\s+/g, "");
    }

    // C. Secuencia aislada de 4 a 6 dígitos
    const otpMatch = cleaned.match(/\b([0-9]{4,6})\b/);
    if (otpMatch && otpMatch[1]) {
      return otpMatch[1];
    }
  }

  // =========================================================================
  // RESPALDO / FALLBACK GENERAL SI NO SE ESPECIFICÓ ACCIÓN
  // =========================================================================
  if (!rawActionType) {
    // Si contiene links de Netflix relevantes
    const htmlLink = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password|update-household|travel\/verify)[^"']*)["']/i);
    if (htmlLink && htmlLink[1]) {
      return htmlLink[1].replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
    }

    // Dígitos de 4 dígitos (prioridad estándar Netflix)
    const spaced4 = cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spaced4 && spaced4[1]) return spaced4[1].replace(/\s+/g, "");

    const four = cleaned.match(/\b([0-9]{4})\b/);
    if (four && four[1]) return four[1];
  }

  return null;
}

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
    const normalizedAction = normalizeActionType(action_type);

    // Auto-extraer si no viene extraído directamente o si el cuerpo tiene un link oficial de Netflix
    let resolvedCode = extracted_code ? String(extracted_code).trim() : "";
    if (!resolvedCode && (raw_body || raw_subject)) {
      resolvedCode = extractNetflixLinkOrCode((raw_body ? raw_body + "\n" : "") + (raw_subject || ""), normalizedAction) || "";
    } else if (raw_body && isLinkAction(normalizedAction)) {
      // Si la acción requiere enlace y lo recibido no es un enlace completo, extraer el link oficial del cuerpo
      if (!resolvedCode.startsWith("http")) {
        const linkCandidate = extractNetflixLinkOrCode(raw_body, normalizedAction);
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

    // 2. Guardar de inmediato en memoria ultra rápida con clave normalizada y aliases
    const cacheEntry = {
      code: cleanCode,
      timestamp: Date.now(),
      actionType: normalizedAction
    };
    memoryStore.set(`${cleanEmail}:${normalizedAction}`, cacheEntry);
    memoryStore.set(`${cleanEmail}:${action_type}`, cacheEntry);
    memoryStore.set(cleanEmail, cacheEntry);

    console.log(`[EXITO TOTAL] Código/Link seguro (${normalizedAction}) guardado para ${cleanEmail}`);

    // 3. Persistencia en Cloud Firestore (Base de datos principal)
    try {
      const firestoreResult = await saveIncomingCodeToFirestore({
        account_email: cleanEmail,
        extracted_code: cleanCode,
        action_type: normalizedAction,
        raw_subject: raw_subject,
        raw_body: raw_body
      });

      if (firestoreResult.success) {
        return NextResponse.json({
          success: true,
          message: `Código/Link guardado exitosamente en Firebase para ${cleanEmail}`,
          request_id: firestoreResult.id,
          code: cleanCode,
          actionType: normalizedAction
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
