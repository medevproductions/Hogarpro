import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT: POST /api/codes/temporal
 * Acción: 2. Temporal / Código Hogar (TV fuera de casa, 4 o 6 dígitos)
 * Body esperado: { "account_email": "cuenta@ejemplo.com", "extracted_code": "849201" }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    return await processIncomingCode({
      account_email: body.account_email,
      extracted_code: body.extracted_code || body.code,
      action_type: "temporal",
      raw_subject: body.raw_subject,
      raw_body: body.raw_body
    }, authHeader);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
