import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export function createClient(): SupabaseClient | null {
  const env = getSupabaseBrowserEnv();
  if (!env) return null;

  return createBrowserClient(env.url, env.anonKey);
}
