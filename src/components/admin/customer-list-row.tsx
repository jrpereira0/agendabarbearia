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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
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

type Tone = "default" | "dark";

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

function CustomerAvatar({
  customer,
  tone = "default",
}: {
  customer: CustomerListItem;
  tone?: Tone;
}) {
  const hasVisits = customer.appointmentCount > 0;
  const initials = customerInitials(customer.firstName, customer.lastName);
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        dark
          ? hasVisits
            ? "border-[#ecf15e]/30 bg-[#ecf15e] text-[#0e0f11]"
            : "border-white/10 bg-[#1a1b1e] text-[#b4b6bb]"
          : hasVisits
            ? "border-foreground/15 bg-foreground text-background"
            : "border-muted-foreground/20 bg-muted text-muted-foreground"
      )}
    >
      {initials || "?"}
    </div>
  );
}

function VisitsCell({
  customer,
  tone = "default",
  compact = false,
}: {
  customer: CustomerListItem;
  tone?: Tone;
  compact?: boolean;
}) {
  const dark = tone === "dark";
  const count = customer.appointmentCount;

  if (count === 0) {
    return (
      <span
        className={cn(
          compact ? "text-xs" : "text-sm",
          dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
        )}
      >
        Sem visitas
      </span>
    );
  }

  const label = `${count} visita${count === 1 ? "" : "s"}`;

  if (compact) {
    return (
      <span
        className={cn(
          "text-xs",
          dark ? "text-[#d4d5d8]" : "text-muted-foreground"
        )}
      >
        {label}
        {customer.lastVisitDate ? (
          <>
            {" · "}
            <span className={dark ? ADMIN_SURFACE.muted : undefined}>
              {formatDateBR(customer.lastVisitDate)}
            </span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <p
        className={cn(
          "text-sm font-medium tabular-nums",
          dark ? "text-[#f5f5f5]" : "text-foreground"
        )}
      >
        {label}
      </p>
      {customer.lastVisitDate ? (
        <p
          className={cn(
            "mt-0.5 truncate text-xs",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          Última em {formatDateBR(customer.lastVisitDate)}
        </p>
      ) : null}
    </div>
  );
}

function CustomerActionsMenu({
  customer,
  onDelete,
  tone = "default",
}: {
  customer: CustomerListItem;
  onDelete: () => void;
  tone?: Tone;
}) {
  const router = useRouter();
  const hasVisits = customer.appointmentCount > 0;
  const dark = tone === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ações"
          className={cn(
            dark && "text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
          )}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(dark && ADMIN_SURFACE.popover)}
      >
        <DropdownMenuItem
          onSelect={() => router.push(`/admin/clientes/${customer.id}`)}
        >
          <Pencil />
          Ver e editar
        </DropdownMenuItem>
        {!hasVisits ? (
          <>
            <DropdownMenuSeparator className={cn(dark && "bg-white/10")} />
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

function DeleteCustomerDialog({
  open,
  onOpenChange,
  fullName,
  busy,
  onConfirm,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  busy: boolean;
  onConfirm: () => void;
  tone?: Tone;
}) {
  const dark = tone === "dark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          dark &&
            "border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn(dark && "text-[#f5f5f5]")}>
            Excluir {fullName}?
          </DialogTitle>
          <DialogDescription className={cn(dark && ADMIN_SURFACE.muted)}>
            Só é possível excluir clientes sem agendamentos no histórico.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={cn(dark && ADMIN_SURFACE.btnGhost)}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerListRow({
  customer,
  tone = "default",
}: {
  customer: CustomerListItem;
  tone?: Tone;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const hasVisits = customer.appointmentCount > 0;
  const dark = tone === "dark";

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
        className={cn(
          "cursor-pointer transition-colors",
          dark ? "hover:bg-white/[0.04]" : "hover:bg-muted/40"
        )}
        onClick={() => router.push(`/admin/clientes/${customer.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar customer={customer} tone={tone} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={hasVisits} />
                <span
                  className={cn(
                    "truncate font-medium",
                    dark && "text-[#f5f5f5]"
                  )}
                >
                  {fullName}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                Cliente desde {formatMemberSince(customer.memberSince)}
              </p>
            </div>
          </div>
        </td>
        <td
          className={cn(
            "hidden px-4 py-3 tabular-nums md:table-cell",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {formatWhatsapp(customer.whatsapp)}
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <VisitsCell customer={customer} tone={tone} />
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <CustomerActionsMenu
            customer={customer}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </td>
      </tr>

      <DeleteCustomerDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        fullName={fullName}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}

export function CustomerMobileCard({
  customer,
  tone = "default",
  embedded = false,
}: {
  customer: CustomerListItem;
  tone?: Tone;
  embedded?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const hasVisits = customer.appointmentCount > 0;
  const dark = tone === "dark";

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
      <div
        className={cn(
          "flex items-center gap-3",
          embedded
            ? "px-4 py-3.5"
            : cn(
                "rounded-lg border p-4",
                dark
                  ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
                  : "bg-card shadow-sm"
              )
        )}
      >
        <Link
          href={`/admin/clientes/${customer.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <CustomerAvatar customer={customer} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={hasVisits} />
              <p
                className={cn(
                  "truncate text-[15px] font-medium tracking-tight",
                  dark && "text-[#f5f5f5]"
                )}
              >
                {fullName}
              </p>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-xs",
                dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
              )}
            >
              <span className="tabular-nums">
                {formatWhatsapp(customer.whatsapp)}
              </span>
              {" · "}
              <VisitsCell customer={customer} tone={tone} compact />
            </p>
          </div>
          <ChevronRight
            className={cn(
              "size-4 shrink-0",
              dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
            )}
          />
        </Link>
        <div onClick={(event) => event.stopPropagation()}>
          <CustomerActionsMenu
            customer={customer}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </div>
      </div>

      <DeleteCustomerDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        fullName={fullName}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}
