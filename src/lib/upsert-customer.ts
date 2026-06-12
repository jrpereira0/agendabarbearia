import { createAdminClient } from "@/lib/supabase/admin";

export type UpsertCustomerInput = {
  firstName: string;
  lastName: string;
  whatsapp: string;
};

export type UpsertCustomerResult =
  | { ok: true; customerId: string; firstName: string; lastName: string }
  | { ok: false; error: string };

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export async function upsertCustomer(
  input: UpsertCustomerInput
): Promise<UpsertCustomerResult> {
  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("customers")
    .select("id, first_name, last_name")
    .eq("whatsapp", input.whatsapp)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: "Não foi possível salvar os dados do cliente." };
  }

  if (existing) {
    const nameDiffers =
      normalizeName(input.firstName) !== normalizeName(existing.first_name) ||
      normalizeName(input.lastName) !== normalizeName(existing.last_name);

    if (nameDiffers) {
      return {
        ok: false,
        error: `Este WhatsApp já pertence a ${existing.first_name} ${existing.last_name}. Verifique o número ou edite o cadastro em Clientes.`,
      };
    }

    return {
      ok: true,
      customerId: existing.id,
      firstName: existing.first_name,
      lastName: existing.last_name,
    };
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

  return {
    ok: true,
    customerId: created.id,
    firstName: input.firstName,
    lastName: input.lastName,
  };
}
