import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { markAppointmentReminderSent } from "@/lib/appointment-reminders";

const bodySchema = z.object({
  providerMessageId: z.string().trim().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/appointment-reminders/:id/mark-sent
export async function POST(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

    let json: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        json = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "appointment_reminders:write", rateLimit: "appointmentMutate" },
      async () => {
        const result = await markAppointmentReminderSent(
          id,
          parsed.data.providerMessageId
        );

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.status }
          );
        }

        return NextResponse.json({ ok: true });
      }
    );
  });
}
