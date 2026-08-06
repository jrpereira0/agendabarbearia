import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { withIdempotency } from "@/lib/api/idempotency";
import { createPublicAppointment } from "@/lib/create-public-appointment";
import {
  LIST_APPOINTMENTS_MODES,
  listPublicAppointmentsByWhatsapp,
  type ListAppointmentsMode,
} from "@/lib/manage-public-appointment";
import { protectedAuthRateLimitKey } from "@/lib/protected-api-auth";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
  whatsappSchema,
} from "@/lib/whatsapp";

const listQuerySchema = z.object({
  mode: z.enum(LIST_APPOINTMENTS_MODES).default("upcoming"),
});

const bodySchema = z
  .object({
    professionalId: z.uuid("professionalId inválido.").optional(),
    anyProfessional: z.boolean().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser AAAA-MM-DD."),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime inválido."),
    serviceIds: z
      .array(z.uuid("serviceIds contém um id inválido."))
      .min(1, "Informe ao menos um serviço."),
    firstName: z.string().trim().min(1, "Informe o nome."),
    lastName: z.string().trim().optional().default(""),
    whatsapp: whatsappSchema,
  })
  .superRefine((data, ctx) => {
    if (data.anyProfessional) return;
    if (!data.professionalId) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o barbeiro ou anyProfessional.",
        path: ["professionalId"],
      });
    }
  });

// GET /api/v1/appointments?whatsapp=...&mode=upcoming|history|all
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const raw = request.nextUrl.searchParams.get("whatsapp") ?? "";
    const whatsapp = normalizeWhatsapp(raw);
    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const modeRaw = request.nextUrl.searchParams.get("mode") ?? undefined;
    const parsedMode = listQuerySchema.safeParse({ mode: modeRaw });
    if (!parsedMode.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "mode inválido. Use upcoming, history ou all.",
        },
        { status: 400 }
      );
    }
    const mode: ListAppointmentsMode = parsedMode.data.mode;

    return withProtectedApiRouteGuard(
      request,
      {
        scope: "appointments:read",
        rateLimit: "whatsappSensitive",
        whatsapp,
      },
      async () => {
        const result = await listPublicAppointmentsByWhatsapp(whatsapp, {
          mode,
        });

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.status }
          );
        }

        return NextResponse.json({
          ok: true,
          mode: result.data.mode,
          appointments: result.data.appointments,
        });
      }
    );
  });
}

// POST /api/v1/appointments — site exige sessão OTP; n8n usa chave de API
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    if (typeof json !== "object" || json === null) {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const raw = json as Record<string, unknown>;
    const whatsapp =
      typeof raw.whatsapp === "string"
        ? normalizeWhatsapp(raw.whatsapp)
        : null;
    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse({ ...raw, whatsapp });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      {
        scope: "appointments:create",
        rateLimit: "appointmentCreateIp",
        whatsapp: parsed.data.whatsapp,
      },
      async ({ auth }) =>
        withIdempotency(
          request,
          {
            route: "appointments.create",
            authIdentifier: protectedAuthRateLimitKey(auth) ?? "anonymous",
            requestPayload: parsed.data,
          },
          async () => {
            const result = await createPublicAppointment(parsed.data, {
              bookingSource: auth.type === "api_key" ? "ai" : "site",
            });

            if (!result.ok) {
              return NextResponse.json(
                { ok: false, error: result.error },
                { status: result.status }
              );
            }

            after(() => {
              revalidatePath("/admin");
              revalidatePath("/agenda");
            });
            return NextResponse.json({
              ok: true,
              appointmentId: result.appointmentId,
              professionalId: result.professionalId,
              professionalNickname: result.professionalNickname,
            });
          }
        )
    );
  });
}
