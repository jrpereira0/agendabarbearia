import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import { getAiStatus, setAiStatus } from "@/lib/ai-status";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
  whatsappSchema,
} from "@/lib/whatsapp";

/**
 * GET /api/v1/ai-status?whatsapp=...
 * Consulta se a IA está ativa numa conversa de WhatsApp. Scope: ai_status:read.
 * Feito pra substituir o acesso direto do n8n ao Postgres (dinho_ai_status).
 */
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
      { scope: "ai_status:read", rateLimit: "whatsappSensitive" },
      async () => {
        const result = await getAiStatus(whatsapp);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          whatsapp: result.status.whatsapp,
          iaAtiva: result.status.iaAtiva,
        });
      }
    );
  });
}

const patchSchema = z.object({
  whatsapp: whatsappSchema,
  iaAtiva: z.boolean(),
});

/**
 * PATCH /api/v1/ai-status
 * Body: { whatsapp, iaAtiva }. Liga/pausa a IA numa conversa. Scope: ai_status:write.
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

    if (typeof json !== "object" || json === null) {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const raw = json as Record<string, unknown>;
    const whatsapp =
      typeof raw.whatsapp === "string" ? normalizeWhatsapp(raw.whatsapp) : null;
    if (!whatsapp) {
      return NextResponse.json(
        { ok: false, error: WHATSAPP_INVALID_MESSAGE },
        { status: 400 }
      );
    }

    const parsed = patchSchema.safeParse({ ...raw, whatsapp });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "ai_status:write", rateLimit: "whatsappSensitive" },
      async () => {
        const result = await setAiStatus(parsed.data.whatsapp, parsed.data.iaAtiva);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          whatsapp: result.status.whatsapp,
          iaAtiva: result.status.iaAtiva,
        });
      }
    );
  });
}
