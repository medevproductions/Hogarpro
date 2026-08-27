import { NextRequest, NextResponse } from "next/server";
import { processIncomingCode } from "@/lib/code-processor";

/**
 * ENDPOINT CORTO: /actualizar (POST y GET para consulta o webhook)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    return await processIncomingCode({
      account_email: body.account_email,
      extracted_code: body.extracted_code || body.code || body.link,
      action_type: "actualizar",
      raw_subject: body.raw_subject,
      raw_body: body.raw_body
    }, authHeader);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/actualizar",
    action: "Actualizar hogar / red principal",
    method: "POST",
    expected_body: {
      account_email: "cuenta@ejemplo.com",
      extracted_code: "https://netflix.com/verify?token=123"
    }
  });
}
