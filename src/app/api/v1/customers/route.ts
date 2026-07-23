import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

/**
 * GET /api/v1/customers?whatsapp=...
 * Busca cliente pelo WhatsApp. Resposta: id, firstName, lastName, whatsapp.
 *
 * Privada: chave de API (`customers:read`), dono do painel, ou sessão OTP
 * do **mesmo** WhatsApp (cookie / Bearer accessToken).
 * App do cliente preferir `GET /customers/me` (sem passar whatsapp na URL).
 */
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const raw = request.nextUrl.searchParams.get("whatsapp") ?? "";
    const whatsapp = normalizeWhatsapp(raw);
    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      {
        scope: "customers:read",
        rateLimit: "whatsappSensitive",
        whatsapp,
      },
      async () => {
        const result = await getCustomerByWhatsapp(whatsapp);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }
        return NextResponse.json({
          ok: true,
          found: result.found,
          customer: result.customer,
        });
      }
    );
  });
}
