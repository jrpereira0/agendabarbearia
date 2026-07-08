import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { findPendingResponseReminder } from "@/lib/appointment-reminders";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

// GET /api/v1/appointment-reminders/pending-response?whatsapp=...
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
        scope: "appointment_reminders:read",
        rateLimit: "whatsappSensitive",
        whatsapp,
      },
      async () => {
        const reminder = await findPendingResponseReminder(whatsapp);

        if (!reminder) {
          return NextResponse.json({
            ok: true,
            found: false,
            reminder: null,
          });
        }

        return NextResponse.json({
          ok: true,
          found: true,
          reminder,
        });
      }
    );
  });
}
