"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner, type ActionResult } from "@/lib/require-owner";

const customerSchema = z.object({
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números (DDD + número)."),
});

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const auth = await requireOwner();
  if (auth) return auth;

  const parsed = customerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    whatsapp: String(formData.get("whatsapp") ?? "").replace(/\D/g, ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();

  const { error } = await admin.from("customers").insert({
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    whatsapp: parsed.data.whatsapp,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Já existe um cliente com esse WhatsApp.",
      };
    }
    return { ok: false, error: "Não foi possível cadastrar o cliente." };
  }

  revalidatePath("/admin/clientes");
  return { ok: true };
}

export async function updateCustomer(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireOwner();
  if (auth) return auth;

  const parsed = customerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    whatsapp: String(formData.get("whatsapp") ?? "").replace(/\D/g, ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Cliente não encontrado." };
  }

  const { error } = await admin
    .from("customers")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      whatsapp: parsed.data.whatsapp,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Já existe outro cliente com esse WhatsApp.",
      };
    }
    return { ok: false, error: "Não foi possível salvar as alterações." };
  }

  await admin
    .from("appointments")
    .update({
      customer_first_name: parsed.data.firstName,
      customer_last_name: parsed.data.lastName,
      customer_whatsapp: parsed.data.whatsapp,
    })
    .eq("customer_id", customerId);

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${customerId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const auth = await requireOwner();
  if (auth) return auth;

  const admin = createAdminClient();

  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);

  if (count && count > 0) {
    return {
      ok: false,
      error:
        "Esse cliente tem agendamentos no histórico. Não dá pra excluir — edite os dados se precisar.",
    };
  }

  const { error } = await admin.from("customers").delete().eq("id", customerId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o cliente." };
  }

  revalidatePath("/admin/clientes");
  return { ok: true };
}
