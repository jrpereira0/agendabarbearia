import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getComandaById, updateComandaItems } from "@/lib/comanda-service";
import {
  apiErrorResponse,
  apiSuccessResponse,
  financeForbiddenForBarberWrite,
} from "@/lib/finance-api-auth";

const itemSchema = z.object({
  serviceId: z.uuid(),
  serviceName: z.string().trim().min(1),
  catalogPriceCents: z.number().int().min(0),
  chargedPriceCents: z.number().int().min(0),
});

const patchBodySchema = z.object({
  items: z.array(itemSchema).min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

async function assertBarberCanReadComanda(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  comandaProfessionalId: string,
  auth: { type: string; role?: string; userId?: string }
): Promise<NextResponse | null> {
  if (auth.type !== "admin" || auth.role !== "barber") return null;
  const { data: pro } = await admin
    .from("professionals")
    .select("id")
    .eq("profile_id", auth.userId as string)
    .maybeSingle();
  if (!pro || pro.id !== comandaProfessionalId) {
    return apiErrorResponse("Sem permissão.", 403);
  }
  return null;
}

// GET /api/v1/comandas/:id
export async function GET(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

    return withProtectedApiRouteGuard(
      request,
      { scope: "comandas:read", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        const result = await getComandaById(admin, id);
        if (!result.ok) {
          return apiErrorResponse(result.error, result.status);
        }

        const denied = await assertBarberCanReadComanda(
          admin,
          result.comanda.professionalId,
          auth
        );
        if (denied) return denied;

        return apiSuccessResponse({ comanda: result.comanda });
      }
    );
  });
}

// PATCH /api/v1/comandas/:id — atualizar itens (somente dono / API key)
export async function PATCH(request: NextRequest, context: RouteContext) {
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

        const parsed = patchBodySchema.safeParse(json);
        if (!parsed.success) {
          return apiErrorResponse(parsed.error.issues[0].message, 400);
        }

        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        const result = await updateComandaItems(admin, id, parsed.data.items);
        if (!result.ok) {
          return apiErrorResponse(result.error, result.status);
        }

        return apiSuccessResponse({ comanda: result.comanda });
      }
    );
  });
}
