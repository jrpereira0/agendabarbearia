"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CatalogStatusDot } from "@/components/admin/catalog-list";
import { formatDateBR, formatWhatsapp } from "@/lib/format";
import { deleteCustomer } from "@/app/admin/(panel)/clientes/actions";
import { cn } from "@/lib/utils";

export type CustomerListItem = {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  appointmentCount: number;
  lastVisitDate: string | null;
  memberSince: string;
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

function CustomerAvatar({ customer }: { customer: CustomerListItem }) {
  const hasVisits = customer.appointmentCount > 0;
  const initials = customerInitials(customer.firstName, customer.lastName);

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        hasVisits
          ? "border-foreground/15 bg-foreground text-background"
          : "border-muted-foreground/20 bg-muted text-muted-foreground"
      )}
    >
      {initials || "?"}
    </div>
  );
}

function visitSummary(customer: CustomerListItem): string {
  if (customer.appointmentCount === 0) return "Sem visitas";
  const visits = `${customer.appointmentCount} visita${customer.appointmentCount === 1 ? "" : "s"}`;
  if (!customer.lastVisitDate) return visits;
  return `${visits} · ${formatDateBR(customer.lastVisitDate)}`;
}

function CustomerActionsMenu({
  customer,
  onDelete,
}: {
  customer: CustomerListItem;
  onDelete: () => void;
}) {
  const router = useRouter();
  const hasVisits = customer.appointmentCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Ações">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => router.push(`/admin/clientes/${customer.id}`)}
        >
          <Pencil />
          Ver e editar
        </DropdownMenuItem>
        {!hasVisits ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CustomerListRow({ customer }: { customer: CustomerListItem }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const hasVisits = customer.appointmentCount > 0;

  async function handleDelete() {
    setBusy(true);
    const result = await deleteCustomer(customer.id);
    if (result.ok) {
      toast.success("Cliente excluído.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmDelete(false);
    setBusy(false);
  }

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-muted/40"
        onClick={() => router.push(`/admin/clientes/${customer.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar customer={customer} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={hasVisits} />
                <span className="truncate font-medium">{fullName}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Cliente desde {formatMemberSince(customer.memberSince)}
              </p>
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 tabular-nums text-muted-foreground md:table-cell">
          {formatWhatsapp(customer.whatsapp)}
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
          {visitSummary(customer)}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <CustomerActionsMenu
            customer={customer}
            onDelete={() => setConfirmDelete(true)}
          />
        </td>
      </tr>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {fullName}?</DialogTitle>
            <DialogDescription>
              Só é possível excluir clientes sem agendamentos no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CustomerMobileCard({ customer }: { customer: CustomerListItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const hasVisits = customer.appointmentCount > 0;

  async function handleDelete() {
    setBusy(true);
    const result = await deleteCustomer(customer.id);
    if (result.ok) {
      toast.success("Cliente excluído.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmDelete(false);
    setBusy(false);
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <Link
          href={`/admin/clientes/${customer.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <CustomerAvatar customer={customer} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={hasVisits} />
              <p className="truncate font-medium">{fullName}</p>
            </div>
            <p className="mt-1 truncate text-sm tabular-nums text-muted-foreground">
              {formatWhatsapp(customer.whatsapp)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {visitSummary(customer)}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <div onClick={(event) => event.stopPropagation()}>
          <CustomerActionsMenu
            customer={customer}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {fullName}?</DialogTitle>
            <DialogDescription>
              Só é possível excluir clientes sem agendamentos no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
