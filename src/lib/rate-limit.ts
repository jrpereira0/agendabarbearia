import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

function pruneExpired(now: number) {
  if (store.size < 5000) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Fallback em memória: só usado se o banco não estiver configurado (dev
 * sem Supabase) ou se a chamada falhar. Nunca deixa a rota sem limite,
 * mas nesse caso o contador não é compartilhado entre instâncias.
 */
function checkRateLimitInMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true };
  }

  if (entry.count >= config.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  return { ok: true };
}

/**
 * Contador compartilhado no banco (função `check_rate_limit`) — funciona
 * igual entre todas as instâncias serverless, diferente do Map em memória.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  if (!admin) return checkRateLimitInMemory(key, config);

  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_window_ms: config.windowMs,
    p_limit: config.limit,
  });

  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    console.error("[rate-limit] falha ao consultar banco, usando fallback em memória", error);
    return checkRateLimitInMemory(key, config);
  }

  return row.allowed
    ? { ok: true }
    : { ok: false, retryAfterSeconds: row.retry_after_seconds };
}

export const PUBLIC_API_RATE_LIMITS = {
  catalog: { limit: 60, windowMs: 15 * 60 * 1000 },
  availability: { limit: 60, windowMs: 15 * 60 * 1000 },
  whatsappSensitive: { limit: 60, windowMs: 15 * 60 * 1000 },
  /** Pedidos de código OTP por IP. */
  clientOtpSendIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Pedidos de código OTP por WhatsApp. */
  clientOtpSendWhatsapp: { limit: 3, windowMs: 15 * 60 * 1000 },
  /** Tentativas de validar OTP por IP. */
  clientOtpVerifyIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  appointmentCreateIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  appointmentCreateWhatsapp: { limit: 3, windowMs: 60 * 60 * 1000 },
  appointmentMutate: { limit: 10, windowMs: 15 * 60 * 1000 },
  apiKey: { limit: 120, windowMs: 15 * 60 * 1000 },
} as const;

export type PublicApiRateLimitBucket = keyof typeof PUBLIC_API_RATE_LIMITS;

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

export async function enforcePublicApiRateLimit(
  request: Request,
  bucket: PublicApiRateLimitBucket,
  keySuffix?: string
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const key = keySuffix
    ? `${bucket}:${keySuffix}`
    : `${bucket}:ip:${ip}`;

  const result = await checkRateLimit(key, PUBLIC_API_RATE_LIMITS[bucket]);
  if (!result.ok) {
    return tooManyRequests(result.retryAfterSeconds);
  }

  return null;
}
