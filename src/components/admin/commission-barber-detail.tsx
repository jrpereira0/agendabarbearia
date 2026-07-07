"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  commissionServiceRevenueCents,
  formatPaymentMethodLabel,
  type CommissionComandaDetail,
  type CommissionDayRow,
  type CommissionProfessionalReport,
  type CommissionServiceBreakdownRow,
} from "@/lib/finance-reports";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, formatWhatsapp } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatPriceBRL(value)}
          {suffix && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatClosedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ServiceBreakdownTable({
  rows,
}: {
  rows: CommissionServiceBreakdownRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum serviço no período.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Serviço</th>
            <th className="px-4 py-3 font-medium text-right">Qtd</th>
            <th className="px-4 py-3 font-medium text-right">Faturamento</th>
            <th className="px-4 py-3 font-medium text-right">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.isTip ? "tip" : "svc"}:${row.serviceName}`}
              className="border-b last:border-b-0"
            >
              <td className="px-4 py-3 font-medium">
                {row.serviceName}
                {row.isTip && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    gorjeta
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPriceBRL(row.grossCents)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatPriceBRL(row.commissionCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AtendimentoCard({ comanda }: { comanda: CommissionComandaDetail }) {
  const customerLabel =
    comanda.customerName?.trim() ||
    formatWhatsapp(comanda.customerWhatsapp) ||
    "Cliente";

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{customerLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateBR(comanda.serviceDate)} · fechada{" "}
            {formatClosedAt(comanda.closedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Comissão</p>
          <p className="font-semibold tabular-nums">
            {formatPriceBRL(comanda.commissionCents)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <p>
          Faturamento:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatPriceBRL(comanda.grossCents)}
          </span>
        </p>
        <p>
          Serviços:{" "}
          <span className="font-medium text-foreground">
            {comanda.serviceItemCount}
          </span>
        </p>
        {comanda.tipCents > 0 && (
          <p>
            Gorjetas:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatPriceBRL(comanda.tipCents)}
            </span>
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {comanda.items.map((item, index) => (
          <div
            key={`${item.serviceName}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm"
          >
            <span>
              {item.serviceName}
              {item.isTip && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (gorjeta)
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatPriceBRL(item.chargedPriceCents)}
              <span className="mx-1">→</span>
              <span className="font-medium text-foreground">
                {formatPriceBRL(item.commissionCents)}
              </span>
            </span>
          </div>
        ))}
      </div>

      {comanda.payments.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Pagamentos (parte dele)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {comanda.payments.map((payment) => (
              <span
                key={`${payment.method}-${payment.amountCents}`}
                className="rounded-md border bg-background px-2.5 py-1 text-xs tabular-nums"
              >
                {formatPaymentMethodLabel(payment.method)}{" "}
                {formatPriceBRL(payment.professionalShareCents)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DayTable({
  rows,
  maxDayCommission,
  buildDayHref,
  activeDate,
}: {
  rows: CommissionDayRow[];
  maxDayCommission: number;
  buildDayHref: (date: string) => string;
  activeDate?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Dia</th>
            <th className="px-4 py-3 font-medium text-right">Serviços</th>
            <th className="px-4 py-3 font-medium text-right">Faturamento</th>
            <th className="px-4 py-3 font-medium text-right">Comissão</th>
            <th className="px-4 py-3 font-medium text-right">Barbearia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isActive = activeDate === row.date;
            return (
              <tr
                key={row.date}
                className={cn(
                  "border-b last:border-b-0",
                  isActive && "bg-muted/30"
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={buildDayHref(row.date)}
                    className="group block font-medium"
                  >
                    <span className="group-hover:underline">
                      {formatDateBR(row.date)}
                    </span>
                    <div className="mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{
                          width: `${
                            maxDayCommission > 0
                              ? Math.round(
                                  (row.commissionCents / maxDayCommission) * 100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.serviceItemCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPriceBRL(row.servicesGrossCents - row.tipCents)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatPriceBRL(row.commissionCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatPriceBRL(row.shopCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type CommissionBarberDetailProps = {
  professional: CommissionProfessionalReport;
  from: string;
  to: string;
  buildDayHref: (date: string) => string;
  selfView?: boolean;
};

export function CommissionBarberDetail({
  professional,
  from,
  to,
  buildDayHref,
  selfView = false,
}: CommissionBarberDetailProps) {
  const isSingleDay = from === to;
  const dayRows = professional.byDay.filter((row) => row.serviceItemCount > 0);
  const activeDay = isSingleDay ? professional.byDay.find((d) => d.date === from) : null;
  const comandas = isSingleDay
    ? professional.comandas.filter((comanda) => comanda.serviceDate === from)
    : professional.comandas;

  const serviceRows = useMemo(() => {
    if (!isSingleDay) return professional.serviceBreakdown;

    const map = new Map<string, CommissionServiceBreakdownRow>();
    for (const comanda of comandas) {
      for (const item of comanda.items) {
        const key = `${item.isTip ? "tip" : "svc"}:${item.serviceName}`;
        const existing = map.get(key) ?? {
          serviceName: item.serviceName,
          isTip: item.isTip,
          quantity: 0,
          grossCents: 0,
          commissionCents: 0,
        };
        existing.quantity += 1;
        existing.grossCents += item.chargedPriceCents;
        existing.commissionCents += item.commissionCents;
        map.set(key, existing);
      }
    }
    return [...map.values()].sort((a, b) => b.grossCents - a.grossCents);
  }, [comandas, isSingleDay, professional.serviceBreakdown]);

  const maxDayCommission = Math.max(
    ...dayRows.map((day) => day.commissionCents),
    0
  );

  const paymentRows = professional.byPaymentMethod;
  const activePaymentMethods = PAYMENT_METHODS.filter(
    (method) => paymentRows[method] > 0
  );
  const paymentTotal = activePaymentMethods.reduce(
    (sum, method) => sum + paymentRows[method],
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border px-5 py-4">
        <p className="text-lg font-semibold">
          {professional.professionalNickname}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {professional.commissionPercent}% de comissão ·{" "}
          {formatPeriodLabel(from, to)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label={selfView ? "Sua comissão" : "Comissão a pagar"}
          value={formatPriceBRL(professional.summary.commissionCents)}
          hint="Repasse total no período"
        />
        <MetricCard
          label="Faturamento"
          value={formatPriceBRL(
            commissionServiceRevenueCents(professional.summary)
          )}
          hint={
            professional.summary.tipCents > 0
              ? `+ ${formatPriceBRL(professional.summary.tipCents)} em gorjetas`
              : "Só serviços, sem gorjeta"
          }
        />
        <MetricCard
          label="Ficou na barbearia"
          value={formatPriceBRL(professional.summary.shopCents)}
          hint="Sobre serviços, sem gorjetas"
        />
        <MetricCard
          label="Serviços"
          value={String(professional.summary.serviceItemCount)}
          hint="Cortes, barbas e demais serviços"
        />
        <MetricCard
          label="Gorjetas"
          value={formatPriceBRL(professional.summary.tipCents)}
          hint="100% para o barbeiro"
        />
        <MetricCard
          label="Comissão média"
          value={formatPriceBRL(
            professional.summary.serviceItemCount > 0
              ? Math.round(
                  professional.summary.commissionCents /
                    professional.summary.serviceItemCount
                )
              : 0
          )}
          hint="Por serviço realizado"
        />
      </div>

      {isSingleDay && activeDay && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">
              Resumo do dia · {formatDateBR(from)}
            </h2>
            <p className="text-xs text-muted-foreground">
              Faturamento, comissão e serviços deste dia
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Faturamento"
              value={formatPriceBRL(
                activeDay.servicesGrossCents - activeDay.tipCents
              )}
            />
            <MetricCard
              label="Comissão"
              value={formatPriceBRL(activeDay.commissionCents)}
            />
            <MetricCard
              label="Serviços"
              value={String(activeDay.serviceItemCount)}
            />
            <MetricCard
              label="Barbearia no dia"
              value={formatPriceBRL(activeDay.shopCents)}
            />
          </div>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href={`/admin?date=${from}`}>
              <CalendarDays className="size-4" />
              Ver agenda deste dia
            </Link>
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Scissors className="size-4" />
            Serviços realizados
          </h2>
          <p className="text-xs text-muted-foreground">
            {isSingleDay
              ? selfView
                ? "O que você fez neste dia, com quantidade e valores"
                : "O que ele fez neste dia, com quantidade e valores"
              : selfView
                ? "Seus serviços no período — quantidade, faturamento e comissão"
                : "Ranking no período — quantidade, faturamento e comissão"}
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ServiceBreakdownTable rows={serviceRows} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="size-4" />
            Por cliente
            {isSingleDay && ` · ${formatDateBR(from)}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            Cada card é um cliente finalizado — serviços, faturamento e comissão
          </p>
        </div>
        {comandas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente neste recorte.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {comandas.map((comanda) => (
              <AtendimentoCard key={comanda.comandaId} comanda={comanda} />
            ))}
          </div>
        )}
      </section>

      {!isSingleDay && dayRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">Dia a dia</h2>
            <p className="text-xs text-muted-foreground">
              Clique no dia para ver o detalhe completo
            </p>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <DayTable
                rows={dayRows}
                maxDayCommission={maxDayCommission}
                buildDayHref={buildDayHref}
              />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Pagamentos proporcionais</h2>
          <p className="text-xs text-muted-foreground">
            Parte dos recebimentos atribuída a este barbeiro no período
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            {activePaymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem dados de pagamento.
              </p>
            ) : (
              activePaymentMethods.map((method) => {
                const amount = paymentRows[method];
                const pct =
                  paymentTotal > 0
                    ? Math.round((amount / paymentTotal) * 100)
                    : 0;
                return (
                  <BarRow
                    key={method}
                    label={formatPaymentMethodLabel(method)}
                    value={amount}
                    max={paymentTotal}
                    suffix={`${pct}%`}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          A comissão é calculada sobre o valor do serviço. Os pagamentos acima
          são só para você cruzar com o caixa.
        </p>
      </section>
    </div>
  );
}
