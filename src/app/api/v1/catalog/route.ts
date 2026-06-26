import { NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { TIMEZONE } from "@/lib/availability";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// GET /api/v1/catalog — barbearia, barbeiros, serviços e horários (automações e site)
export async function GET(request: Request) {
  return safeApiRoute(() =>
    withPublicApiRouteGuard(
      request,
      { scope: "catalog:read", rateLimit: "catalog" },
      async () => {
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
      }
    )
  );
}
