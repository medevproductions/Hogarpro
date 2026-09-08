import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENDPOINT GET: /api/codes/pending
 * Devuelve las solicitudes pendientes en los últimos 15 minutos
 * para que Google Apps Script busque SOLO los correos que los usuarios están esperando.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = "token_ultra_secreto_para_proteger_endpoint_de_codigos_2026";

  if (!authHeader || !authHeader.includes(expectedToken)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gbdbtjgyilrppzyhcclw.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGJ0amd5aWxycHB6eWhjY2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTI1MTAsImV4cCI6MjEwMjQ2ODUxMH0.3MlQma6py4jRJo7whiwP1tVVBh6CuK7SUJch87Uu2Vw";

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
