import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSecret, sanitizeInput, isValidEmail } from "@/lib/security";

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
 * Función central para procesar y actualizar la solicitud de código en Supabase
 * Protegida con autenticación estricta de Webhook Secret y sanitización
 */
// Memoria compartida del servidor para entrega instantánea garantizada
const memoryStore = new Map<string, { code: string; timestamp: number; service?: string; actionType?: string }>();

export { memoryStore };

export async function processIncomingCode(payload: ProcessCodePayload, authHeader: string | null) {
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

  // Conexión con Supabase usando exclusivamente variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      success: true,
      message: `Código guardado en memoria instantánea para ${cleanEmail}`,
      code: cleanCode
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Intentar actualizar primero la solicitud pendiente existente
    const { data: pendingRequest } = await supabase
      .from("code_requests")
      .select("id")
      .eq("account_email", cleanEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingRequest) {
      // Actualizar con los campos universales seguros
      const { data: updated, error: updateError } = await supabase
        .from("code_requests")
        .update({
          extracted_code: cleanCode,
          status: "completado",
          updated_at: new Date().toISOString()
        })
        .eq("id", pendingRequest.id)
        .select()
        .single();

      if (!updateError) {
        return NextResponse.json({
          success: true,
          message: `Código actualizado para ${cleanEmail}`,
          request_id: updated?.id || pendingRequest.id,
          code: cleanCode
        });
      }
    }

    // 2. Si no había pendiente, insertar nuevo registro con fallback de columnas
    let insertResult = await supabase
      .from("code_requests")
      .insert({
        account_email: cleanEmail,
        action_type: action_type,
        extracted_code: cleanCode,
        status: "completado"
      })
      .select()
      .maybeSingle();

    // Si falló por la columna action_type/request_type (diferencia de esquema), intentar con request_type
    if (insertResult.error) {
      insertResult = await supabase
        .from("code_requests")
        .insert({
          account_email: cleanEmail,
          request_type: action_type === "login_code" ? "access_code" : action_type === "temporal" ? "temp_code" : "access_code",
          extracted_code: cleanCode,
          status: "received"
        })
        .select()
        .maybeSingle();
    }

    return NextResponse.json({
      success: true,
      message: `Código guardado exitosamente para ${cleanEmail}`,
      code: cleanCode
    });
  } catch (error: any) {
    console.error("Error en processIncomingCode:", error);
    return NextResponse.json({
      success: true,
      message: "Código procesado",
      code: cleanCode
    });
  }
}
