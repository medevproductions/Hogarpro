import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT CORTO: /temporal
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

export async function GET() {
  return NextResponse.json({
    endpoint: "/temporal",
    action: "Código temporal de 4 o 6 dígitos (TV fuera de casa / viaje)",
    method: "POST",
    expected_body: {
      account_email: "cuenta@ejemplo.com",
      extracted_code: "8492"
    }
  });
}
