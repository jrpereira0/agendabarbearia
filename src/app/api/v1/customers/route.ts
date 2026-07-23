import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { getAdminApiSession } from "@/lib/protected-api-auth";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

/**
 * GET /api/v1/customers?whatsapp=...
 * Busca cliente pelo WhatsApp. Resposta: id, firstName, lastName, whatsapp.
 * Público (site). Scope opcional: customers:read.
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

    const respond = async () => {
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
    };

    // Painel logado: sem o limite curto da API pública.
    const adminSession = await getAdminApiSession();
    if (adminSession) {
      return respond();
    }

    return withPublicApiRouteGuard(
      request,
      { scope: "customers:read", rateLimit: "whatsappSensitive" },
      async () => respond()
    );
  });
}
