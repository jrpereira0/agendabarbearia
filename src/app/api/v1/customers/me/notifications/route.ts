import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import {
  countUnreadCustomerNotifications,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
} from "@/lib/customer-notifications";

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) return null;
  return auth.whatsapp;
}

/**
 * GET /api/v1/customers/me/notifications
 */
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    return withProtectedApiRouteGuard(
      request,
      { scope: "customers:read", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const whatsapp = requireClientWhatsapp(auth);
        if (!whatsapp) {
          return NextResponse.json(
            { ok: false, error: "Confirme o WhatsApp pra ver notificações." },
            { status: 403 }
          );
        }

        const limitRaw = request.nextUrl.searchParams.get("limit");
        const limit = limitRaw ? Number(limitRaw) : 50;

        const [notifications, unreadCount] = await Promise.all([
          listCustomerNotifications(whatsapp, { limit }),
          countUnreadCustomerNotifications(whatsapp),
        ]);

        return NextResponse.json({
          ok: true,
          unreadCount,
          notifications,
        });
      }
    );
  });
}

const patchSchema = z.object({
  markAllRead: z.literal(true).optional(),
});

/**
 * PATCH /api/v1/customers/me/notifications
 * Body: { markAllRead: true }
 */
export async function PATCH(request: NextRequest) {
  return safeApiRoute(async () => {
    let json: unknown = {};
    try {
      json = await request.json();
    } catch {
      // empty body ok
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success || !parsed.data.markAllRead) {
      return NextResponse.json(
        { ok: false, error: "Informe markAllRead: true." },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "customers:update", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const whatsapp = requireClientWhatsapp(auth);
        if (!whatsapp) {
          return NextResponse.json(
            { ok: false, error: "Confirme o WhatsApp." },
            { status: 403 }
          );
        }

        const updated = await markAllCustomerNotificationsRead(whatsapp);
        return NextResponse.json({ ok: true, updated });
      }
    );
  });
}
