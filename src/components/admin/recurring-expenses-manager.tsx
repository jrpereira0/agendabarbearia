"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleCheck,
  CircleOff,
  MoreVertical,
  Pencil,
  Plus,
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
import { DatePickerField } from "@/components/admin/date-picker-field";
import { CatalogListEmpty } from "@/components/admin/catalog-list";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type ExpensePaymentMethod,
  type RecurringExpense,
} from "@/lib/expense-service";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  setRecurringExpenseActive,
  updateRecurringExpense,
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
  startDate: string;
  endDate: string;
};

function emptyForm(today: string): FormState {
  return {
    description: "",
    amountInput: "",
    paymentMethod: "pix",
    startDate: today,
    endDate: "",
  };
}

function formFromItem(item: RecurringExpense): FormState {
  return {
    description: item.description,
    amountInput: formatPriceBRL(item.amountCents),
    paymentMethod: item.paymentMethod,
    startDate: item.startDate,
    endDate: item.endDate ?? "",
  };
}

function dayFromDate(iso: string): number {
  return Number.parseInt(iso.slice(8, 10), 10);
}

function periodLabel(item: RecurringExpense): string {
  const start = `desde ${formatDateBR(item.startDate)}`;
  return item.endDate ? `${start} até ${formatDateBR(item.endDate)}` : start;
}

function RecurringExpenseFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: FormState;
  busy: boolean;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState(initial);

  function update(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
        <DialogHeader>
          <DialogTitle className="text-[#f5f5f5]">{title}</DialogTitle>
          <DialogDescription className={ADMIN_SURFACE.muted}>
            Lançada todo mês no dia da data inicial. Se o mês for mais curto,
            cai no último dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <DarkLabel htmlFor="recurring-description">Descrição</DarkLabel>
            <Input
              id="recurring-description"
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Ex.: Aluguel do salão"
              disabled={busy}
              className={ADMIN_SURFACE.input}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <DarkLabel htmlFor="recurring-amount">Valor</DarkLabel>
              <Input
                id="recurring-amount"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <DarkLabel>A partir de (define o dia do mês)</DarkLabel>
              <DatePickerField
                value={form.startDate}
                onChange={(value) => update({ startDate: value })}
                tone="dark"
                className="sm:w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <DarkLabel>Até (opcional)</DarkLabel>
                {form.endDate ? (
                  <button
                    type="button"
                    onClick={() => update({ endDate: "" })}
                    className={cn("text-xs underline-offset-4 hover:underline", ADMIN_SURFACE.accent)}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              <DatePickerField
                value={form.endDate || form.startDate}
                onChange={(value) => update({ endDate: value })}
                tone="dark"
                className="sm:w-full"
              />
            </div>
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

export function RecurringExpensesManager({
  items,
  today,
}: {
  items: RecurringExpense[];
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringExpense | null>(null);

  function buildFormData(form: FormState) {
    const formData = new FormData();
    formData.set("description", form.description);
    formData.set("amountCents", form.amountInput.replace(/\D/g, ""));
    formData.set("paymentMethod", form.paymentMethod);
    formData.set("dayOfMonth", String(dayFromDate(form.startDate)));
    formData.set("startDate", form.startDate);
    formData.set("endDate", form.endDate);
    return formData;
  }

  async function handleCreate(form: FormState) {
    setBusy(true);
    const result = await createRecurringExpense(buildFormData(form));
    if (result.ok) {
      toast.success("Despesa fixa cadastrada.");
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
    const result = await updateRecurringExpense(editing.id, buildFormData(form));
    if (result.ok) {
      toast.success("Despesa fixa atualizada.");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleToggleActive(item: RecurringExpense) {
    setBusy(true);
    const result = await setRecurringExpenseActive(item.id, !item.active);
    if (result.ok) {
      toast.success(item.active ? "Despesa fixa pausada." : "Despesa fixa reativada.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteRecurringExpense(deleteTarget.id);
    if (result.ok) {
      toast.success("Despesa fixa excluída.");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setCreating(true)}
          className={cn("h-10 w-full sm:h-9 sm:w-auto", ADMIN_SURFACE.btnPrimary)}
        >
          <Plus />
          Nova despesa fixa
        </Button>
      </div>

      {items.length === 0 ? (
        <CatalogListEmpty
          tone="dark"
          title="Nenhuma despesa fixa cadastrada"
          description="Cadastre aluguel, internet, salário fixo e outras contas recorrentes."
        />
      ) : (
        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
          <ul className="divide-y divide-white/10">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5",
                  !item.active && "opacity-60"
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#1a1b1e]">
                  <Repeat className={cn("size-4", ADMIN_SURFACE.muted)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-block size-2 shrink-0 rounded-full",
                        item.active ? "bg-emerald-500" : "bg-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                      {item.description}
                    </p>
                  </div>
                  <p className={cn("mt-0.5 truncate text-xs", ADMIN_SURFACE.muted)}>
                    Todo dia {item.dayOfMonth} ·{" "}
                    {EXPENSE_PAYMENT_METHOD_LABELS[item.paymentMethod]} ·{" "}
                    {periodLabel(item)}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums text-[#f5f5f5]">
                  {formatPriceBRL(item.amountCents)}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      aria-label="Ações"
                      className="text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={ADMIN_SURFACE.popover}>
                    <DropdownMenuItem onSelect={() => setEditing(item)}>
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleToggleActive(item)}>
                      {item.active ? <CircleOff /> : <CircleCheck />}
                      {item.active ? "Pausar" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteTarget(item)}
                    >
                      <Trash2 />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecurringExpenseFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nova despesa fixa"
        initial={emptyForm(today)}
        busy={busy}
        onSubmit={handleCreate}
      />

      <RecurringExpenseFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Editar despesa fixa"
        initial={editing ? formFromItem(editing) : emptyForm(today)}
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
              Os lançamentos já feitos em Despesas continuam no histórico. Só
              para de gerar novos meses. Prefira pausar se for temporário.
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
