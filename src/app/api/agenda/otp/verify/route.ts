import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import {
  CLIENT_SESSION_COOKIE,
  createClientSessionToken,
  getClientSessionCookieOptions,
  verifyClientSessionToken,
} from "@/lib/client-api-session";
import { verifyClientWhatsappOtp } from "@/lib/client-whatsapp-otp";
import { getClientSessionVersion } from "@/lib/client-session-version";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// POST /api/agenda/otp/verify — valida código, cookie (site) + accessToken (app)
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const limitedIp = await enforcePublicApiRateLimit(request, "clientOtpVerifyIp");
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

    const sessionVersion = await getClientSessionVersion(result.whatsapp);
    const token = createClientSessionToken(result.whatsapp, sessionVersion);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível iniciar a sessão." },
        { status: 503 }
      );
    }

    const session = verifyClientSessionToken(token);
    const response = NextResponse.json({
      ok: true,
      whatsapp: result.whatsapp,
      /** Token pra app mobile: `Authorization: Bearer <accessToken>`. */
      accessToken: token,
      tokenType: "Bearer",
      expiresAt: session?.exp ?? null,
    });
    response.cookies.set(
      CLIENT_SESSION_COOKIE,
      token,
      getClientSessionCookieOptions()
    );
    return response;
  });
}
