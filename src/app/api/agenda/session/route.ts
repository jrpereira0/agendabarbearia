import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import {
  CLIENT_SESSION_COOKIE,
  createClientSessionToken,
  getClientSessionCookieOptions,
} from "@/lib/client-api-session";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// POST /api/agenda/session — emite cookie de sessão após informar o WhatsApp (Meus horários)
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const limited = enforcePublicApiRateLimit(request, "whatsappSensitive");
    if (limited) return limited;

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

    const token = createClientSessionToken(whatsapp);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível iniciar a sessão." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      CLIENT_SESSION_COOKIE,
      token,
      getClientSessionCookieOptions()
    );
    return response;
  });
}
