import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { TIMEZONE } from "@/lib/availability";
import {
  buildBookingCatalog,
  parseCatalogQuery,
} from "@/lib/catalog-booking";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function resolveActiveProfessional(professionalId: string) {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("professionals")
    .select("id, nickname")
    .eq("id", professionalId)
    .eq("active", true)
    .maybeSingle();

  return data;
}

// GET /api/v1/catalog — barbearia, barbeiros, serviços e horários (automações e site)
export async function GET(request: NextRequest) {
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

        const parsed = parseCatalogQuery(request.nextUrl.searchParams);
        if (!parsed.ok) {
          return NextResponse.json(
            { error: parsed.error },
            { status: parsed.status }
          );
        }

        const catalog = await getShopCatalog();

        if (!parsed.data.mode) {
          return NextResponse.json({
            timezone: TIMEZONE,
            ...catalog,
          });
        }

        const { date, professionalId } = parsed.data;

        let professional: { id: string; nickname: string } | null = null;
        if (professionalId) {
          const found = await resolveActiveProfessional(professionalId);
          if (!found) {
            return NextResponse.json(
              { error: "Profissional não encontrado." },
              { status: 404 }
            );
          }
          professional = found;
        }

        const booking = buildBookingCatalog(catalog, { date, professional });
        return NextResponse.json(booking);
      }
    )
  );
}
