import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import {
  deleteCustomerPushToken,
  upsertCustomerPushToken,
} from "@/lib/customer-push-tokens";

const bodySchema = z.object({
  expoPushToken: z.string().trim().min(10),
  platform: z.string().trim().max(32).optional(),
});

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) return null;
  return auth.whatsapp;
}

/**
 * POST /api/v1/customers/me/push-token
 * Registra o Expo Push Token do aparelho do cliente logado.
 */
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

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
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
            { ok: false, error: "Confirme o WhatsApp pra registrar notificações." },
            { status: 403 }
          );
        }

        const result = await upsertCustomerPushToken({
          whatsapp,
          expoPushToken: parsed.data.expoPushToken,
          platform: parsed.data.platform,
        });

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({ ok: true });
      }
    );
  });
}

/**
 * DELETE /api/v1/customers/me/push-token
 * Remove o token (logout / permissão revogada).
 */
export async function DELETE(request: NextRequest) {
  return safeApiRoute(async () => {
    let expoPushToken: string | undefined;
    try {
      const json = await request.json();
      expoPushToken =
        typeof json?.expoPushToken === "string" ? json.expoPushToken : undefined;
    } catch {
      // body opcional
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

        await deleteCustomerPushToken({ whatsapp, expoPushToken });
        return NextResponse.json({ ok: true });
      }
    );
  });
}
