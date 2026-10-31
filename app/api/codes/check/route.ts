import { NextRequest, NextResponse } from "next/server";
import { memoryStore, normalizeActionType } from "@/lib/code-processor";
import { 
  getCorsHeaders, 
  checkRateLimit, 
  getClientIp, 
  isValidEmail, 
  sanitizeInput,
  sanitizeStreamingLink
} from "@/lib/security";
import { getRecentCodeFromFirestore } from "@/lib/firebase/firestore-service";

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * ENDPOINT GET: /api/codes/check?email=correo@ejemplo.com&actionType=login_code
 * Permite consultar el código o link de Netflix de inmediato mediante un proxy seguro
 * Opciones: login_code, verification_code, actualizar_hogar, acceso_temporal, reset_password
 */
export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  const clientIp = getClientIp(req);

  // 1. RATE LIMITING: Hasta 120 consultas por minuto por dirección IP (soporta polling legítimo)
  const rateLimitResult = checkRateLimit(`check:${clientIp}`, 120, 60 * 1000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        success: false, 
        error: "Demasiadas solicitudes. Límite de tasa excedido, intenta de nuevo en unos momentos.",
        retryAfterMs: rateLimitResult.resetInMs
      },
      { 
        status: 429, 
        headers: {
          ...corsHeaders,
          "Retry-After": String(Math.ceil(rateLimitResult.resetInMs / 1000))
        } 
      }
    );
  }

  const { searchParams } = new URL(req.url);
  let rawEmail = searchParams.get("email");
  const rawActionType = searchParams.get("actionType") || "login_code";

  if (!rawEmail) {
    return NextResponse.json({ success: false, code: null, message: "Parámetro 'email' requerido" }, { headers: corsHeaders });
  }

  // Si en la URL venía '+' sin escapar (ej: ?email=cuenta+embudo@gmail.com), URLSearchParams lo decodifica como espacio ' '
  if (rawEmail.includes(" ")) {
    const [localPart, domainPart] = rawEmail.split("@");
    if (domainPart) {
      rawEmail = `${localPart.replace(/\s+/g, "+")}@${domainPart}`;
    }
  }

  const cleanEmail = rawEmail.toLowerCase().trim();
  if (!isValidEmail(cleanEmail)) {
    return NextResponse.json(
      { success: false, error: "Formato de correo inválido", code: null },
      { status: 400, headers: corsHeaders }
    );
  }

  // Normalizar la acción a una de las 5 opciones oficiales de Netflix
  const actionType = normalizeActionType(rawActionType);
  const service = "netflix"; // Exclusivo Netflix
  const isLink = actionType === "actualizar_hogar" || actionType === "acceso_temporal" || actionType === "reset_password";

  // 2. CHEQUEO INSTANTÁNEO EN MEMORIA DE SERVIDOR
  // Para enlaces: 24 horas. Para códigos numéricos: 60 minutos
  const MAX_CODE_AGE_MS = isLink ? (24 * 60 * 60 * 1000) : (60 * 60 * 1000);
  const now = Date.now();
  const cacheKey = `${cleanEmail}:${actionType}`;
  const cached = memoryStore.get(cacheKey) || memoryStore.get(`${cleanEmail}:${rawActionType}`) || memoryStore.get(cleanEmail);

  if (cached) {
    const isMatchingAction = !cached.actionType || 
      cached.actionType === actionType || 
      normalizeActionType(cached.actionType) === actionType;
    const isFresh = (now - cached.timestamp) <= MAX_CODE_AGE_MS;

    if (isMatchingAction && isFresh) {
      const codeIsUrl = cached.code.startsWith("http://") || cached.code.startsWith("https://");
      
      // Si la acción requería link y tenemos URL, sanitizarla
      if (isLink && codeIsUrl) {
        const safeLink = sanitizeStreamingLink(cached.code);
        if (safeLink) {
          return NextResponse.json({
            success: true,
            code: safeLink,
            status: "completado",
            actionType: actionType,
            timestamp: new Date(cached.timestamp).toISOString(),
            source: "instant_cache"
          }, { headers: corsHeaders });
        }
      } else if (!isLink && !codeIsUrl) {
        // Código numérico
        return NextResponse.json({
          success: true,
          code: cached.code,
          status: "completado",
          actionType: actionType,
          timestamp: new Date(cached.timestamp).toISOString(),
          source: "instant_cache"
        }, { headers: corsHeaders });
      }
    } else if (!isFresh) {
      memoryStore.delete(cacheKey);
      memoryStore.delete(`${cleanEmail}:${rawActionType}`);
      memoryStore.delete(cleanEmail);
    }
  }

  let gasErrorMessage: string | null = null;

  // 3. Proxy Seguro hacia Google Apps Script (Upstream protegido detrás del backend)
  const GAS_URL = process.env.GAS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbw8e69kUHigPwMYqBxXP5t-HNVW0EA6HIpNR2K6E6f8wG_VYefMXb8V7mnQHF72Wh2lGg/exec";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const gasRes = await fetch(
      `${GAS_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(service)}&actionType=${encodeURIComponent(actionType)}&t=${Date.now()}`,
      { 
        signal: controller.signal,
        next: { revalidate: 0 } 
      }
    );
    clearTimeout(timeoutId);

    if (gasRes.ok) {
      const gasData = await gasRes.json();
      if (gasData && gasData.success && gasData.code) {
        let finalCode = String(gasData.code).trim();
        if (finalCode.startsWith("http://") || finalCode.startsWith("https://")) {
          const verifiedLink = sanitizeStreamingLink(finalCode);
          if (verifiedLink) {
            finalCode = verifiedLink;
          }
        }

        const freshEntry = {
          code: finalCode,
          timestamp: Date.now(),
          actionType: actionType,
          service: service || undefined
        };
        memoryStore.set(`${cleanEmail}:${actionType}`, freshEntry);
        memoryStore.set(cleanEmail, freshEntry);

        return NextResponse.json({
          success: true,
          code: finalCode,
          status: "completado",
          actionType: actionType,
          timestamp: new Date().toISOString(),
          source: "gas_direct"
        }, { headers: corsHeaders });
      } else if (gasData && gasData.message) {
        gasErrorMessage = gasData.message;
      }
    }
  } catch (gasErr: any) {
    gasErrorMessage = gasErr?.name === "AbortError" 
      ? "La consulta a Google Apps Script tardó demasiado tiempo." 
      : (gasErr?.message || null);
  }

  // 4. Consulta a Cloud Firestore (Base de datos primaria con filtro de acción y frescura)
  try {
    const firestoreCode = await getRecentCodeFromFirestore(cleanEmail, actionType);
    if (firestoreCode && firestoreCode.extracted_code) {
      let codeValue = String(firestoreCode.extracted_code).trim();
      const codeIsUrl = codeValue.startsWith("http://") || codeValue.startsWith("https://");

      if (isLink && codeIsUrl) {
        const verified = sanitizeStreamingLink(codeValue);
        if (verified) codeValue = verified;
        return NextResponse.json({
          success: true,
          code: codeValue,
          status: firestoreCode.status,
          actionType: firestoreCode.action_type || actionType,
          timestamp: firestoreCode.created_at,
          source: "firestore"
        }, { headers: corsHeaders });
      } else if (!isLink && !codeIsUrl) {
        return NextResponse.json({
          success: true,
          code: codeValue,
          status: firestoreCode.status,
          actionType: firestoreCode.action_type || actionType,
          timestamp: firestoreCode.created_at,
          source: "firestore"
        }, { headers: corsHeaders });
      }
    }
  } catch (fsErr) {
    console.warn("[FIRESTORE] Advertencia consultando Firestore:", fsErr);
  }

  return NextResponse.json({ 
    success: false, 
    code: null, 
    message: gasErrorMessage || `No se encontró ningún correo reciente para '${cleanEmail}'. Solicita el código desde Netflix primero.` 
  }, { headers: corsHeaders });
}
