import { NextRequest, NextResponse } from "next/server";

// Dominios autorizados para CORS y Anti-Hotlinking
const ALLOWED_ORIGINS = [
  "https://hogarpro-xrhd.vercel.app",
  "https://hogarpro-xrhd-git-main-medevproductions.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

/**
 * Validador de Origen y Generador de Encabezados CORS
 */
export function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  let matchedOrigin = ALLOWED_ORIGINS[0];

  // Si el origen de la petición coincide con alguno permitido, se utiliza
  for (const allowed of ALLOWED_ORIGINS) {
    if (origin.startsWith(allowed)) {
      matchedOrigin = allowed;
      break;
    }
  }

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

/**
 * Verifica si la petición proviene de un origen legítimo (Anti-Hotlinking)
 */
export function isAllowedOrigin(req: NextRequest): boolean {
  // En Next.js peticiones internas directas pueden no tener origin o referer
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Si no hay ninguno, puede ser una llamada servidor a servidor o local
  if (!origin && !referer) {
    const host = req.headers.get("host") || "";
    return host.includes("localhost") || host.includes("hogarpro-xrhd.vercel.app") || host.includes("vercel.app");
  }

  const check = (origin || referer || "").toLowerCase();
  return ALLOWED_ORIGINS.some(allowed => check.startsWith(allowed.toLowerCase()));
}

/**
 * In-Memory Sliding Window Rate Limiter
 * Protege contra fuerza bruta y scraping masivo
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpieza periódica de memoria cada 10 minutos
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 25,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, record.resetAt - now)
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInMs: Math.max(0, record.resetAt - now)
  };
}

/**
 * Obtener IP real del cliente detrás de Vercel/Cloudflare
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Verificador Estricto del Secreto de Webhook
 */
export function verifyWebhookSecret(authHeader: string | null): boolean {
  if (!authHeader) return false;
  
  const expectedSecret = process.env.WEBHOOK_SECRET || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026";
  const cleanHeader = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Comparación segura
  return cleanHeader === expectedSecret.trim();
}

/**
 * Sanitización de Entradas contra XSS e Inyecciones
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>?/gm, "") // Eliminar cualquier etiqueta HTML
    .replace(/[<>'"]/g, "")     // Eliminar caracteres peligrosos
    .trim();
}

/**
 * Validación de Formato de Correo Electrónico
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitización y validación de URL de streaming / confirmación
 * Solo permite enlaces HTTPS provenientes de proveedores oficiales
 */
export function sanitizeStreamingLink(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return null;

  try {
    const parsed = new URL(trimmed);
    const validDomains = [
      "netflix.com",
      "account.netflix.com",
      "disneyplus.com",
      "disney.com",
      "max.com",
      "hbomax.com",
      "primevideo.com",
      "amazon.com",
      "spotify.com",
      "crunchyroll.com"
    ];

    const isMatch = validDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
    return isMatch ? trimmed : null;
  } catch {
    return null;
  }
}
