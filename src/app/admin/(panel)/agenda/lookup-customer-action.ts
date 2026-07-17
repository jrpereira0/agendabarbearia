"use server";

import { lookupCustomerByWhatsapp } from "@/lib/lookup-customer";
import { requireAdmin } from "@/lib/require-admin";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

export type AdminCustomerLookupResult =
  | { ok: true; found: true; firstName: string; lastName: string }
  | { ok: true; found: false }
  | { ok: false; error: string };

/** Busca cliente pelo WhatsApp no painel — sem limite da API pública. */
export async function lookupCustomerForAdmin(
  rawWhatsapp: string
): Promise<AdminCustomerLookupResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return {
      ok: false,
      error: "error" in session ? session.error : "Faça login de novo.",
    };
  }

  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE };
  }

  const result = await lookupCustomerByWhatsapp(whatsapp);
  if (!result.found) {
    return { ok: true, found: false };
  }

  return {
    ok: true,
    found: true,
    firstName: result.firstName,
    lastName: result.lastName,
  };
}
