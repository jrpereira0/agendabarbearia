import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/require-owner";
import {
  mapProfessionalPermissionsRow,
  OWNER_PERMISSIONS,
  type ProfessionalPermissions,
} from "@/lib/professional-permissions";

export type AdminSession = {
  userId: string;
  isOwner: boolean;
  professionalId: string | null;
  permissions: ProfessionalPermissions;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  if (!supabase) return null;

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

  if (profile.role === "owner") {
    return {
      userId: user.id,
      isOwner: true,
      professionalId: null,
      permissions: OWNER_PERMISSIONS,
    };
  }

  const { data: pro } = await supabase
    .from("professionals")
    .select(
      "id, can_book_clients, can_create_squeeze_in, can_open_comanda, can_edit_comanda, can_close_comanda, can_edit_appointments, can_cancel_appointments, can_manage_schedule_blocks"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    isOwner: false,
    professionalId: pro?.id ?? null,
    permissions: mapProfessionalPermissionsRow(pro),
  };
}

export async function requireAdmin(): Promise<ActionResult | AdminSession> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Você precisa estar logado." };
  return session;
}
