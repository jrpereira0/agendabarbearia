import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = getSupabaseBrowserEnv();
  if (!env) {
    throw new Error(
      "Supabase não configurado no navegador. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY e faça um novo deploy."
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
