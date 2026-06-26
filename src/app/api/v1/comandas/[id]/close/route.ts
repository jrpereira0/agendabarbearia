import { NextRequest } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { closeComanda } from "@/lib/comanda-service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiErrorResponse,
  apiSuccessResponse,
  financeForbiddenForBarberWrite,
} from "@/lib/finance-api-auth";

const closeBodySchema = z.object({
  payments: z
    .array(
      z.object({
        paymentMethod: z.enum(PAYMENT_METHODS),
        amountCents: z.number().int().positive(),
      })
    )
    .min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/comandas/:id/close
export async function POST(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

    return withProtectedApiRouteGuard(
      request,
      { scope: "comandas:write", rateLimit: "appointmentMutate" },
      async ({ auth }) => {
        const forbidden = financeForbiddenForBarberWrite(auth);
        if (forbidden) return forbidden;

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return apiErrorResponse("Corpo da requisição inválido.", 400);
        }

        const parsed = closeBodySchema.safeParse(json);
        if (!parsed.success) {
          return apiErrorResponse(parsed.error.issues[0].message, 400);
        }

        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        const userId =
          auth.type === "admin"
            ? auth.userId
            : auth.type === "api_key"
              ? auth.keyUuid
              : "system";

        const result = await closeComanda(
          admin,
          id,
          parsed.data.payments,
          userId
        );
        if (!result.ok) {
          return apiErrorResponse(result.error, result.status);
        }

        return apiSuccessResponse({ comanda: result.comanda });
      }
    );
  });
}
