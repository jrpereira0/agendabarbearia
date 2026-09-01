import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import {
  CLIENT_SESSION_COOKIE,
  getClientSessionCookieOptions,
} from "@/lib/client-api-session";
import { startClientSession } from "@/lib/client-session-start";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// POST /api/agenda/identify — WhatsApp + sessão (sem código OTP)
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const limitedIp = await enforcePublicApiRateLimit(
      request,
      "clientIdentifyIp"
    );
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
        ? (json as { whatsapp?: unknown })
        : {};

    const whatsapp =
      typeof body.whatsapp === "string"
        ? normalizeWhatsapp(body.whatsapp)
        : null;

    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const limitedWhatsapp = await enforcePublicApiRateLimit(
      request,
      "clientIdentifyWhatsapp",
      whatsapp
    );
    if (limitedWhatsapp) return limitedWhatsapp;

    const session = await startClientSession(whatsapp);
    if (!session.ok) {
      return NextResponse.json(
        { ok: false, error: session.error },
        { status: session.status }
      );
    }

    const customerResult = await getCustomerByWhatsapp(session.whatsapp);
    const found =
      customerResult.ok && customerResult.found && customerResult.customer;

    const response = NextResponse.json({
      ok: true,
      whatsapp: session.whatsapp,
      found: Boolean(found),
      customer: found
        ? {
            firstName: customerResult.customer!.firstName,
            lastName: customerResult.customer!.lastName,
          }
        : null,
      accessToken: session.accessToken,
      tokenType: "Bearer",
      expiresAt: session.expiresAt,
    });

    response.cookies.set(
      CLIENT_SESSION_COOKIE,
      session.accessToken,
      getClientSessionCookieOptions()
    );

    return response;
  });
}
