import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT CORTO: /confirmar
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    return await processIncomingCode({
      account_email: body.account_email,
      extracted_code: body.extracted_code || body.code || body.link,
      action_type: "login_confirm",
      raw_subject: body.raw_subject,
      raw_body: body.raw_body
    }, authHeader);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/confirmar",
    action: "Confirmar inicio de sesión / Magic link",
    method: "POST",
    expected_body: {
      account_email: "cuenta@ejemplo.com",
      extracted_code: "https://netflix.com/confirm?code=94820"
    }
  });
}
