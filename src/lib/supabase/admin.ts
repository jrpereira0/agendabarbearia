import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/require-owner";

export type AdminClientUnavailable = Extract<ActionResult, { ok: false }>;

// Cliente com service role: usar SOMENTE no servidor (API routes),
// nunca importar em componentes client.
export function createAdminClient(): SupabaseClient | null {
  const env = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!env || !serviceRoleKey) {
    return null;
  }

  return createClient(env.url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export function systemUnavailable(): AdminClientUnavailable {
  return {
    ok: false,
    error: "Sistema indisponível no momento. Tente de novo em instantes.",
  };
}

export function requireAdminClient(): SupabaseClient | AdminClientUnavailable {
  const client = createAdminClient();
  if (!client) return systemUnavailable();
  return client;
}
