import { NextRequest } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getCashRegisterSummary } from "@/lib/finance-reports";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiErrorResponse,
  apiSuccessResponse,
  financeForbiddenForBarberWrite,
} from "@/lib/finance-api-auth";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// GET /api/v1/finance/cash-register?date=AAAA-MM-DD
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    const parsed = dateSchema.safeParse(date);
    if (!parsed.success) {
      return apiErrorResponse("date deve ser AAAA-MM-DD.", 400);
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "finance:read", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const forbidden = financeForbiddenForBarberWrite(auth);
        if (forbidden) return forbidden;

        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        const summary = await getCashRegisterSummary(admin, parsed.data);
        return apiSuccessResponse({ summary });
      }
    );
  });
}
