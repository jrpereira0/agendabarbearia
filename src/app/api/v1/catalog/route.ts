import { NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { TIMEZONE } from "@/lib/availability";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// GET /api/v1/catalog — barbearia, barbeiros, serviços e horários (automações e site)
export async function GET(request: Request) {
  return safeApiRoute(async () => {
    const limited = enforcePublicApiRateLimit(request, "catalog");
    if (limited) return limited;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Sistema indisponível no momento." },
        { status: 503 }
      );
    }

    const catalog = await getShopCatalog();

    return NextResponse.json({
      timezone: TIMEZONE,
      ...catalog,
    });
  });
}
