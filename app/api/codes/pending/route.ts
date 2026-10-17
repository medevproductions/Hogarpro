import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSecret } from "@/lib/security";

/**
 * ENDPOINT GET: /api/codes/pending
 * Devuelve las solicitudes pendientes en los últimos 15 minutos
 * para que Google Apps Script busque SOLO los correos que los usuarios están esperando.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!verifyWebhookSecret(authHeader)) {
    return NextResponse.json({ success: false, error: "No autorizado. Token inválido o ausente." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Servicio de base de datos no configurado", pending: [] });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Solicitudes creadas en los últimos 15 minutos que aún estén pendientes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from("code_requests")
      .select("id, account_email, service, action_type, created_at")
      .eq("status", "pendiente")
      .gte("created_at", fifteenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ success: false, error: error.message, pending: [] });
    }

    return NextResponse.json({
      success: true,
      count: pending ? pending.length : 0,
      pending: pending || []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, pending: [] });
  }
}
