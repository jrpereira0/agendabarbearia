import { NextRequest } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { reopenComanda } from "@/lib/comanda-service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiErrorResponse,
  apiSuccessResponse,
  financeForbiddenForBarberWrite,
} from "@/lib/finance-api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/comandas/:id/reopen
export async function POST(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

    return withProtectedApiRouteGuard(
      request,
      { scope: "comandas:write", rateLimit: "appointmentMutate" },
      async ({ auth }) => {
        const forbidden = financeForbiddenForBarberWrite(auth);
        if (forbidden) return forbidden;

        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        const result = await reopenComanda(admin, id);
        if (!result.ok) {
          return apiErrorResponse(result.error, result.status);
        }

        return apiSuccessResponse({ comanda: result.comanda });
      }
    );
  });
}
