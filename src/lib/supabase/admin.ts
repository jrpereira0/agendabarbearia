import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

// Cliente com service role: usar SOMENTE no servidor (API routes),
// nunca importar em componentes client.
export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!env || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado. Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(env.url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
