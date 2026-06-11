import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Garante que quem chama a action é o dono. Retorna null se estiver
// tudo certo, ou um ActionResult de erro pra devolver direto.
export async function requireOwner(): Promise<ActionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Você precisa estar logado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return { ok: false, error: "Apenas o dono pode fazer isso." };
  }
  return null;
}
