"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  Lock,
  Plus,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import {
  closeCashRegisterAction,
} from "@/app/admin/(panel)/financeiro/actions";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import { formatDateBR, formatDateTimeBR, formatPriceBRL } from "@/lib/format";
import { matchesSearch } from "@/lib/text";

type CashRegisterHistoryViewProps = {
  from: string;
  to: string;
  today: string;
  sessions: CashRegisterSession[];
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CashRegisterHistoryView({
  from,
  to,
  today,
  sessions,
  openCashRegister,
  responsibleOptions,
}: CashRegisterHistoryViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [search, setSearch] = useState("");
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [dialogSession, setDialogSession] = useState<CashRegisterSession | null>(
    null
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    return sessions.filter((session) =>
      matchesSearch(
        [
          formatDateBR(session.serviceDate),
          session.status === "open" ? "aberto" : "fechado",
          session.openedByName ?? "",
          session.responsibleName ?? "",
          session.closedByName ?? "",
        ].join(" "),
        search
      )
    );
  }, [sessions, search]);

  const periodTotalCents = useMemo(
    () => filtered.reduce((sum, row) => sum + row.totalCents, 0),
    [filtered]
  );

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      `/admin/financeiro/caixas?from=${fromDate}&to=${toDate}`
    );
  }

  async function runClose(serviceDate: string) {
    setBusyDate(serviceDate);
    const result = await closeCashRegisterAction(serviceDate);
    setBusyDate(null);

    if (result.ok) {
      toast.success("Caixa fechado.");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

  function startOpenCash(
    serviceDate: string,
    mode: "open" | "reopen",
    session?: CashRegisterSession
  ) {
    setDialogDate(serviceDate);
    setDialogSession(session ?? null);
    setOpenMode(mode);
    setOpenDialog(true);
  }

  const defaultResponsibleId = dialogSession
    ? responsibleOptions.find(
        (option) => option.label === dialogSession.responsibleName
      )?.id
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico de caixas"
        description="Abra e feche o caixa por dia. Só é possível finalizar comandas com o caixa aberto."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(openCashRegister)}
              onClick={() => startOpenCash(today, "open")}
            >
              <Plus className="size-4" />
              Abrir caixa
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/financeiro">Caixa do dia</Link>
            </Button>
          </div>
        }
      />

      {openCashRegister && (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm">
          Caixa aberto:{" "}
          <Link
            href={`/admin/financeiro?date=${openCashRegister.serviceDate}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {formatDateBR(openCashRegister.serviceDate)}
          </Link>
          {openCashRegister.responsibleName && (
            <> · {openCashRegister.responsibleName}</>
          )}
          . Feche este caixa antes de abrir outro.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={applyFilter}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
          >
            <div className="space-y-2">
              <Label htmlFor="from-date">Data inicial</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">Data final</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full sm:w-auto">
                Pesquisar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por data ou responsável…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Card className="w-full sm:w-auto">
          <CardContent className="flex items-center justify-between gap-6 py-3">
            <span className="text-sm text-muted-foreground">Total no período</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatPriceBRL(periodTotalCents)}
            </span>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum caixa neste período"
          description="Abra o caixa do dia em Financeiro ou ajuste o intervalo de datas."
          action={
            <Button
              type="button"
              size="sm"
              disabled={Boolean(openCashRegister)}
              onClick={() => startOpenCash(today, "open")}
            >
              <Plus className="size-4" />
              Abrir caixa
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2.5 font-medium">Dia do caixa</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium text-right">Saldo</th>
                <th className="px-3 py-2.5 font-medium text-right">Inicial</th>
                <th className="px-3 py-2.5 font-medium">Aberto em</th>
                <th className="px-3 py-2.5 font-medium">Fechado em</th>
                <th className="px-3 py-2.5 font-medium">Responsável</th>
                <th className="px-3 py-2.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => {
                const isOpen = session.status === "open";
                const busy = busyDate === session.serviceDate || pending;
                const operator =
                  session.responsibleName ??
                  session.openedByName ??
                  session.closedByName ??
                  "—";

                return (
                  <tr key={session.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDateBR(session.serviceDate)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={isOpen ? "default" : "secondary"}>
                        {isOpen ? "Aberto" : "Fechado"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatPriceBRL(session.totalCents)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatPriceBRL(session.openingBalanceCents)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {session.openedAt
                        ? formatDateTimeBR(session.openedAt)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {session.closedAt
                        ? formatDateTimeBR(session.closedAt)
                        : "—"}
                    </td>
                    <td className="px-3 py-3">{operator}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          asChild
                        >
                          <Link
                            href={`/admin/financeiro?date=${session.serviceDate}`}
                          >
                            <Eye className="size-3.5" />
                            Ver dia
                          </Link>
                        </Button>
                        {isOpen ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={busy}
                            onClick={() => void runClose(session.serviceDate)}
                          >
                            <Lock className="size-3.5" />
                            Fechar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={busy || Boolean(openCashRegister)}
                            onClick={() =>
                              startOpenCash(session.serviceDate, "reopen", session)
                            }
                          >
                            <RotateCcw className="size-3.5" />
                            Reabrir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} caixa{filtered.length === 1 ? "" : "s"} no período de{" "}
        {formatDateBR(from)} a {formatDateBR(to)}
      </p>

      <OpenCashRegisterDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        serviceDate={dialogDate ?? today}
        today={today}
        mode={openMode}
        lockServiceDate={openMode === "reopen"}
        responsibleOptions={responsibleOptions}
        defaultResponsibleId={defaultResponsibleId}
        defaultOpeningBalanceCents={dialogSession?.openingBalanceCents ?? 0}
        onSuccess={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}
