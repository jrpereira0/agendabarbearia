import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CASH_INFLOW_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type CashInflowPaymentMethod,
} from "@/lib/comanda-types";

/** Despesas usam as mesmas formas de pagamento das entradas de caixa (sem crédito de cliente). */
export const EXPENSE_PAYMENT_METHODS = CASH_INFLOW_PAYMENT_METHODS;
export type ExpensePaymentMethod = CashInflowPaymentMethod;
export const EXPENSE_PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> =
  PAYMENT_METHOD_LABELS;

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  recurringExpenseId: string | null;
};

export type RecurringExpense = {
  id: string;
  description: string;
  amountCents: number;
  paymentMethod: ExpensePaymentMethod;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

type RecurringExpenseRow = {
  id: string;
  description: string;
  amount_cents: number;
  payment_method: string;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  skip_months: string[];
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Clampa o dia no mês (ex.: dia 31 em fevereiro vira o último dia do mês). */
function occurrenceDateForMonth(
  year: number,
  monthIndex: number,
  dayOfMonth: number
): string {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, daysInMonth);
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Datas de ocorrência (uma por mês) de uma despesa fixa, até `throughDate` (inclusive). */
export function listRecurringOccurrenceDates(
  template: Pick<
    RecurringExpenseRow,
    "start_date" | "end_date" | "day_of_month" | "skip_months"
  >,
  throughDate: string
): string[] {
  const start = new Date(`${template.start_date}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];

  const dates: string[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const skip = new Set(template.skip_months ?? []);

  // Limite de segurança: nunca gera mais que 10 anos de ocorrências numa carga.
  for (let i = 0; i < 120; i++) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const occDate = occurrenceDateForMonth(year, month, template.day_of_month);

    if (occDate > throughDate) break;
    if (template.end_date && occDate > template.end_date) break;

    if (
      occDate >= template.start_date &&
      !skip.has(occDate.slice(0, 7))
    ) {
      dates.push(occDate);
    }

    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return dates;
}

/**
 * Materializa em `expenses` as ocorrências pendentes de todas as despesas
 * fixas ativas, até hoje. Idempotente: só insere o que ainda não existe.
 */
export async function generateDueRecurringExpenses(
  admin: SupabaseClient,
  throughDate: string
): Promise<void> {
  const { data: templates } = await admin
    .from("recurring_expenses")
    .select(
      "id, description, amount_cents, payment_method, day_of_month, start_date, end_date, active, skip_months"
    )
    .eq("active", true);

  for (const template of (templates ?? []) as RecurringExpenseRow[]) {
    const occurrences = listRecurringOccurrenceDates(template, throughDate);
    if (occurrences.length === 0) continue;

    const { data: existing } = await admin
      .from("expenses")
      .select("expense_date")
      .eq("recurring_expense_id", template.id)
      .in("expense_date", occurrences);

    const existingDates = new Set((existing ?? []).map((row) => row.expense_date));
    const toInsert = occurrences
      .filter((date) => !existingDates.has(date))
      .map((date) => ({
        description: template.description,
        amount_cents: template.amount_cents,
        payment_method: template.payment_method,
        expense_date: date,
        recurring_expense_id: template.id,
      }));

    if (toInsert.length > 0) {
      await admin.from("expenses").insert(toInsert);
    }
  }
}

export async function getExpensesForPeriod(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<Expense[]> {
  const { data } = await admin
    .from("expenses")
    .select("id, description, amount_cents, payment_method, expense_date, recurring_expense_id")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    paymentMethod: row.payment_method as ExpensePaymentMethod,
    expenseDate: row.expense_date,
    recurringExpenseId: row.recurring_expense_id,
  }));
}

export async function getExpensesTotalCents(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<number> {
  const report = await getExpensesReport(admin, from, to);
  return report.totalCents;
}

export type ExpensesDayMetric = {
  date: string;
  totalCents: number;
  count: number;
};

export type ExpensesReport = {
  from: string;
  to: string;
  totalCents: number;
  count: number;
  recurringCount: number;
  oneOffCount: number;
  byPaymentMethod: Record<ExpensePaymentMethod, number>;
  byDay: ExpensesDayMetric[];
  expenses: Expense[];
};

function emptyExpensePaymentMap(): Record<ExpensePaymentMethod, number> {
  return { pix: 0, cash: 0, debit: 0, credit: 0 };
}

/** Relatório de saídas do período: totais, por forma de pagamento e por dia. */
export async function getExpensesReport(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<ExpensesReport> {
  const expenses = await getExpensesForPeriod(admin, from, to);
  const byPaymentMethod = emptyExpensePaymentMap();
  const byDayMap = new Map<string, ExpensesDayMetric>();
  let totalCents = 0;
  let recurringCount = 0;
  let oneOffCount = 0;

  for (const expense of expenses) {
    totalCents += expense.amountCents;
    if (expense.paymentMethod in byPaymentMethod) {
      byPaymentMethod[expense.paymentMethod] += expense.amountCents;
    }
    if (expense.recurringExpenseId) recurringCount += 1;
    else oneOffCount += 1;

    const day = byDayMap.get(expense.expenseDate) ?? {
      date: expense.expenseDate,
      totalCents: 0,
      count: 0,
    };
    day.totalCents += expense.amountCents;
    day.count += 1;
    byDayMap.set(expense.expenseDate, day);
  }

  const byDay = [...byDayMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    from,
    to,
    totalCents,
    count: expenses.length,
    recurringCount,
    oneOffCount,
    byPaymentMethod,
    byDay,
    expenses,
  };
}

export async function getRecurringExpenses(
  admin: SupabaseClient
): Promise<RecurringExpense[]> {
  const { data } = await admin
    .from("recurring_expenses")
    .select(
      "id, description, amount_cents, payment_method, day_of_month, start_date, end_date, active"
    )
    .order("active", { ascending: false })
    .order("description");

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    paymentMethod: row.payment_method as ExpensePaymentMethod,
    dayOfMonth: row.day_of_month,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
  }));
}
