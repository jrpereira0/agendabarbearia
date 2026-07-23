import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import {
  CLIENT_SESSION_COOKIE,
  createClientSessionToken,
  getClientSessionCookieOptions,
} from "@/lib/client-api-session";
import { verifyClientWhatsappOtp } from "@/lib/client-whatsapp-otp";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// POST /api/agenda/otp/verify — valida código e emite cookie de sessão
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const limitedIp = enforcePublicApiRateLimit(request, "clientOtpVerifyIp");
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

    const body =
      typeof json === "object" && json !== null
        ? (json as { whatsapp?: unknown; code?: unknown })
        : {};

    const whatsapp =
      typeof body.whatsapp === "string"
        ? normalizeWhatsapp(body.whatsapp)
        : null;
    const code = typeof body.code === "string" ? body.code : "";

    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const result = await verifyClientWhatsappOtp(whatsapp, code);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    const token = createClientSessionToken(result.whatsapp);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível iniciar a sessão." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      whatsapp: result.whatsapp,
    });
    response.cookies.set(
      CLIENT_SESSION_COOKIE,
      token,
      getClientSessionCookieOptions()
    );
    return response;
  });
}
