import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withApiRouteGuard } from "@/lib/api/with-api-guard";
import { lookupCustomerByWhatsapp } from "@/lib/lookup-customer";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// GET /api/v1/customers/lookup?whatsapp=... — busca cliente pelo WhatsApp (agendamento online)
export async function GET(request: NextRequest) {
  return safeApiRoute(() =>
    withApiRouteGuard(
      request,
      { scope: "customers:read", rateLimit: "whatsappSensitive" },
      async () => {
        const raw = request.nextUrl.searchParams.get("whatsapp") ?? "";
        const whatsapp = normalizeWhatsapp(raw);
        if (!whatsapp) {
          return NextResponse.json(
            { error: WHATSAPP_INVALID_MESSAGE },
            { status: 400 }
          );
        }

        const result = await lookupCustomerByWhatsapp(whatsapp);
        return NextResponse.json(result);
      }
    )
  );
}
