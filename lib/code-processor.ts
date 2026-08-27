import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
 */
export async function processIncomingCode(payload: ProcessCodePayload, authHeader: string | null) {
  const expectedSecret = process.env.WEBHOOK_SECRET || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026";

  // Verificación de seguridad opcional pero recomendada para webhooks/Postman
  if (authHeader && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API inválido." },
      { status: 401 }
    );
  }

  const { account_email, extracted_code, action_type, raw_subject = "", raw_body = "" } = payload;

  if (!account_email || !extracted_code) {
    return NextResponse.json(
      { success: false, error: "Campos requeridos: 'account_email' y 'extracted_code'" },
      { status: 400 }
    );
  }

  const cleanEmail = account_email.toLowerCase().trim();
  const cleanCode = String(extracted_code).trim();

  // Conexión con Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-key";

  // Si aún no se configuran variables de entorno reales, respondemos simulación exitosa
  if (supabaseUrl.includes("mock") || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({
      success: true,
      message: `Código para [${action_type}] procesado con éxito (Modo Simulación)`,
      data: {
        account_email: cleanEmail,
        action_type,
        extracted_code: cleanCode,
        status: "completado",
        timestamp: new Date().toISOString()
      }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Buscar la solicitud pendiente más reciente para esta cuenta y acción
  const { data: pendingRequest, error: searchError } = await supabase
    .from("code_requests")
    .select("id")
    .eq("account_email", cleanEmail)
    .eq("action_type", action_type)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (searchError) {
    console.error("Error buscando solicitud pendiente:", searchError);
  }

  if (pendingRequest) {
    // 2A. Actualizar la solicitud existente de 'pendiente' a 'completado'
    const { data: updated, error: updateError } = await supabase
      .from("code_requests")
      .update({
        extracted_code: cleanCode,
        status: "completado",
        raw_subject,
        raw_body,
        updated_at: new Date().toISOString()
      })
      .eq("id", pendingRequest.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Solicitud pendiente actualizada con éxito para ${cleanEmail}`,
      action_type,
      request_id: updated?.id,
      code: cleanCode
    });
  } else {
    // 2B. Si no había solicitud previa, crear directamente el registro como 'completado'
    const { data: created, error: insertError } = await supabase
      .from("code_requests")
      .insert({
        account_email: cleanEmail,
        action_type,
        extracted_code: cleanCode,
        status: "completado",
        raw_subject,
        raw_body
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Nuevo código registrado y despachado para ${cleanEmail}`,
      action_type,
      request_id: created?.id,
      code: cleanCode
    });
  }
}
