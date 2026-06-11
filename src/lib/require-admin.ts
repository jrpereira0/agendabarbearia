import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/require-owner";

export type AdminSession = {
  userId: string;
  isOwner: boolean;
  professionalId: string | null;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "barber")) {
    return null;
  }

  let professionalId: string | null = null;
  if (profile.role === "barber") {
    const { data: pro } = await supabase
      .from("professionals")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    professionalId = pro?.id ?? null;
  }

  return {
    userId: user.id,
    isOwner: profile.role === "owner",
    professionalId,
  };
}

export async function requireAdmin(): Promise<ActionResult | AdminSession> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Você precisa estar logado." };
  return session;
}
