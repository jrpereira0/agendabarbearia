import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export async function createClient(): Promise<SupabaseClient | null> {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado a partir de um Server Component: o proxy
          // cuida da renovação da sessão nesse caso.
        }
      },
    },
  });
}

export async function requireServerClient(
  loginPath = "/?erro=config"
): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    redirect(loginPath);
  }

  const client = await createClient();
  if (!client) {
    redirect(loginPath);
  }

  return client;
}
