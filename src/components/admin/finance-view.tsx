"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Receipt, RotateCcw, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import {
  formatPaymentMethodLabel,
  type CashRegisterSummary,
  type CommissionSummary,
} from "@/lib/finance-reports";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import {
  closeCashRegisterAction,
} from "@/app/admin/(panel)/financeiro/actions";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { formatDateBR, formatDateTimeBR, formatPriceBRL } from "@/lib/format";

type FinanceViewProps = {
  date: string;
  today: string;
  monthFrom: string;
  cash: CashRegisterSummary;
  commissions: CommissionSummary;
  cashSession: CashRegisterSession | null;
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatHeaderDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function FinanceView({
  date,
  today,
  monthFrom,
  cash,
  commissions,
  cashSession,
  openCashRegister,
  responsibleOptions,
}: FinanceViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openDialog, setOpenDialog] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const isToday = date === today;
  const isCashOpen = cashSession?.status === "open";
  const otherDayOpen =
    openCashRegister && openCashRegister.serviceDate !== date
      ? openCashRegister
      : null;

  const defaultResponsibleId = responsibleOptions.find(
    (option) => option.label === cashSession?.responsibleName
  )?.id;

  function startOpenCash(mode: "open" | "reopen") {
    setOpenMode(mode);
    setOpenDialog(true);
  }

  async function handleCloseCash() {
    const result = await closeCashRegisterAction(date);
    if (result.ok) {
      toast.success("Caixa fechado.");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Financeiro"
        description="Caixa do dia e comissões dos barbeiros."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/financeiro/caixas">Histórico de caixas</Link>
          </Button>
        }
      />

      {otherDayOpen && (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm">
          O caixa de{" "}
          <Link
            href={`/admin/financeiro?date=${otherDayOpen.serviceDate}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {formatDateBR(otherDayOpen.serviceDate)}
          </Link>{" "}
          está aberto. Feche-o antes de abrir outro dia.
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Caixa do dia</p>
              <Badge variant={isCashOpen ? "default" : "secondary"}>
                {isCashOpen ? "Aberto" : "Fechado"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCashOpen
                ? "Você pode finalizar comandas neste dia."
                : "Abra o caixa para finalizar comandas neste dia."}
            </p>
            {cashSession && (
              <p className="text-xs text-muted-foreground">
                Dia do caixa: {formatDateBR(cashSession.serviceDate)}
                {cashSession.openedAt && (
                  <> · Aberto em {formatDateTimeBR(cashSession.openedAt)}</>
                )}
                {cashSession.closedAt && (
                  <> · Fechado em {formatDateTimeBR(cashSession.closedAt)}</>
                )}
              </p>
            )}
            {cashSession && (
              <p className="text-xs text-muted-foreground">
                {cashSession.responsibleName && (
                  <>Responsável: {cashSession.responsibleName} · </>
                )}
                Dinheiro inicial: {formatPriceBRL(cashSession.openingBalanceCents)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isCashOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void handleCloseCash()}
              >
                <Lock className="size-4" />
                Fechar caixa
              </Button>
            ) : cashSession ? (
              <Button
                type="button"
                size="sm"
                disabled={pending || Boolean(otherDayOpen)}
                onClick={() => startOpenCash("reopen")}
              >
                <RotateCcw className="size-4" />
                Reabrir caixa
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={pending || Boolean(otherDayOpen)}
                onClick={() => startOpenCash("open")}
              >
                <Unlock className="size-4" />
                Abrir caixa
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <OpenCashRegisterDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        serviceDate={date}
        today={today}
        mode={openMode}
        lockServiceDate={openMode === "reopen"}
        responsibleOptions={responsibleOptions}
        defaultResponsibleId={defaultResponsibleId}
        defaultOpeningBalanceCents={cashSession?.openingBalanceCents ?? 0}
        onSuccess={(openedDate) => {
          if (openedDate !== date) {
            router.push(`/admin/financeiro?date=${openedDate}`);
          } else {
            startTransition(() => router.refresh());
          }
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium capitalize">{formatHeaderDate(date)}</p>
          {isToday && (
            <p className="text-xs text-muted-foreground">Hoje</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/financeiro?date=${shiftDate(date, -1)}`} aria-label="Dia anterior">
              <ChevronLeft />
            </Link>
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro?date=${today}`}>Hoje</Link>
            </Button>
          )}
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/financeiro?date=${shiftDate(date, 1)}`} aria-label="Próximo dia">
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas do dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatPriceBRL(cash.totalCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cash.comandaCount} comanda{cash.comandaCount === 1 ? "" : "s"} fechada
              {cash.comandaCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatPriceBRL(cash.commissionCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Repasse aos barbeiros
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Barbearia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatPriceBRL(cash.shopCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total menos comissões
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Por forma de pagamento</h2>
          <Card>
            <CardContent className="pt-6">
              {cash.comandaCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma comanda fechada neste dia.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <li
                      key={method}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{formatPaymentMethodLabel(method)}</span>
                      <span className="font-medium tabular-nums">
                        {formatPriceBRL(cash.byPaymentMethod[method])}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">
            Comissões no mês ({formatDateBR(monthFrom)} – {formatDateBR(date)})
          </h2>
          <Card>
            <CardContent className="pt-6">
              {commissions.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma comanda fechada neste período.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {commissions.rows.map((row) => (
                    <li
                      key={row.professionalId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {row.professionalNickname}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.comandaCount} atendimento
                          {row.comandaCount === 1 ? "" : "s"} · {row.commissionPercent}%
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatPriceBRL(row.commissionCents)}
                      </span>
                    </li>
                  ))}
                  <Separator />
                  <li className="flex items-center justify-between text-sm font-medium">
                    <span>Total comissões</span>
                    <span className="tabular-nums">
                      {formatPriceBRL(commissions.totals.commissionCents)}
                    </span>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Comandas do dia</h2>
        {cash.comandas.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma comanda fechada"
            description="Quando você fechar comandas na agenda, elas aparecem aqui com os valores e formas de pagamento."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cash.comandas.map((comanda) => (
              <Card key={comanda.id}>
                <CardContent className="flex flex-col gap-2 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{comanda.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {comanda.professionalNickname}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatPriceBRL(comanda.totalCents)}
                    </p>
                  </div>
                  <ul className="text-xs text-muted-foreground">
                    {comanda.payments.map((p, i) => (
                      <li key={`${comanda.id}-${i}`}>
                        {formatPaymentMethodLabel(p.method)} ·{" "}
                        {formatPriceBRL(p.amountCents)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Comissão: {formatPriceBRL(comanda.commissionCents)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
