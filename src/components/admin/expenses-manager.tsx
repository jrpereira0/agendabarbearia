"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/admin/search-input";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import {
  CatalogListEmpty,
  CatalogTable,
  CatalogTableBody,
  CatalogTableHead,
  CatalogTableHeadCell,
} from "@/components/admin/catalog-list";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import { matchesSearch } from "@/lib/text";
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type Expense,
  type ExpensePaymentMethod,
} from "@/lib/expense-service";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/app/admin/(panel)/financeiro/despesas/actions";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

function DarkLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[#f5f5f5]">
      {children}
    </Label>
  );
}

type FormState = {
  description: string;
  amountInput: string;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
};

function emptyForm(today: string): FormState {
  return {
    description: "",
    amountInput: "",
    paymentMethod: "pix",
    expenseDate: today,
  };
}

function formFromExpense(expense: Expense): FormState {
  return {
    description: expense.description,
    amountInput: formatPriceBRL(expense.amountCents),
    paymentMethod: expense.paymentMethod,
    expenseDate: expense.expenseDate,
  };
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  title,
  today,
  initial,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  today: string;
  initial: FormState;
  busy: boolean;
  onSubmit: (form: FormState) => void;
}) {
  // O Dialog só monta o conteúdo quando aberto, então o estado sempre
  // nasce do `initial` mais recente (nunca "vaza" entre criar/editar).
  const [form, setForm] = useState(initial);

  function update(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
        <DialogHeader>
          <DialogTitle className="text-[#f5f5f5]">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <DarkLabel htmlFor="expense-description">Descrição</DarkLabel>
            <Input
              id="expense-description"
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Ex.: Conta de energia"
              disabled={busy}
              className={ADMIN_SURFACE.input}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <DarkLabel htmlFor="expense-amount">Valor</DarkLabel>
              <Input
                id="expense-amount"
                inputMode="numeric"
                value={form.amountInput}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  update({
                    amountInput: digits
                      ? formatPriceBRL(Number.parseInt(digits, 10))
                      : "",
                  });
                }}
                placeholder="R$ 0,00"
                disabled={busy}
                className={ADMIN_SURFACE.input}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <DarkLabel>Forma de pagamento</DarkLabel>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) =>
                  update({ paymentMethod: value as ExpensePaymentMethod })
                }
                disabled={busy}
              >
                <SelectTrigger className={ADMIN_SURFACE.selectTrigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={ADMIN_SURFACE.popover}>
                  {EXPENSE_PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {EXPENSE_PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <DarkLabel>Data</DarkLabel>
            <DatePickerField
              value={form.expenseDate || today}
              onChange={(value) => update({ expenseDate: value })}
              tone="dark"
              className="sm:w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={ADMIN_SURFACE.btnGhost}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={busy}
            className={ADMIN_SURFACE.btnPrimary}
          >
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ações"
          className="text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={ADMIN_SURFACE.popover}>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExpensesManager({
  from,
  to,
  today,
  expenses,
  totalCents,
}: {
  from: string;
  to: string;
  today: string;
  expenses: Expense[];
  totalCents: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return expenses;
    return expenses.filter((expense) => matchesSearch(expense.description, query));
  }, [expenses, query]);

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    router.push(`/admin/financeiro/despesas?${params.toString()}`);
  }

  async function handleCreate(form: FormState) {
    setBusy(true);
    const formData = new FormData();
    formData.set("description", form.description);
    formData.set("amountCents", form.amountInput.replace(/\D/g, ""));
    formData.set("paymentMethod", form.paymentMethod);
    formData.set("expenseDate", form.expenseDate);
    const result = await createExpense(formData);
    if (result.ok) {
      toast.success("Despesa lançada.");
      setCreating(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleUpdate(form: FormState) {
    if (!editing) return;
    setBusy(true);
    const formData = new FormData();
    formData.set("description", form.description);
    formData.set("amountCents", form.amountInput.replace(/\D/g, ""));
    formData.set("paymentMethod", form.paymentMethod);
    formData.set("expenseDate", form.expenseDate);
    const result = await updateExpense(editing.id, formData);
    if (result.ok) {
      toast.success("Despesa atualizada.");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteExpense(deleteTarget.id);
    if (result.ok) {
      toast.success("Despesa excluída.");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  const showSearch = expenses.length > 5 || query.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <FinancePeriodFilter
        today={today}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onSubmit={(event) => {
          event.preventDefault();
          navigate(fromDate, toDate);
        }}
        onPreset={(presetFrom, presetTo) => {
          setFromDate(presetFrom);
          setToDate(presetTo);
          navigate(presetFrom, presetTo);
        }}
        tone="dark"
        mobilePresetsFirst
      />

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 sm:p-5",
          ADMIN_SURFACE.panel
        )}
      >
        <div>
          <p className={cn("text-xs sm:text-sm", ADMIN_SURFACE.muted)}>
            Total de despesas no período
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-[#f5f5f5] sm:text-2xl">
            {formatPriceBRL(totalCents)}
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className={cn("h-10 sm:h-9", ADMIN_SURFACE.btnPrimary)}
        >
          <Plus />
          Nova despesa
        </Button>
      </div>

      {showSearch ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar despesa…"
          inputClassName={ADMIN_SURFACE.input}
        />
      ) : null}

      {filtered.length === 0 ? (
        expenses.length === 0 ? (
          <CatalogListEmpty
            tone="dark"
            title="Nenhuma despesa neste período"
            description="Lance aluguel, contas, compras e outras saídas da barbearia."
          />
        ) : (
          <CatalogListEmpty
            tone="dark"
            title="Nenhuma despesa encontrada"
            description="Ajuste a busca ou o período selecionado."
          />
        )
      ) : (
        <>
          <CatalogTable tone="dark">
            <CatalogTableHead tone="dark">
              <CatalogTableHeadCell className="w-[8.5rem]">Data</CatalogTableHeadCell>
              <CatalogTableHeadCell>Descrição</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden w-[10rem] sm:table-cell">
                Pagamento
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-[9rem] text-right">
                Valor
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody tone="dark">
              {filtered.map((expense) => (
                <tr key={expense.id} className="transition-colors hover:bg-white/[0.04]">
                  <td className="px-4 py-3 text-[#f5f5f5]">
                    {formatDateBR(expense.expenseDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-[#f5f5f5]">
                        {expense.description}
                      </span>
                      {expense.recurringExpenseId ? (
                        <Repeat
                          className={cn("size-3.5 shrink-0", ADMIN_SURFACE.muted)}
                          aria-label="Despesa fixa"
                        />
                      ) : null}
                    </div>
                    <p className={cn("mt-0.5 text-xs sm:hidden", ADMIN_SURFACE.muted)}>
                      {EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                    </p>
                  </td>
                  <td className={cn("hidden px-4 py-3 sm:table-cell", ADMIN_SURFACE.muted)}>
                    {EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#f5f5f5]">
                    {formatPriceBRL(expense.amountCents)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <ExpenseRowActions
                      onEdit={() => setEditing(expense)}
                      onDelete={() => setDeleteTarget(expense)}
                    />
                  </td>
                </tr>
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden md:hidden")}>
            <ul className="divide-y divide-white/10">
              {filtered.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#1a1b1e]")}>
                    <Receipt className={cn("size-4", ADMIN_SURFACE.muted)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                        {expense.description}
                      </p>
                      {expense.recurringExpenseId ? (
                        <Repeat className={cn("size-3.5 shrink-0", ADMIN_SURFACE.muted)} />
                      ) : null}
                    </div>
                    <p className={cn("mt-0.5 truncate text-xs", ADMIN_SURFACE.muted)}>
                      {formatDateBR(expense.expenseDate)} ·{" "}
                      {EXPENSE_PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums text-[#f5f5f5]">
                    {formatPriceBRL(expense.amountCents)}
                  </p>
                  <ExpenseRowActions
                    onEdit={() => setEditing(expense)}
                    onDelete={() => setDeleteTarget(expense)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <ExpenseFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nova despesa"
        today={today}
        initial={emptyForm(today)}
        busy={busy}
        onSubmit={handleCreate}
      />

      <ExpenseFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Editar despesa"
        today={today}
        initial={editing ? formFromExpense(editing) : emptyForm(today)}
        busy={busy}
        onSubmit={handleUpdate}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Excluir &ldquo;{deleteTarget?.description}&rdquo;?
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              {deleteTarget?.recurringExpenseId
                ? "É uma ocorrência de despesa fixa: só este mês será removido, os próximos continuam sendo lançados."
                : "Essa ação não pode ser desfeita."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busy}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
