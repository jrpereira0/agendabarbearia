import { createAdminClient } from "@/lib/supabase/admin";

export type UpsertCustomerInput = {
  firstName: string;
  lastName: string;
  whatsapp: string;
};

export type UpsertCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string };

export async function upsertCustomer(
  input: UpsertCustomerInput
): Promise<UpsertCustomerResult> {
  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("customers")
    .select("id")
    .eq("whatsapp", input.whatsapp)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: "Não foi possível salvar os dados do cliente." };
  }

  if (existing) {
    const { data: updated, error } = await admin
      .from("customers")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !updated) {
      return { ok: false, error: "Não foi possível atualizar o cliente." };
    }

    return { ok: true, customerId: updated.id };
  }

  const { data: created, error } = await admin
    .from("customers")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      whatsapp: input.whatsapp,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Esse WhatsApp já está cadastrado. Tente de novo.",
      };
    }
    return { ok: false, error: "Não foi possível cadastrar o cliente." };
  }

  if (!created) {
    return { ok: false, error: "Não foi possível cadastrar o cliente." };
  }

  return { ok: true, customerId: created.id };
}
