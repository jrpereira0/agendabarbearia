"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerByWhatsapp } from "@/lib/lookup-customer";
import { requireAdmin } from "@/lib/require-admin";
import {
  matchesCustomerSearch,
  capitalizePersonName,
  parseCustomerSearchQuery,
  rankCustomerSearch,
  canRunCustomerSearch,
  nameSearchSqlPrefixes,
} from "@/lib/text";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

export type AdminCustomerLookupResult =
  | {
      ok: true;
      found: true;
      firstName: string;
      lastName: string;
      creditBalanceCents: number;
    }
  | { ok: true; found: false }
  | { ok: false; error: string };

export type AdminCustomerMatch = {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  creditBalanceCents: number;
};

export type AdminCustomerSearchResult =
  | { ok: true; customers: AdminCustomerMatch[] }
  | { ok: false; error: string };

export type CustomerAgendaSummaryResult =
  | {
      ok: true;
      customerId: string | null;
      creditBalanceCents: number;
    }
  | { ok: false; error: string };

/** Saldo de crédito + id do cliente para o modal da agenda. */
export async function getCustomerAgendaSummary(
  rawWhatsapp: string
): Promise<CustomerAgendaSummaryResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return {
      ok: false,
      error: "error" in session ? session.error : "Faça login de novo.",
    };
  }

  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: true, customerId: null, creditBalanceCents: 0 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento." };
  }

  const { data } = await admin
    .from("customers")
    .select("id, credit_balance_cents")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  return {
    ok: true,
    customerId: data?.id ?? null,
    creditBalanceCents: data?.credit_balance_cents ?? 0,
  };
}

/** Busca cliente pelo WhatsApp completo no painel — sem limite da API pública. */
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

  const result = await getCustomerByWhatsapp(whatsapp);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  if (!result.found || !result.customer) {
    return { ok: true, found: false };
  }

  return {
    ok: true,
    found: true,
    firstName: result.customer.firstName,
    lastName: result.customer.lastName,
    creditBalanceCents: result.customer.creditBalanceCents,
  };
}

/**
 * Busca clientes por nome (2+ letras, sem precisar de acento) ou
 * pedaço do WhatsApp (3+ dígitos em qualquer posição).
 */
export async function searchCustomersForAdmin(
  rawQuery: string
): Promise<AdminCustomerSearchResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return {
      ok: false,
      error: "error" in session ? session.error : "Faça login de novo.",
    };
  }

  const q = rawQuery.trim();
  if (!canRunCustomerSearch(q)) {
    return { ok: true, customers: [] };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento." };
  }

  const { tokens, digits, isPhoneHeavy } = parseCustomerSearchQuery(q);

  let rows: {
    id: string;
    first_name: string;
    last_name: string;
    whatsapp: string;
    credit_balance_cents: number | null;
  }[] = [];

  if (isPhoneHeavy || (digits.length >= 3 && tokens.length === 0)) {
    const { data, error } = await admin
      .from("customers")
      .select("id, first_name, last_name, whatsapp, credit_balance_cents")
      .like("whatsapp", `%${digits}%`)
      .order("first_name")
      .limit(80);

    if (error) {
      return { ok: false, error: "Não foi possível buscar clientes." };
    }
    rows = data ?? [];
  } else {
    const filters = new Set<string>();

    for (const token of tokens) {
      const safe = token.replace(/[%_,]/g, "").slice(0, 40);
      if (safe.length < 1) continue;

      // 1ª letra (+ variantes com acento): traz candidatos; o filtro
      // fino ignora acento em matchesCustomerSearch ("jose" → "José").
      for (const prefix of nameSearchSqlPrefixes(safe)) {
        filters.add(`first_name.ilike.${prefix}`);
        filters.add(`last_name.ilike.${prefix}`);
      }

      // Também tenta o pedaço digitado (quando o cadastro está sem acento).
      if (safe.length >= 2) {
        filters.add(`first_name.ilike.%${safe}%`);
        filters.add(`last_name.ilike.%${safe}%`);
      }
    }

    if (digits.length >= 3) {
      filters.add(`whatsapp.like.%${digits}%`);
    }

    if (filters.size === 0) {
      return { ok: true, customers: [] };
    }

    const { data, error } = await admin
      .from("customers")
      .select("id, first_name, last_name, whatsapp, credit_balance_cents")
      .or([...filters].join(","))
      .order("first_name")
      .limit(120);

    if (error) {
      return { ok: false, error: "Não foi possível buscar clientes." };
    }
    rows = data ?? [];
  }

  const customers = rows
    .map((row) => ({
      id: row.id,
      firstName: capitalizePersonName(row.first_name),
      lastName: capitalizePersonName(row.last_name),
      whatsapp: row.whatsapp,
      creditBalanceCents: row.credit_balance_cents ?? 0,
    }))
    .filter((customer) => matchesCustomerSearch(customer, q))
    .sort((a, b) => {
      const rankDiff = rankCustomerSearch(a, q) - rankCustomerSearch(b, q);
      if (rankDiff !== 0) return rankDiff;
      const nameA = `${a.firstName} ${a.lastName}`;
      const nameB = `${b.firstName} ${b.lastName}`;
      return nameA.localeCompare(nameB, "pt-BR");
    })
    .slice(0, 8);

  return { ok: true, customers };
}
