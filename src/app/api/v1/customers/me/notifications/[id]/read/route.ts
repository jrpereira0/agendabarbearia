import { NextRequest, NextResponse } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { markCustomerNotificationRead } from "@/lib/customer-notifications";

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) return null;
  return auth.whatsapp;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/customers/me/notifications/:id/read
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return safeApiRoute(async () => {
    const { id } = await context.params;

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

        const ok = await markCustomerNotificationRead({
          whatsapp,
          notificationId: id,
        });

        if (!ok) {
          return NextResponse.json(
            { ok: false, error: "Não foi possível marcar como lida." },
            { status: 404 }
          );
        }

        return NextResponse.json({ ok: true });
      }
    );
  });
}
