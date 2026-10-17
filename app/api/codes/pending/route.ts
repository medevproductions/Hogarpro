import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/security";
import { getPendingCodeRequestsFirestore } from "@/lib/firebase/firestore-service";

/**
 * ENDPOINT GET: /api/codes/pending
 * Devuelve las solicitudes pendientes en los últimos 15 minutos desde Cloud Firestore
 * para que Google Apps Script busque SOLO los correos que los usuarios están esperando.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!verifyWebhookSecret(authHeader)) {
    return NextResponse.json({ success: false, error: "No autorizado. Token inválido o ausente." }, { status: 401 });
  }

  try {
    // 1. Consultar Firestore como base de datos primaria
    const pendingFirestore = await getPendingCodeRequestsFirestore(15);

    if (pendingFirestore && pendingFirestore.length > 0) {
      return NextResponse.json({
        success: true,
        source: "firestore",
        count: pendingFirestore.length,
        pending: pendingFirestore
      });
    }

    return NextResponse.json({
      success: true,
      count: 0,
      pending: []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, pending: [] });
  }
}
