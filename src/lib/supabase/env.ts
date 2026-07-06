// NEXT_PUBLIC_* é embutido no build do Next.js. Na Vercel, se o deploy
// rodou sem essas chaves, o servidor fica com undefined para sempre.
// SUPABASE_URL e SUPABASE_ANON_KEY são lidas em runtime no servidor.
function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getSupabasePublicEnv() {
  const url = readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
