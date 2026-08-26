import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CodeType, CodeStatus } from "@/lib/types/database";

/**
 * ENDPOINT WEBHOOK: Recibe códigos extraídos por Google Apps Script / IMAP
 * URL: POST /api/webhooks/incoming-code
 * Headers: Authorization: Bearer <WEBHOOK_SECRET>
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de Autenticación mediante Token Bearer
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.WEBHOOK_SECRET || "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026";

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { success: false, error: "No autorizado. Token de webhook inválido." },
        { status: 401 }
      );
    }

    // 2. Parseo del cuerpo de la petición
    const body = await req.json();
    const { 
      account_email, 
      extracted_code, 
      request_type = "access_code" as CodeType, 
      raw_email_subject = "", 
      raw_email_body = "" 
    } = body;

    if (!account_email || !extracted_code) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos faltantes: 'account_email' y 'extracted_code'" },
        { status: 400 }
      );
    }

    // 3. Inicialización del cliente Supabase con Service Role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-key";
    
    // Si no está configurado Supabase aún en local, devolvemos respuesta mock simulada con éxito
    if (supabaseUrl.includes("mock") || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({
        success: true,
        message: "Código procesado correctamente (Modo Simulación)",
        data: {
          account_email,
          extracted_code,
          request_type,
          status: "received"
        }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Buscar si existe una solicitud pendiente para esta cuenta
    const { data: existingRequest } = await supabase
      .from("code_requests")
      .select("id, account_id, seller_id")
      .eq("account_email", (account_email as string).toLowerCase().trim())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      // Actualizar la solicitud existente con el código recibido
      const { data: updated, error: updateError } = await supabase
        .from("code_requests")
        .update({
          extracted_code,
          status: "received" as CodeStatus,
          raw_email_subject,
          raw_email_body,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingRequest.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: "Solicitud de código pendiente actualizada exitosamente.",
        request_id: updated?.id,
        code: extracted_code
      });
    } else {
      // Si no había solicitud previa, buscar la cuenta para asociar y crear registro
      const { data: accountData } = await supabase
        .from("streaming_accounts")
        .select("id, assigned_seller_id")
        .eq("account_email", (account_email as string).toLowerCase().trim())
        .maybeSingle();

      const { data: newRecord, error: insertError } = await supabase
        .from("code_requests")
        .insert({
          account_id: accountData?.id || null,
          account_email: (account_email as string).toLowerCase().trim(),
          seller_id: accountData?.assigned_seller_id || null,
          request_type: request_type as CodeType,
          extracted_code,
          raw_email_subject,
          raw_email_body,
          status: "received" as CodeStatus
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({
        success: true,
        message: "Nuevo código registrado y emitido en tiempo real.",
        request_id: newRecord?.id,
        code: extracted_code
      });
    }
  } catch (error: any) {
    console.error("Error en Webhook de Códigos:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
