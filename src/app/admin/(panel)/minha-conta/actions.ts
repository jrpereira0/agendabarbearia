"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import type { ActionResult } from "@/lib/require-owner";

const passwordSchema = z
  .string()
  .min(6, "A senha deve ter pelo menos 6 caracteres.");

export async function changeMyPassword(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  if (session.isOwner) {
    return { ok: false, error: "Use Configurações da barbearia." };
  }

  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data,
  });

  if (error) {
    return { ok: false, error: "Não foi possível alterar a senha. Tente de novo." };
  }

  return { ok: true };
}
