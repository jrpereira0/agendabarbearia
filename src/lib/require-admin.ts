import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/require-owner";
import {
  mapProfessionalPermissionsRow,
  OWNER_PERMISSIONS,
  RECEPTION_PERMISSIONS,
  type ProfessionalPermissions,
} from "@/lib/professional-permissions";

export type AdminRole = "owner" | "barber" | "reception";

export type AdminSession = {
  userId: string;
  role: AdminRole;
  isOwner: boolean;
  isReception: boolean;
  professionalId: string | null;
  permissions: ProfessionalPermissions;
};

/** Dono e recepção veem/operam a agenda de todos os barbeiros. */
export function canViewAllAgendas(session: AdminSession): boolean {
  return session.isOwner || session.isReception;
}

/** Dono e recepção cadastram/editam clientes (crédito manual só o dono). */
export function canManageCustomers(session: AdminSession): boolean {
  return session.isOwner || session.isReception;
}

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

  if (
    !profile ||
    (profile.role !== "owner" &&
      profile.role !== "barber" &&
      profile.role !== "reception")
  ) {
    return null;
  }

  if (profile.role === "owner") {
    return {
      userId: user.id,
      role: "owner",
      isOwner: true,
      isReception: false,
      professionalId: null,
      permissions: OWNER_PERMISSIONS,
    };
  }

  if (profile.role === "reception") {
    return {
      userId: user.id,
      role: "reception",
      isOwner: false,
      isReception: true,
      professionalId: null,
      // Agenda/comanda/clientes no dia a dia; sem fechar comanda nem financeiro/cadastros do dono.
      permissions: RECEPTION_PERMISSIONS,
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
    role: "barber",
    isOwner: false,
    isReception: false,
    professionalId: pro?.id ?? null,
    permissions: mapProfessionalPermissionsRow(pro),
  };
}

export async function requireAdmin(): Promise<ActionResult | AdminSession> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Você precisa estar logado." };
  return session;
}
