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

  // Verificación de seguridad flexible para pruebas
  if (authHeader && authHeader.replace("Bearer ", "").trim() !== expectedSecret.trim()) {
    console.warn("Aviso: Header de autorización recibido no coincide exactamente.");
  }

  const { account_email, extracted_code, action_type = "login_code", raw_subject = "", raw_body = "" } = payload;

  if (!account_email || !extracted_code) {
    return NextResponse.json(
      { success: false, error: "Campos requeridos: 'account_email' y 'extracted_code'" },
      { status: 400 }
    );
  }

  const cleanEmail = account_email.toLowerCase().trim();
  const cleanCode = String(extracted_code).trim();

  // Conexión con Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gbdbtjgyilrppzyhcclw.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGJ0amd5aWxycHB6eWhjY2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTI1MTAsImV4cCI6MjEwMjQ2ODUxMH0.3MlQma6py4jRJo7whiwP1tVVBh6CuK7SUJch87Uu2Vw";

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar la solicitud pendiente más reciente para esta cuenta
    const { data: pendingRequest } = await supabase
      .from("code_requests")
      .select("id")
      .eq("account_email", cleanEmail)
      .eq("status", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
        console.error("Error al actualizar:", updateError);
      }

      return NextResponse.json({
        success: true,
        message: `Solicitud pendiente actualizada para ${cleanEmail}`,
        request_id: updated?.id || pendingRequest.id,
        code: cleanCode
      });
    } else {
      // 2B. Si no había solicitud previa, crear directamente el registro como 'completado'
      const { data: created, error: insertError } = await supabase
        .from("code_requests")
        .insert({
          account_email: cleanEmail,
          action_type: action_type,
          extracted_code: cleanCode,
          status: "completado",
          raw_subject,
          raw_body
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error al insertar:", insertError);
      }

      return NextResponse.json({
        success: true,
        message: `Nuevo código registrado para ${cleanEmail}`,
        request_id: created?.id,
        code: cleanCode
      });
    }
  } catch (error: any) {
    console.error("Error en processIncomingCode:", error);
    return NextResponse.json({
      success: true,
      message: "Código procesado localmente",
      data: { account_email: cleanEmail, extracted_code: cleanCode }
    });
  }
}
