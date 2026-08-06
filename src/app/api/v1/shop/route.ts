import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { TIMEZONE } from "@/lib/availability";
import { MAX_DAYS_AHEAD } from "@/lib/get-availability";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/site-url";

function absoluteAssetUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(
    pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`,
    getSiteUrl()
  ).toString();
}

/**
 * GET /api/v1/shop — dados públicos da loja pra bootstrap do app / site.
 * Público. Scope opcional: catalog:read.
 */
export async function GET(request: NextRequest) {
  return safeApiRoute(() =>
    withPublicApiRouteGuard(
      request,
      { scope: "catalog:read", rateLimit: "catalog" },
      async () => {
        if (!isSupabaseConfigured()) {
          return NextResponse.json(
            { ok: false, error: "Sistema indisponível no momento." },
            { status: 503 }
          );
        }

        const catalog = await getShopCatalog();

        return NextResponse.json({
          ok: true,
          shop: {
            name: catalog.shop.name,
            bio: catalog.shop.bio || null,
            address: catalog.shop.address || null,
            whatsapp: catalog.shop.whatsapp || null,
            instagram: catalog.shop.instagram,
            logoUrl: absoluteAssetUrl(catalog.shop.logoUrl),
            timezone: TIMEZONE,
            slotStepMinutes: catalog.shop.slotStepMinutes,
            booking: {
              maxDaysAhead: MAX_DAYS_AHEAD,
            },
          },
          businessHours: catalog.businessHours.map((row) => ({
            weekday: row.weekday,
            label: row.label,
            active: row.active,
            openTime: row.openTime,
            closeTime: row.closeTime,
          })),
        });
      }
    )
  );
}
