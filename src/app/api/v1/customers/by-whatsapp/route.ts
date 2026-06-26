import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";

// GET /api/v1/customers/by-whatsapp?whatsapp=... — consulta cliente pelo WhatsApp (automações)
export async function GET(request: NextRequest) {
  return safeApiRoute(() =>
    withProtectedApiRouteGuard(
      request,
      { scope: "customers:read", rateLimit: "whatsappSensitive" },
      async () => {
        const raw = request.nextUrl.searchParams.get("whatsapp");
        if (raw === null || raw.trim() === "") {
          return NextResponse.json(
            { ok: false, error: "WhatsApp inválido." },
            { status: 400 }
          );
        }

        const result = await getCustomerByWhatsapp(raw);

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json(result);
      }
    )
  );
}
