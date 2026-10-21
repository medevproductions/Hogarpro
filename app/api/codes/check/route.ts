import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { memoryStore } from "@/lib/code-processor";
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
 * ENDPOINT GET: /api/codes/check?email=correo@ejemplo.com
 * Permite a la página web consultar el código de inmediato mediante un proxy seguro
 * Incluye Rate Limiting, CORS estricto, Anti-Hotlinking y sanitización de enlaces.
 */
export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  const clientIp = getClientIp(req);

  // 1. RATE LIMITING: Máximo 35 consultas por minuto por dirección IP
  const rateLimitResult = checkRateLimit(`check:${clientIp}`, 35, 60 * 1000);
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
  const rawService = searchParams.get("service");
  const rawActionType = searchParams.get("actionType") || "temporal";

  if (!rawEmail) {
    return NextResponse.json({ success: false, code: null }, { headers: corsHeaders });
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

  // Sanitizar parámetros de consulta
  const service = sanitizeInput(rawService || "all");
  const allowedActions = ["actualizar", "temporal", "login_code", "login_confirm", "reset_password"];
  const actionType = allowedActions.includes(rawActionType) ? rawActionType : "temporal";

  // 2. CHEQUEO INSTANTÁNEO EN MEMORIA DE SERVIDOR (Rápido y Seguro)
  if (memoryStore.has(cleanEmail)) {
    const cached = memoryStore.get(cleanEmail)!;
    const isLink = cached.code.startsWith("http://") || cached.code.startsWith("https://");
    
    // Si es enlace, verificar que sea un dominio de streaming legítimo
    if (isLink) {
      const safeLink = sanitizeStreamingLink(cached.code);
      if (safeLink) {
        return NextResponse.json({
          success: true,
          code: safeLink,
          status: "completado",
          timestamp: new Date(cached.timestamp).toISOString(),
          source: "instant_cache"
        }, { headers: corsHeaders });
      }
    } else {
      return NextResponse.json({
        success: true,
        code: cached.code,
        status: "completado",
        timestamp: new Date(cached.timestamp).toISOString(),
        source: "instant_cache"
      }, { headers: corsHeaders });
    }
  }

  // 3. Proxy Seguro hacia Google Apps Script (Upstream protegido detrás del backend)
  const GAS_URL = process.env.GAS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";
  try {
    const gasRes = await fetch(
      `${GAS_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(service)}&actionType=${encodeURIComponent(actionType)}&t=${Date.now()}`,
      { next: { revalidate: 0 } }
    );

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

        memoryStore.set(cleanEmail, {
          code: finalCode,
          timestamp: Date.now(),
          service: service || undefined
        });

        return NextResponse.json({
          success: true,
          code: finalCode,
          status: "completado",
          timestamp: new Date().toISOString(),
          source: "gas_direct"
        }, { headers: corsHeaders });
      }
    }
  } catch (gasErr) {
    // Si Google Apps Script demora, continuar con la consulta de base de datos
  }

  // 4. Consulta a Cloud Firestore (Base de datos primaria)
  try {
    const firestoreCode = await getRecentCodeFromFirestore(cleanEmail);
    if (firestoreCode && firestoreCode.extracted_code) {
      let codeValue = String(firestoreCode.extracted_code).trim();
      if (codeValue.startsWith("http://") || codeValue.startsWith("https://")) {
        const verified = sanitizeStreamingLink(codeValue);
        if (verified) codeValue = verified;
      }

      return NextResponse.json({
        success: true,
        code: codeValue,
        status: firestoreCode.status,
        timestamp: firestoreCode.created_at,
        source: "firestore"
      }, { headers: corsHeaders });
    }
  } catch (fsErr) {
    console.warn("[FIRESTORE] Advertencia consultando Firestore:", fsErr);
  }

  // Fallback secundario de respaldo en Supabase si está configurado
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: list, error: queryErr } = await supabase
        .from("code_requests")
        .select("id, account_email, extracted_code, status, created_at")
        .eq("account_email", cleanEmail)
        .order("created_at", { ascending: false })
        .limit(5);

      if (list && list.length > 0) {
        const itemWithCode = list.find((item: any) => item.extracted_code);
        if (itemWithCode) {
          let codeValue = String(itemWithCode.extracted_code).trim();
          if (codeValue.startsWith("http://") || codeValue.startsWith("https://")) {
            const verified = sanitizeStreamingLink(codeValue);
            if (verified) codeValue = verified;
          }

          return NextResponse.json({
            success: true,
            code: codeValue,
            status: itemWithCode.status,
            timestamp: itemWithCode.created_at,
            source: "supabase"
          }, { headers: corsHeaders });
        }
      }
    } catch {}
  }

  return NextResponse.json({ success: false, code: null }, { headers: corsHeaders });
}
