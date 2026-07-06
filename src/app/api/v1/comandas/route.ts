import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateComandaForAppointment,
  listComandasByDate,
} from "@/lib/comanda-service";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/finance-api-auth";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// GET /api/v1/comandas?date=AAAA-MM-DD | ?appointmentId=uuid
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const appointmentId = request.nextUrl.searchParams.get("appointmentId");
    const date = request.nextUrl.searchParams.get("date");
    const statusParam = request.nextUrl.searchParams.get("status");
    const professionalId =
      request.nextUrl.searchParams.get("professionalId") ?? undefined;

    const status =
      statusParam === "open" || statusParam === "closed"
        ? statusParam
        : undefined;

    return withProtectedApiRouteGuard(
      request,
      { scope: "comandas:read", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const admin = createAdminClient();
        if (!admin) {
          return apiErrorResponse("Sistema indisponível no momento.", 503);
        }

        if (appointmentId) {
          if (auth.type === "admin" && auth.role === "barber") {
            const [{ data: pro }, { data: appointment }] = await Promise.all([
              admin
                .from("professionals")
                .select("id")
                .eq("profile_id", auth.userId)
                .maybeSingle(),
              admin
                .from("appointments")
                .select("id, professional_id")
                .eq("id", appointmentId)
                .maybeSingle(),
            ]);
            if (!appointment) {
              return apiErrorResponse("Agendamento não encontrado.", 404);
            }
            if (!pro || appointment.professional_id !== pro.id) {
              return apiErrorResponse("Sem permissão.", 403);
            }
          }

          const result = await getOrCreateComandaForAppointment(
            admin,
            appointmentId
          );
          if (!result.ok) {
            return apiErrorResponse(result.error, result.status);
          }
          return apiSuccessResponse({ comanda: result.comanda });
        }

        if (!date) {
          return apiErrorResponse(
            "Informe date (AAAA-MM-DD) ou appointmentId.",
            400
          );
        }

        if (!dateSchema.safeParse(date).success) {
          return apiErrorResponse("date deve ser AAAA-MM-DD.", 400);
        }

        let filterProfessionalId = professionalId;
        if (auth.type === "admin" && auth.role === "barber") {
          const { data: pro } = await admin
            .from("professionals")
            .select("id")
            .eq("profile_id", auth.userId)
            .maybeSingle();
          filterProfessionalId = pro?.id ?? "__none__";
        }

        const comandas = await listComandasByDate(admin, date, {
          professionalId: filterProfessionalId,
          status,
        });

        return apiSuccessResponse({ comandas });
      }
    );
  });
}
