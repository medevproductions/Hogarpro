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
  if (a === "auto" || a === "any" || a === "detect" || a === "all") return "auto";
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
function isYear(val: string): boolean {
  const num = parseInt(val, 10);
  return num >= 2020 && num <= 2030;
}

export function extractNetflixLinkOrCode(text: string, rawActionType?: string): string | null {
  if (!text) return null;

  // 1. Limpieza de saltos quoted-printable (= seguido de salto de línea) y enlaces partidos en correos MIME
  let cleaned = text.replace(/=\r?\n/g, "");
  cleaned = cleaned.replace(/(https:\/\/[^\s"'<>]*(?:netflix|account\.netflix)\.com[^\s"'<>]*)\r?\n([&?=/#][a-zA-Z0-9_.~%!$&'()*+,;=?:@\/-]+)/gi, "$1$2");

  const action = normalizeActionType(rawActionType);
  const isNumberAction = (action === "login_code" || action === "verification_code");

  // =========================================================================
  // GRUPO 1: CÓDIGOS NUMÉRICOS
  // - login_code: EXACTAMENTE 4 DÍGITOS (Inicio de sesión / TV)
  // - verification_code: EXACTAMENTE 6 DÍGITOS (Verificación OTP)
  // MODO DETECCIÓN AUTOMÁTICA: Si no se especificó acción, detectar la más probable en el mensaje
  if (action === "auto") {
    // 1. Enlaces oficiales de Hogar o Viaje (Prioritarios)
    const hogar = extractNetflixLinkOrCode(cleaned, "actualizar_hogar");
    if (hogar) return hogar;
    const temporal = extractNetflixLinkOrCode(cleaned, "acceso_temporal");
    if (temporal) return temporal;
    const reset = extractNetflixLinkOrCode(cleaned, "reset_password");
    if (reset) return reset;

    // 2. Códigos numéricos (6 dígitos verificación OTP o 4 dígitos TV)
    const verif = extractNetflixLinkOrCode(cleaned, "verification_code");
    if (verif) return verif;
    const login = extractNetflixLinkOrCode(cleaned, "login_code");
    if (login) return login;
  }

  if (action === "login_code") {
    // 1. Dígitos espaciados: "8 4 9 2"
    const spacedMatch = cleaned.match(/>\s*([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\s*</) ||
                        cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spacedMatch && spacedMatch[1]) {
      const code = spacedMatch[1].replace(/\s+/g, "");
      if (code.length === 4 && !isYear(code)) return code;
    }

    // 2. Elemento HTML con tamaño de fuente grande o contenedor
    const bigFontMatch = cleaned.match(/font-size:\s*(?:2[4-9]|[3-9][0-9])px[^>]*>\s*([0-9\s]{4,6})\s*</i) ||
                         cleaned.match(/letter-spacing:\s*[^>]*>\s*([0-9\s]{4,6})\s*</i) ||
                         cleaned.match(/class=["'][^"']*(?:code|pin|otp|token)[^"']*["'][^>]*>\s*([0-9\s]{4,6})\s*</i);
    if (bigFontMatch && bigFontMatch[1]) {
      const code = bigFontMatch[1].replace(/\s+/g, "");
      if (code.length === 4 && !isYear(code)) return code;
    }

    // 3. Celdas de tabla consecutivas (exactamente 4 celdas)
    const cellRegex = /<td[^>]*>\s*([0-9])\s*<\/td>/gi;
    let cellMatch;
    const digits: string[] = [];
    while ((cellMatch = cellRegex.exec(cleaned)) !== null) {
      digits.push(cellMatch[1]);
      if (digits.length === 4) break;
    }
    if (digits.length === 4 && !isYear(digits.join(""))) {
      return digits.join("");
    }

    // 4. Código precedido por texto clave de inicio
    const prefixedMatch = cleaned.match(/(?:iniciar\s+sesión|iniciar|sign-in|código|code|pin|clave|acceso)[\s\:\-]+([0-9]{4})\b/i) ||
                          cleaned.match(/\b([0-9]{4})\b[\s]+(?:es tu código|is your code|para iniciar|for sign-in)/i);
    if (prefixedMatch && prefixedMatch[1]) {
      const code = prefixedMatch[1].trim();
      if (!isYear(code)) return code;
    }

    // 5. Asunto del correo
    const subjectMatch = cleaned.match(/\b([0-9]{4})\b/);
    if (subjectMatch && subjectMatch[1]) {
      const code = subjectMatch[1].trim();
      if (!isYear(code)) return code;
    }

    // 6. Secuencia aislada de exactamente 4 dígitos (evitando años 2020-2030)
    const allMatches = cleaned.match(/\b([0-9]{4})\b/g);
    if (allMatches) {
      for (const cand of allMatches) {
        if (cand.length === 4 && !isYear(cand) && !cand.startsWith("19") && !cand.startsWith("202")) {
          return cand;
        }
      }
    }

    return null;
  }

  if (action === "verification_code") {
    // 1. Dígitos espaciados: "1 2 3 4 5 6"
    const spacedMatch = cleaned.match(/>\s*([0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9])\s*</) ||
                        cleaned.match(/\b([0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9])\b/);
    if (spacedMatch && spacedMatch[1]) {
      const code = spacedMatch[1].replace(/\s+/g, "");
      if (code.length === 6) return code;
    }

    // 2. Elemento HTML con tamaño de fuente grande o contenedor
    const bigFontMatch = cleaned.match(/font-size:\s*(?:2[4-9]|[3-9][0-9])px[^>]*>\s*([0-9\s]{6,8})\s*</i) ||
                         cleaned.match(/letter-spacing:\s*[^>]*>\s*([0-9\s]{6,8})\s*</i) ||
                         cleaned.match(/class=["'][^"']*(?:code|pin|otp|token|verification)[^"']*["'][^>]*>\s*([0-9\s]{6,8})\s*</i);
    if (bigFontMatch && bigFontMatch[1]) {
      const code = bigFontMatch[1].replace(/\s+/g, "");
      if (code.length === 6) return code;
    }

    // 3. Celdas de tabla consecutivas (exactamente 6 celdas)
    const cellRegex = /<td[^>]*>\s*([0-9])\s*<\/td>/gi;
    let cellMatch;
    const digits: string[] = [];
    while ((cellMatch = cellRegex.exec(cleaned)) !== null) {
      digits.push(cellMatch[1]);
      if (digits.length === 6) break;
    }
    if (digits.length === 6) {
      return digits.join("");
    }

    // 4. Código precedido por texto clave de verificación
    const prefixedMatch = cleaned.match(/(?:verificación|verification|un\s+solo\s+uso|otp|código|code|clave)[\s\:\-]+([0-9]{6})\b/i) ||
                          cleaned.match(/\b([0-9]{6})\b[\s]+(?:es tu código|is your verification code|para verificar)/i);
    if (prefixedMatch && prefixedMatch[1]) {
      return prefixedMatch[1].trim();
    }

    // 5. Secuencia aislada de exactamente 6 dígitos
    const allMatches = cleaned.match(/\b([0-9]{6})\b/g);
    if (allMatches) {
      for (const cand of allMatches) {
        if (cand.length === 6) {
          return cand;
        }
      }
    }

    return null;
  }

  // =========================================================================
  // GRUPO 2: ENLACES OFICIALES (ACTUALIZAR HOGAR, ACCESO TEMPORAL, RESTABLECER CLAVE)
  // =========================================================================
  function cleanUrl(url?: string): string | null {
    if (!url) return null;
    return url.replace(/&amp;/g, "&").replace(/[).,;'"<>]+$/, "").trim();
  }

  // 1. SOLICITAR ACTUALIZAR HOGAR NETFLIX (LINK)
  if (action === "actualizar_hogar") {
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:actualizar|hogar|sí|si|solicité|household|confirmar)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) return cleanUrl(btnMatch[1]);

    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:update-household|account\/update-household)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) return cleanUrl(textMatch[1]);

    const anyMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyMatch && anyMatch[1] && anyMatch[1].length > 25) return cleanUrl(anyMatch[1]);
  }

  // 2. CÓDIGO DE ACCESO TEMPORAL (LINK)
  if (action === "acceso_temporal") {
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:obtener|enviar|código|codigo|viaje|temporal|acceso|confirmar|travel|continuar)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) return cleanUrl(btnMatch[1]);

    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:account\/travel\/verify|travel\/verify|verify-travel|account\/travel)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) return cleanUrl(textMatch[1]);

    const anyMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyMatch && anyMatch[1] && anyMatch[1].length > 25) return cleanUrl(anyMatch[1]);
  }

  // 3. REESTABLECER CONTRASEÑA (LINK)
  if (action === "reset_password") {
    const btnMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/|email\/click|nmtr)[^"']*)["'][^>]*>[\s\S]*?(?:restablecer|cambiar|reset|password|contraseña)[\s\S]*?<\/a>/i) ||
                     cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^"']*)["']/i);
    if (btnMatch && btnMatch[1]) return cleanUrl(btnMatch[1]);

    const textMatch = cleaned.match(/(https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/(?:password\?|account\/password|password\/)[^\s"'<>]+)/i);
    if (textMatch && textMatch[1]) return cleanUrl(textMatch[1]);

    const anyMatch = cleaned.match(/<a[^>]+href=["'](https:\/\/(?:[a-zA-Z0-9-]+\.)*netflix\.com\/[^\s"'>]+)["']/i);
    if (anyMatch && anyMatch[1] && anyMatch[1].length > 25) return cleanUrl(anyMatch[1]);
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
