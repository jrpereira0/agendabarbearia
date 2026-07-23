import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeWhatsapp,
  whatsappLookupKeys,
} from "@/lib/whatsapp";
import { capitalizePersonName } from "@/lib/text";

export type CustomerLookupResult =
  | { found: true; firstName: string; lastName: string }
  | { found: false };

export type CustomerPublic = {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
};

export type CustomerByWhatsappResult =
  | { ok: true; found: true; customer: CustomerPublic }
  | { ok: true; found: false; customer: null }
  | { ok: false; error: string; httpStatus: number };

export async function getCustomerByWhatsapp(
  rawWhatsapp: string
): Promise<CustomerByWhatsappResult> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Sistema indisponível no momento.",
      httpStatus: 503,
    };
  }

  const { data, error } = await admin
    .from("customers")
    .select("id, first_name, last_name")
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: "Não foi possível consultar o cliente.",
      httpStatus: 500,
    };
  }

  if (!data) {
    return { ok: true, found: false, customer: null };
  }

  return {
    ok: true,
    found: true,
    customer: {
      id: data.id,
      firstName: capitalizePersonName(data.first_name),
      lastName: capitalizePersonName(data.last_name),
      whatsapp,
    },
  };
}

export async function lookupCustomerByWhatsapp(
  whatsapp: string
): Promise<CustomerLookupResult> {
  const result = await getCustomerByWhatsapp(whatsapp);
  if (!result.ok || !result.found) {
    return { found: false };
  }

  return {
    found: true,
    firstName: result.customer.firstName,
    lastName: result.customer.lastName,
  };
}

export type UpdateCustomerProfileResult =
  | { ok: true; customer: CustomerPublic }
  | { ok: false; error: string; httpStatus: number };

/**
 * Atualiza nome/sobrenome do cliente autenticado (WhatsApp imutável).
 * Se ainda não existir cadastro, cria.
 */
export async function updateCustomerProfileByWhatsapp(input: {
  whatsapp: string;
  firstName: string;
  lastName: string;
}): Promise<UpdateCustomerProfileResult> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }

  const firstName = capitalizePersonName(input.firstName);
  const lastName = capitalizePersonName(input.lastName);
  if (!firstName) {
    return { ok: false, error: "Informe o nome.", httpStatus: 400 };
  }
  if (!lastName) {
    return { ok: false, error: "Informe o sobrenome.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Sistema indisponível no momento.",
      httpStatus: 503,
    };
  }

  const { data: existing, error: lookupError } = await admin
    .from("customers")
    .select("id")
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return {
      ok: false,
      error: "Não foi possível salvar os dados.",
      httpStatus: 500,
    };
  }

  if (existing) {
    const { error } = await admin
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return {
        ok: false,
        error: "Não foi possível atualizar o cadastro.",
        httpStatus: 500,
      };
    }

    return {
      ok: true,
      customer: { id: existing.id, firstName, lastName, whatsapp },
    };
  }

  const { data: created, error } = await admin
    .from("customers")
    .insert({
      first_name: firstName,
      last_name: lastName,
      whatsapp,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "Esse WhatsApp já está cadastrado. Tente de novo.",
        httpStatus: 409,
      };
    }
    return {
      ok: false,
      error: "Não foi possível criar o cadastro.",
      httpStatus: 500,
    };
  }

  return {
    ok: true,
    customer: { id: created.id, firstName, lastName, whatsapp },
  };
}
