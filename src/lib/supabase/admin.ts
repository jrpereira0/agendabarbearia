import { createClient } from "@supabase/supabase-js";

// Cliente com service role: usar SOMENTE no servidor (API routes),
// nunca importar em componentes client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
