import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { getAvailability } from "@/lib/get-availability";

const querySchema = z.object({
  professionalId: z.uuid("professionalId inválido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser AAAA-MM-DD."),
  serviceIds: z
    .string()
    .min(1, "Informe serviceIds separados por vírgula.")
    .transform((v) => v.split(",").map((s) => s.trim()))
    .pipe(z.array(z.uuid("serviceIds contém um id inválido.")).min(1)),
  excludeAppointmentId: z.uuid("excludeAppointmentId inválido.").optional(),
});

// GET /api/v1/availability?professionalId=...&date=2026-06-15&serviceIds=id1,id2
export async function GET(request: NextRequest) {
  return safeApiRoute(() =>
    withPublicApiRouteGuard(
      request,
      { scope: "availability:read", rateLimit: "availability" },
      async () => {
        const params = Object.fromEntries(request.nextUrl.searchParams);
        const parsed = querySchema.safeParse(params);

        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0].message },
            { status: 400 }
          );
        }

        const { professionalId, date, serviceIds, excludeAppointmentId } =
          parsed.data;
        const result = await getAvailability(
          professionalId,
          date,
          serviceIds,
          excludeAppointmentId
        );

        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status }
          );
        }

        return NextResponse.json(result);
      }
    )
  );
}
