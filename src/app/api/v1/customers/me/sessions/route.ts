import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import {
  CLIENT_SESSION_COOKIE,
  getClientSessionCookieOptions,
} from "@/lib/client-api-session";
import { bumpClientSessionVersion } from "@/lib/client-session-version";

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) return null;
  return auth.whatsapp;
}

/**
 * DELETE /api/v1/customers/me/sessions
 * "Sair de todos os aparelhos": invalida o cookie do site e todo accessToken
 * do app já emitido pra esse WhatsApp (inclusive o usado nesta chamada).
 */
export async function DELETE(request: NextRequest) {
  return safeApiRoute(async () => {
    return withProtectedApiRouteGuard(
      request,
      { scope: "customers:update", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const whatsapp = requireClientWhatsapp(auth);
        if (!whatsapp) {
          return NextResponse.json(
            { ok: false, error: "Confirme o WhatsApp." },
            { status: 403 }
          );
        }

        const result = await bumpClientSessionVersion(whatsapp);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        const response = NextResponse.json({ ok: true });
        response.cookies.set(CLIENT_SESSION_COOKIE, "", {
          ...getClientSessionCookieOptions(),
          maxAge: 0,
        });
        return response;
      }
    );
  });
}
