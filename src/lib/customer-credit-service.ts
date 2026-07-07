import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashInflowPaymentMethod } from "@/lib/comanda-types";
import { formatPriceBRL } from "@/lib/format";

export type CustomerCreditTransaction = {
  id: string;
  amountCents: number;
  type: "add" | "use";
  paymentMethod: CashInflowPaymentMethod | null;
  description: string | null;
  comandaId: string | null;
  createdAt: string;
};

type CreditTxRow = {
  id: string;
  customer_id: string;
  amount_cents: number;
  type: "add" | "use";
};

function sortTransactionsForReversal(
  transactions: CreditTxRow[]
): CreditTxRow[] {
  return [...transactions].sort((a, b) => {
    if (a.type === "use" && b.type === "add") return -1;
    if (a.type === "add" && b.type === "use") return 1;
    return 0;
  });
}

export async function canReverseComandaCreditTransactions(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: transactions } = await admin
    .from("customer_credit_transactions")
    .select("id, customer_id, amount_cents, type")
    .eq("comanda_id", comandaId);

  if (!transactions?.length) return { ok: true };

  const balanceByCustomer = new Map<string, number>();

  for (const tx of transactions) {
    if (!balanceByCustomer.has(tx.customer_id)) {
      const { data: customer } = await admin
        .from("customers")
        .select("credit_balance_cents")
        .eq("id", tx.customer_id)
        .maybeSingle();

      if (!customer) {
        return { ok: false, error: "Cliente não encontrado para estornar o crédito." };
      }

      balanceByCustomer.set(tx.customer_id, customer.credit_balance_cents);
    }
  }

  for (const tx of sortTransactionsForReversal(transactions)) {
    const balance = balanceByCustomer.get(tx.customer_id) ?? 0;
    const nextBalance = balance - tx.amount_cents;

    if (nextBalance < 0) {
      const shortfallCents = tx.amount_cents - balance;
      return {
        ok: false,
        error:
          tx.type === "add"
            ? `Não dá para reabrir: o cliente já usou ${formatPriceBRL(shortfallCents)} deste crédito em outro lugar. Ajuste o saldo no cadastro do cliente antes de reabrir.`
            : "Saldo de crédito inconsistente para reabrir esta comanda.",
      };
    }

    balanceByCustomer.set(tx.customer_id, nextBalance);
  }

  return { ok: true };
}

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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const canReverse = await canReverseComandaCreditTransactions(admin, comandaId);
  if (!canReverse.ok) return canReverse;

  const { data: transactions } = await admin
    .from("customer_credit_transactions")
    .select("id, customer_id, amount_cents, type")
    .eq("comanda_id", comandaId);

  if (!transactions?.length) return { ok: true };

  const appliedDeltas: Array<{ customerId: string; deltaCents: number }> = [];

  for (const tx of sortTransactionsForReversal(transactions)) {
    const deltaCents = -tx.amount_cents;
    const balanceResult = await applyCreditDelta(admin, tx.customer_id, deltaCents);
    if (!balanceResult.ok) {
      for (const applied of [...appliedDeltas].reverse()) {
        await applyCreditDelta(admin, applied.customerId, -applied.deltaCents);
      }
      return {
        ok: false,
        error:
          "Não foi possível estornar o crédito desta comanda. Tente de novo.",
      };
    }

    const { error: deleteError } = await admin
      .from("customer_credit_transactions")
      .delete()
      .eq("id", tx.id);

    if (deleteError) {
      await applyCreditDelta(admin, tx.customer_id, -deltaCents);
      for (const applied of [...appliedDeltas].reverse()) {
        await applyCreditDelta(admin, applied.customerId, -applied.deltaCents);
      }
      return {
        ok: false,
        error: "Não foi possível estornar o crédito desta comanda.",
      };
    }

    appliedDeltas.push({ customerId: tx.customer_id, deltaCents });
  }

  return { ok: true };
}
