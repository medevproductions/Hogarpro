import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT: POST /api/codes/verification-code
 * Opción 2: Código de verificación (dura 15 minutos - OTP numérico)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    return await processIncomingCode({
      account_email: body.account_email,
      extracted_code: body.extracted_code || body.code,
      action_type: "verification_code",
      raw_subject: body.raw_subject,
      raw_body: body.raw_body
    }, authHeader);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
