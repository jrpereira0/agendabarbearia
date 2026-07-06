import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashInflowPaymentMethod } from "@/lib/comanda-types";

export type CustomerCreditTransaction = {
  id: string;
  amountCents: number;
  type: "add" | "use";
  paymentMethod: CashInflowPaymentMethod | null;
  description: string | null;
  comandaId: string | null;
  createdAt: string;
};

export async function getCustomerCreditBalance(
  admin: SupabaseClient,
  customerId: string
): Promise<number> {
  const { data } = await admin
    .from("customers")
    .select("credit_balance_cents")
    .eq("id", customerId)
    .maybeSingle();

  return data?.credit_balance_cents ?? 0;
}

export async function getCustomerCreditBalanceByWhatsapp(
  admin: SupabaseClient,
  whatsapp: string
): Promise<number> {
  const { data } = await admin
    .from("customers")
    .select("credit_balance_cents")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  return data?.credit_balance_cents ?? 0;
}

export async function resolveCustomerIdByWhatsapp(
  admin: SupabaseClient,
  whatsapp: string
): Promise<string | null> {
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  return data?.id ?? null;
}

export async function listCustomerCreditTransactions(
  admin: SupabaseClient,
  customerId: string,
  limit = 50
): Promise<CustomerCreditTransaction[]> {
  const { data } = await admin
    .from("customer_credit_transactions")
    .select(
      "id, amount_cents, type, payment_method, description, comanda_id, created_at"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    amountCents: row.amount_cents,
    type: row.type as "add" | "use",
    paymentMethod: row.payment_method as CashInflowPaymentMethod | null,
    description: row.description,
    comandaId: row.comanda_id,
    createdAt: row.created_at,
  }));
}

async function applyCreditDelta(
  admin: SupabaseClient,
  customerId: string,
  deltaCents: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: customer } = await admin
    .from("customers")
    .select("credit_balance_cents")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return { ok: false, error: "Cliente não encontrado." };
  }

  const nextBalance = customer.credit_balance_cents + deltaCents;
  if (nextBalance < 0) {
    return { ok: false, error: "Saldo de crédito insuficiente." };
  }

  const { error } = await admin
    .from("customers")
    .update({
      credit_balance_cents: nextBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o saldo de crédito." };
  }

  return { ok: true };
}

export async function addCustomerCredit(
  admin: SupabaseClient,
  input: {
    customerId: string;
    amountCents: number;
    paymentMethod?: CashInflowPaymentMethod | null;
    comandaId?: string | null;
    description?: string | null;
    cashRegisterSessionId?: string | null;
    createdBy?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.amountCents <= 0) {
    return { ok: false, error: "Valor de crédito inválido." };
  }

  if (input.cashRegisterSessionId && !input.paymentMethod) {
    return {
      ok: false,
      error: "Informe a forma de pagamento do depósito de crédito.",
    };
  }

  const { error: txError } = await admin
    .from("customer_credit_transactions")
    .insert({
      customer_id: input.customerId,
      amount_cents: input.amountCents,
      type: "add",
      payment_method: input.paymentMethod ?? null,
      description: input.description ?? null,
      comanda_id: input.comandaId ?? null,
      cash_register_session_id: input.cashRegisterSessionId ?? null,
      created_by: input.createdBy ?? null,
    });

  if (txError) {
    return { ok: false, error: "Não foi possível registrar o crédito." };
  }

  return applyCreditDelta(admin, input.customerId, input.amountCents);
}

export async function deductCustomerCredit(
  admin: SupabaseClient,
  input: {
    customerId: string;
    amountCents: number;
    comandaId: string;
    createdBy?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.amountCents <= 0) {
    return { ok: false, error: "Valor de crédito inválido." };
  }

  const { error: txError } = await admin
    .from("customer_credit_transactions")
    .insert({
      customer_id: input.customerId,
      amount_cents: -input.amountCents,
      type: "use",
      comanda_id: input.comandaId,
      created_by: input.createdBy ?? null,
    });

  if (txError) {
    return { ok: false, error: "Não foi possível usar o crédito." };
  }

  return applyCreditDelta(admin, input.customerId, -input.amountCents);
}

export async function reverseComandaCreditTransactions(
  admin: SupabaseClient,
  comandaId: string
): Promise<void> {
  const { data: transactions } = await admin
    .from("customer_credit_transactions")
    .select("id, customer_id, amount_cents")
    .eq("comanda_id", comandaId);

  if (!transactions?.length) return;

  for (const tx of transactions) {
    await admin.from("customer_credit_transactions").delete().eq("id", tx.id);
    await applyCreditDelta(admin, tx.customer_id, -tx.amount_cents);
  }
}
