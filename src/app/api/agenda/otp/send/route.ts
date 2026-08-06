import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { requestClientWhatsappOtp } from "@/lib/client-whatsapp-otp";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// POST /api/agenda/otp/send — gera código e dispara webhook n8n → WhatsApp
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const limitedIp = await enforcePublicApiRateLimit(request, "clientOtpSendIp");
    if (limitedIp) return limitedIp;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const whatsapp =
      typeof json === "object" &&
      json !== null &&
      "whatsapp" in json &&
      typeof (json as { whatsapp: unknown }).whatsapp === "string"
        ? normalizeWhatsapp((json as { whatsapp: string }).whatsapp)
        : null;

    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const limitedWhatsapp = await enforcePublicApiRateLimit(
      request,
      "clientOtpSendWhatsapp",
      whatsapp
    );
    if (limitedWhatsapp) return limitedWhatsapp;

    const result = await requestClientWhatsappOtp(whatsapp);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresInMinutes: result.expiresInMinutes,
    });
  });
}
