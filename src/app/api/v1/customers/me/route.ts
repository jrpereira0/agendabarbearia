import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import {
  getCustomerByWhatsapp,
  updateCustomerProfileByWhatsapp,
} from "@/lib/lookup-customer";

const patchBodySchema = z.object({
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
});

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) {
    return null;
  }
  return auth.whatsapp;
}

/**
 * GET /api/v1/customers/me
 * Perfil do cliente autenticado (Bearer OTP / cookie de sessão).
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
            {
              ok: false,
              error:
                "Esta rota é só para o app do cliente (sessão do WhatsApp).",
            },
            { status: 403 }
          );
        }

        const result = await getCustomerByWhatsapp(whatsapp);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          found: result.found,
          customer: result.customer,
        });
      }
    );
  });
}

/**
 * PATCH /api/v1/customers/me
 * Atualiza nome e sobrenome do cliente autenticado.
 * WhatsApp não muda (é o da sessão).
 */
export async function PATCH(request: NextRequest) {
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

    const parsed = patchBodySchema.safeParse(json);
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
            {
              ok: false,
              error:
                "Esta rota é só para o app do cliente (sessão do WhatsApp).",
            },
            { status: 403 }
          );
        }

        const result = await updateCustomerProfileByWhatsapp({
          whatsapp,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
        });

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          customer: result.customer,
        });
      }
    );
  });
}
