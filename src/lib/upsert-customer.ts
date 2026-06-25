import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
  whatsappLookupKeys,
} from "@/lib/whatsapp";

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
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento." };
  }

  const { data: existing, error: lookupError } = await admin
    .from("customers")
    .select("id, first_name, last_name")
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .limit(1)
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
      whatsapp,
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
