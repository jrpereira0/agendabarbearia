import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeWhatsapp,
  whatsappLookupKeys,
} from "@/lib/whatsapp";

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
      firstName: data.first_name,
      lastName: data.last_name,
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
