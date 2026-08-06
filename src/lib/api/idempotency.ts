import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_KEY_LENGTH = 200;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Chance de limpar chaves antigas a cada chamada (evita cron dedicado). */
const CLEANUP_PROBABILITY = 0.02;

export function getIdempotencyKeyHeader(request: Request): string | null {
  const raw = request.headers.get("idempotency-key");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return null;
  return trimmed;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

function buildDedupeKey(parts: {
  idempotencyKey: string;
  route: string;
  authIdentifier: string;
  resourceId?: string | null;
}): string {
  return [
    parts.idempotencyKey,
    parts.route,
    parts.authIdentifier,
    parts.resourceId ?? "",
  ].join("|");
}

function conflictResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Essa Idempotency-Key já foi usada com dados diferentes. Use uma chave nova para uma requisição diferente.",
    },
    { status: 409 }
  );
}

/**
 * Se a requisição enviar o header Idempotency-Key, evita repetir a ação
 * (ex.: criar agendamento duas vezes num retry por timeout). Sem o header,
 * chama o handler normalmente — é opt-in, não muda o comportamento atual.
 *
 * Aviso: a checagem "já existe?" e a gravação da resposta não são atômicas.
 * Duas requisições com a mesma chave chegando ao mesmo tempo (não um
 * retry sequencial) ainda podem, raramente, rodar o handler duas vezes.
 */
export async function withIdempotency(
  request: Request,
  options: {
    /** Identifica a operação, ex.: "appointments.create". */
    route: string;
    /** Chave de API, WhatsApp do cliente ou usuário do painel — separa o mesmo header entre chamadores diferentes. */
    authIdentifier: string;
    /** Id do recurso alvo (ex.: id do agendamento), quando fizer sentido. */
    resourceId?: string | null;
    /** Corpo/parâmetros da requisição, usado só para detectar reuso com dados diferentes. */
    requestPayload: unknown;
  },
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = getIdempotencyKeyHeader(request);
  if (!idempotencyKey) {
    return handler();
  }

  const admin = createAdminClient();
  if (!admin) {
    return handler();
  }

  const dedupeKey = buildDedupeKey({
    idempotencyKey,
    route: options.route,
    authIdentifier: options.authIdentifier,
    resourceId: options.resourceId,
  });
  const requestHash = hashPayload(options.requestPayload);

  const { data: existing } = await admin
    .from("api_idempotency_keys")
    .select("request_hash, response_status, response_body")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      return conflictResponse();
    }
    return NextResponse.json(existing.response_body, {
      status: existing.response_status,
      headers: { "Idempotent-Replay": "true" },
    });
  }

  const response = await handler();

  if (response.status < 500) {
    const responseBody = await response
      .clone()
      .json()
      .catch(() => null);

    if (responseBody !== null) {
      void admin
        .from("api_idempotency_keys")
        .insert({
          dedupe_key: dedupeKey,
          request_hash: requestHash,
          response_status: response.status,
          response_body: responseBody,
        })
        .then(() => undefined);
    }
  }

  if (Math.random() < CLEANUP_PROBABILITY) {
    void admin
      .from("api_idempotency_keys")
      .delete()
      .lt("created_at", new Date(Date.now() - RETENTION_MS).toISOString())
      .then(() => undefined);
  }

  return response;
}
