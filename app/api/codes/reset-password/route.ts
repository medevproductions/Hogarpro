import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT: POST /api/codes/reset-password
 * Acción: 5. Restablecer contraseña
 * Body esperado: { "account_email": "cuenta@ejemplo.com", "extracted_code": "https://netflix.com/password/reset?token=xyz" }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    return await processIncomingCode({
      account_email: body.account_email,
      extracted_code: body.extracted_code || body.code || body.link,
      action_type: "reset_password",
      raw_subject: body.raw_subject,
      raw_body: body.raw_body
    }, authHeader);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
