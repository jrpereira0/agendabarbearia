import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { processDueAppointmentReminderPushes } from "@/lib/push-reminders";

/**
 * GET/POST /api/cron/appointment-reminders
 * Dispara lembretes 1h e 30min via Expo Push (sem n8n).
 * Protegido por CRON_SECRET (Authorization: Bearer … ou ?secret=).
 */
async function handleCron(request: NextRequest) {
  return safeApiRoute(async () => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "CRON_SECRET não configurado." },
        { status: 503 }
      );
    }

    const auth = request.headers.get("authorization")?.trim() ?? "";
    const bearer = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    const querySecret = request.nextUrl.searchParams.get("secret")?.trim() ?? "";

    if (bearer !== expected && querySecret !== expected) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const result = await processDueAppointmentReminderPushes();
    return NextResponse.json({ ok: true, ...result });
  });
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
