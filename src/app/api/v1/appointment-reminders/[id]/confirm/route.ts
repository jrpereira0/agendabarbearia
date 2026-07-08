import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { confirmAppointmentReminder } from "@/lib/appointment-reminders";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/v1/appointment-reminders/:id/confirm
export async function POST(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

    return withProtectedApiRouteGuard(
      request,
      { scope: "appointment_reminders:write", rateLimit: "appointmentMutate" },
      async () => {
        const result = await confirmAppointmentReminder(id);

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
