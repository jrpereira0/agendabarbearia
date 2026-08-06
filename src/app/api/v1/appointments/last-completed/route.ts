import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getLastCompletedAppointmentByWhatsapp } from "@/lib/manage-public-appointment";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// GET /api/v1/appointments/last-completed?whatsapp=...
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

    return withProtectedApiRouteGuard(
      request,
      {
        scope: "appointments:read",
        rateLimit: "whatsappSensitive",
        whatsapp,
      },
      async () => {
        const result = await getLastCompletedAppointmentByWhatsapp(whatsapp);

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.status }
          );
        }

        if (!result.data) {
          return NextResponse.json({
            ok: true,
            found: false,
            lastAppointment: null,
          });
        }

        return NextResponse.json({
          ok: true,
          found: true,
          lastAppointment: result.data,
        });
      }
    );
  });
}
