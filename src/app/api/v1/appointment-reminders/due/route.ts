import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { listDueAppointmentReminders } from "@/lib/appointment-reminders";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  now: z.string().datetime({ offset: true }).optional(),
});

// GET /api/v1/appointment-reminders/due — lembretes prontos para envio (n8n)
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "appointment_reminders:read", rateLimit: "whatsappSensitive" },
      async () => {
        const reminders = await listDueAppointmentReminders({
          limit: parsed.data.limit,
          now: parsed.data.now ? new Date(parsed.data.now) : undefined,
        });

        return NextResponse.json({ ok: true, reminders });
      }
    );
  });
}
