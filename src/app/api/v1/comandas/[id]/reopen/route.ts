import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const bodySchema = z
  .object({
    confirmCreditShortfall: z.boolean().optional(),
  })
  .optional();

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

        let confirmCreditShortfall = false;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const raw = await request.json().catch(() => null);
          const parsed = bodySchema.safeParse(raw ?? {});
          if (!parsed.success) {
            return apiErrorResponse("Corpo da requisição inválido.", 400);
          }
          confirmCreditShortfall = Boolean(parsed.data?.confirmCreditShortfall);
        }

        const result = await reopenComanda(admin, id, { confirmCreditShortfall });
        if (!result.ok) {
          if (result.code === "credit_shortfall") {
            return NextResponse.json(
              {
                ok: false,
                error: result.error,
                code: result.code,
                shortfallCents: result.shortfallCents,
              },
              { status: result.status }
            );
          }
          return apiErrorResponse(result.error, result.status);
        }

        return apiSuccessResponse({ comanda: result.comanda });
      }
    );
  });
}
