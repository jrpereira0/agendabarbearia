import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withPublicApiRouteGuard } from "@/lib/api/with-api-guard";
import { getAnyProfessionalAvailability } from "@/lib/any-professional-booking";
import { getAvailability } from "@/lib/get-availability";

const querySchema = z
  .object({
    professionalId: z.uuid("professionalId inválido.").optional(),
    anyProfessional: z
      .enum(["1", "true", "yes"])
      .optional()
      .transform((v) => Boolean(v)),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser AAAA-MM-DD."),
    serviceIds: z
      .string()
      .min(1, "Informe serviceIds separados por vírgula.")
      .transform((v) => v.split(",").map((s) => s.trim()))
      .pipe(z.array(z.uuid("serviceIds contém um id inválido.")).min(1)),
    excludeAppointmentId: z.uuid("excludeAppointmentId inválido.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.anyProfessional) return;
    if (!data.professionalId) {
      ctx.addIssue({
        code: "custom",
        message: "Informe professionalId ou anyProfessional=1.",
        path: ["professionalId"],
      });
    }
  });

// GET /api/v1/availability?professionalId=...&date=...&serviceIds=...
// GET /api/v1/availability?anyProfessional=1&date=...&serviceIds=...
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

        const {
          professionalId,
          anyProfessional,
          date,
          serviceIds,
          excludeAppointmentId,
        } = parsed.data;

        const result = anyProfessional
          ? await getAnyProfessionalAvailability(
              date,
              serviceIds,
              excludeAppointmentId
            )
          : await getAvailability(
              professionalId!,
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
