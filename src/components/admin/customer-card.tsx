"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  MoreVertical,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDateBR, formatWhatsapp } from "@/lib/format";
import { deleteCustomer } from "@/app/admin/(panel)/clientes/actions";
import { cn } from "@/lib/utils";

type CustomerCardProps = {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    whatsapp: string;
    appointmentCount: number;
    lastVisitDate: string | null;
    memberSince: string;
  };
};

function customerInitials(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatMemberSince(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export function CustomerCard({ customer: c }: CustomerCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    const result = await deleteCustomer(c.id);
    if (result.ok) {
      toast.success("Cliente excluído.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmDelete(false);
    setBusy(false);
  }

  const fullName = `${c.firstName} ${c.lastName}`;
  const initials = customerInitials(c.firstName, c.lastName);
  const hasVisits = c.appointmentCount > 0;

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                hasVisits
                  ? "border-foreground/15 bg-foreground text-background"
                  : "border-muted-foreground/20 bg-muted text-muted-foreground"
              )}
            >
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{fullName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cliente desde {formatMemberSince(c.memberSince)}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ações"
                disabled={busy}
                className="shrink-0 opacity-70 group-hover:opacity-100"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => router.push(`/admin/clientes/${c.id}`)}
              >
                <Pencil />
                Ver e editar
              </DropdownMenuItem>
              {!hasVisits && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmDelete(true)}
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mx-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
          <Phone className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate tabular-nums">{formatWhatsapp(c.whatsapp)}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={hasVisits ? "secondary" : "outline"}
              className="gap-1 font-normal"
            >
              <CalendarDays className="size-3" />
              {hasVisits
                ? `${c.appointmentCount} visita${c.appointmentCount === 1 ? "" : "s"}`
                : "Sem visitas"}
            </Badge>
            {c.lastVisitDate && (
              <span className="text-xs text-muted-foreground">
                Última: {formatDateBR(c.lastVisitDate)}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            asChild
          >
            <Link href={`/admin/clientes/${c.id}`}>
              Ver ficha
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 border-b px-6 py-6 pr-12 text-left">
            <DialogTitle className="text-lg font-semibold">
              Excluir {fullName}?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Só é possível excluir clientes sem agendamentos no histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">{fullName}</p>
              <p className="mt-1 text-muted-foreground">
                {formatWhatsapp(c.whatsapp)}
              </p>
            </div>
          </div>

          <DialogFooter className="-mx-0 -mb-0 flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-5 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? "Excluindo..." : "Excluir cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
