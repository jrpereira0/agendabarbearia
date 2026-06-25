import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";

// GET /api/v1/customers/by-whatsapp?whatsapp=... — consulta cliente pelo WhatsApp (automações)
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const limited = enforcePublicApiRateLimit(request, "whatsappSensitive");
    if (limited) return limited;

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
  });
}
