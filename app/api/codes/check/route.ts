import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENDPOINT GET: /api/codes/check?email=correo@ejemplo.com
 * Permite a la página web consultar el código de inmediato sin depender de RLS
 */
import { memoryStore } from "@/lib/code-processor";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const service = searchParams.get("service");
  const actionType = searchParams.get("actionType") || "temporal";

  if (!email) {
    return NextResponse.json({ success: false, code: null });
  }

  const cleanEmail = email.toLowerCase().trim();

  // 1. CHEQUEO INSTANTÁNEO EN MEMORIA (INMUNE A ERRORES DE SUPABASE/RED)
  if (memoryStore.has(cleanEmail)) {
    const cached = memoryStore.get(cleanEmail)!;
    // Si estamos en /temporal, solo devolver si es un código numérico
    const isLink = cached.code.startsWith("http://") || cached.code.startsWith("https://");
    if (!(actionType === "temporal" && isLink)) {
      return NextResponse.json({
        success: true,
        code: cached.code,
        status: "completado",
        timestamp: new Date(cached.timestamp).toISOString(),
        source: "instant_cache"
      });
    }
  }

  // 2. Consulta de respaldo directa a Google Apps Script
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwEbSZ2nmh_b2-pczfAx1-00kt4b3vrPOEPMyUYbwH3VqqgwEU4Q5Ru8jUGSqTSgj3l7Q/exec";
  try {
    const gasRes = await fetch(`${GAS_URL}?email=${encodeURIComponent(cleanEmail)}&service=${encodeURIComponent(service || "all")}&actionType=${encodeURIComponent(actionType)}&t=${Date.now()}`, {
      next: { revalidate: 0 }
    });
    if (gasRes.ok) {
      const gasData = await gasRes.json();
      if (gasData && gasData.success && gasData.code) {
        memoryStore.set(cleanEmail, {
          code: gasData.code,
          timestamp: Date.now(),
          service: service || undefined
        });
        return NextResponse.json({
          success: true,
          code: gasData.code,
          status: "completado",
          timestamp: new Date().toISOString(),
          source: "gas_direct"
        });
      }
    }
  } catch (gasErr) {
    // Si GAS tarda, continuar
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gbdbtjgyilrppzyhcclw.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGJ0amd5aWxycHB6eWhjY2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTI1MTAsImV4cCI6MjEwMjQ2ODUxMH0.3MlQma6py4jRJo7whiwP1tVVBh6CuK7SUJch87Uu2Vw";

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("code_requests")
      .select("*")
      .eq("account_email", cleanEmail)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: list, error: queryErr } = await query;

    if (queryErr) {
      return NextResponse.json({ success: false, code: null, error: queryErr.message, details: queryErr });
    }

    if (list && list.length > 0) {
      const itemWithCode = list.find((item: any) => item.extracted_code);
      if (itemWithCode) {
        return NextResponse.json({
          success: true,
          code: itemWithCode.extracted_code,
          status: itemWithCode.status,
          timestamp: itemWithCode.created_at,
          matched: itemWithCode
        });
      }
    }

    return NextResponse.json({ success: false, code: null, foundRows: list ? list.length : 0, rows: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, code: null, error: error.message });
  }
}
