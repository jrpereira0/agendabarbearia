import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withApiRouteGuard } from "@/lib/api/with-api-guard";
import { resolveApiAuth } from "@/lib/api-key-auth";
import { createPublicAppointment } from "@/lib/create-public-appointment";
import { listPublicAppointmentsByWhatsapp } from "@/lib/manage-public-appointment";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

const bodySchema = z.object({
  professionalId: z.uuid("professionalId inválido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser AAAA-MM-DD."),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime inválido."),
  serviceIds: z
    .array(z.uuid("serviceIds contém um id inválido."))
    .min(1, "Informe ao menos um serviço."),
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: z.string().regex(/^55\d{10,11}$/, WHATSAPP_INVALID_MESSAGE),
});

// GET /api/v1/appointments?whatsapp=... — agendamentos futuros do cliente
export async function GET(request: NextRequest) {
  return safeApiRoute(() =>
    withApiRouteGuard(
      request,
      { scope: "appointments:read", rateLimit: "whatsappSensitive" },
      async () => {
        const raw = request.nextUrl.searchParams.get("whatsapp") ?? "";
        const whatsapp = normalizeWhatsapp(raw);
        if (!whatsapp) {
          return NextResponse.json(
            { error: WHATSAPP_INVALID_MESSAGE },
            { status: 400 }
          );
        }

        const result = await listPublicAppointmentsByWhatsapp(whatsapp);

        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status }
          );
        }

        return NextResponse.json({ appointments: result.data });
      }
    )
  );
}

// POST /api/v1/appointments — agendamento online pelo cliente
export async function POST(request: NextRequest) {
  return safeApiRoute(async () => {
    const authResult = await resolveApiAuth(request, "appointments:create");
    if (!authResult.ok) {
      return authResult.response;
    }

    if (authResult.auth.type === "api_key") {
      const limited = enforcePublicApiRateLimit(
        request,
        "apiKey",
        authResult.auth.keyUuid
      );
      if (limited) return limited;
    } else {
      const limitedIp = enforcePublicApiRateLimit(
        request,
        "appointmentCreateIp"
      );
      if (limitedIp) return limitedIp;
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    if (typeof json !== "object" || json === null) {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
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
        { error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    if (authResult.auth.type === "public") {
      const limitedWhatsapp = enforcePublicApiRateLimit(
        request,
        "appointmentCreateWhatsapp",
        whatsapp
      );
      if (limitedWhatsapp) return limitedWhatsapp;
    }

    const parsed = bodySchema.safeParse({ ...raw, whatsapp });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await createPublicAppointment(parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    revalidatePath("/admin");
    revalidatePath("/agenda");
    return NextResponse.json({ ok: true, appointmentId: result.appointmentId });
  });
}
