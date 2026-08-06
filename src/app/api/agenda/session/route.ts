import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import {
  CLIENT_SESSION_COOKIE,
  getClientSessionCookieOptions,
  readClientSessionFromRequest,
} from "@/lib/client-api-session";
import { resolveValidClientSession } from "@/lib/client-session-version";

// GET /api/agenda/session — sessão atual do cliente (após OTP)
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const session = await resolveValidClientSession(
      readClientSessionFromRequest(request)
    );
    if (!session) {
      return NextResponse.json({ ok: true, authenticated: false });
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      whatsapp: session.whatsapp,
      expiresAt: session.exp,
    });
  });
}

// DELETE /api/agenda/session — sair (limpa cookie)
export async function DELETE() {
  return safeApiRoute(async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CLIENT_SESSION_COOKIE, "", {
      ...getClientSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  });
}
