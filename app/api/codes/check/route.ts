import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENDPOINT GET: /api/codes/check?email=correo@ejemplo.com
 * Permite a la página web consultar el código de inmediato sin depender de RLS
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ success: false, code: null });
  }

  const cleanEmail = email.toLowerCase().trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gbdbtjgyilrppzyhcclw.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGJ0amd5aWxycHB6eWhjY2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTI1MTAsImV4cCI6MjEwMjQ2ODUxMH0.3MlQma6py4jRJo7whiwP1tVVBh6CuK7SUJch87Uu2Vw";

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase
      .from("code_requests")
      .select("extracted_code, created_at, status")
      .eq("account_email", cleanEmail)
      .not("extracted_code", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.extracted_code) {
      return NextResponse.json({
        success: true,
        code: data.extracted_code,
        status: data.status,
        timestamp: data.created_at
      });
    }

    return NextResponse.json({ success: false, code: null });
  } catch (error: any) {
    return NextResponse.json({ success: false, code: null, error: error.message });
  }
}
