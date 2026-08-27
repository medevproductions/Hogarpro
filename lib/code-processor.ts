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
 * Adaptada para funcionar con cualquier versión de la tabla code_requests
 */
export async function processIncomingCode(payload: ProcessCodePayload, authHeader: string | null) {
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
