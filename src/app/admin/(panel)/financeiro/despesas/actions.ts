"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { requireOwner, type ActionResult } from "@/lib/require-owner";
import { EXPENSE_PAYMENT_METHODS } from "@/lib/expense-service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const expenseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição da despesa."),
  amountCents: z.number().int().min(1, "Informe um valor válido."),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS, {
    message: "Escolha a forma de pagamento.",
  }),
  expenseDate: isoDate,
});

function parseExpenseForm(formData: FormData) {
  const amountRaw = String(formData.get("amountCents") ?? "").replace(/\D/g, "");
  return expenseSchema.safeParse({
    description: formData.get("description"),
    amountCents: amountRaw ? Number.parseInt(amountRaw, 10) : 0,
    paymentMethod: formData.get("paymentMethod"),
    expenseDate: formData.get("expenseDate"),
  });
}

function revalidateDespesas() {
  revalidatePath("/admin/financeiro/despesas");
  revalidatePath("/admin/metricas");
}

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await admin.from("expenses").insert({
    description: parsed.data.description,
    amount_cents: parsed.data.amountCents,
    payment_method: parsed.data.paymentMethod,
    expense_date: parsed.data.expenseDate,
  });

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidateDespesas();
  return { ok: true };
}

export async function updateExpense(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await admin
    .from("expenses")
    .update({
      description: parsed.data.description,
      amount_cents: parsed.data.amountCents,
      payment_method: parsed.data.paymentMethod,
      expense_date: parsed.data.expenseDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidateDespesas();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { data: expense } = await admin
    .from("expenses")
    .select("expense_date, recurring_expense_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Despesa fixa: registra o mês como pulado pra não gerar de novo.
  if (expense?.recurring_expense_id) {
    const { data: template } = await admin
      .from("recurring_expenses")
      .select("skip_months")
      .eq("id", expense.recurring_expense_id)
      .maybeSingle();

    const month = expense.expense_date.slice(0, 7);
    const skipMonths = new Set(template?.skip_months ?? []);
    skipMonths.add(month);

    await admin
      .from("recurring_expenses")
      .update({ skip_months: [...skipMonths] })
      .eq("id", expense.recurring_expense_id);
  }

  revalidateDespesas();
  return { ok: true };
}

const recurringExpenseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição da despesa."),
  amountCents: z.number().int().min(1, "Informe um valor válido."),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS, {
    message: "Escolha a forma de pagamento.",
  }),
  dayOfMonth: z.number().int().min(1, "Dia inválido.").max(31, "Dia inválido."),
  startDate: isoDate,
  endDate: isoDate.optional().or(z.literal("")),
});

function parseRecurringExpenseForm(formData: FormData) {
  const amountRaw = String(formData.get("amountCents") ?? "").replace(/\D/g, "");
  const dayRaw = String(formData.get("dayOfMonth") ?? "").replace(/\D/g, "");
  return recurringExpenseSchema.safeParse({
    description: formData.get("description"),
    amountCents: amountRaw ? Number.parseInt(amountRaw, 10) : 0,
    paymentMethod: formData.get("paymentMethod"),
    dayOfMonth: dayRaw ? Number.parseInt(dayRaw, 10) : 0,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
  });
}

function revalidateRecorrentes() {
  revalidatePath("/admin/financeiro/despesas/recorrentes");
  revalidatePath("/admin/financeiro/despesas");
  revalidatePath("/admin/metricas");
}

export async function createRecurringExpense(
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseRecurringExpenseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  if (parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
    return { ok: false, error: "A data final não pode ser antes da inicial." };
  }

  const { error } = await admin.from("recurring_expenses").insert({
    description: parsed.data.description,
    amount_cents: parsed.data.amountCents,
    payment_method: parsed.data.paymentMethod,
    day_of_month: parsed.data.dayOfMonth,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
  });

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidateRecorrentes();
  return { ok: true };
}

export async function updateRecurringExpense(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseRecurringExpenseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  if (parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
    return { ok: false, error: "A data final não pode ser antes da inicial." };
  }

  const { error } = await admin
    .from("recurring_expenses")
    .update({
      description: parsed.data.description,
      amount_cents: parsed.data.amountCents,
      payment_method: parsed.data.paymentMethod,
      day_of_month: parsed.data.dayOfMonth,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidateRecorrentes();
  return { ok: true };
}

export async function setRecurringExpenseActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { error } = await admin
    .from("recurring_expenses")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateRecorrentes();
  return { ok: true };
}

export async function deleteRecurringExpense(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { error } = await admin.from("recurring_expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateRecorrentes();
  return { ok: true };
}
