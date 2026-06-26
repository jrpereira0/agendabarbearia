import { NextRequest } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getCommissionSummary } from "@/lib/finance-reports";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiErrorResponse,
  apiSuccessResponse,
  financeForbiddenForBarberWrite,
} from "@/lib/finance-api-auth";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// GET /api/v1/finance/commissions?from=AAAA-MM-DD&to=AAAA-MM-DD&professionalId=uuid
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";
    const professionalId =
      request.nextUrl.searchParams.get("professionalId") ?? undefined;

    const fromParsed = dateSchema.safeParse(from);
    const toParsed = dateSchema.safeParse(to);
    if (!fromParsed.success || !toParsed.success) {
      return apiErrorResponse("from e to devem ser AAAA-MM-DD.", 400);
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

        const summary = await getCommissionSummary(
          admin,
          fromParsed.data,
          toParsed.data,
          professionalId
        );
        return apiSuccessResponse({ summary });
      }
    );
  });
}
