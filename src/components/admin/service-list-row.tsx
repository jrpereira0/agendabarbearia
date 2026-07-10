"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  CircleCheck,
  CircleOff,
  MoreVertical,
  Pencil,
  Scissors,
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
import { formatDuration } from "@/lib/format";
import { formatServiceCatalogPriceLabel } from "@/lib/public-service-prices";
import type { ServiceWeekdayPrice } from "@/lib/service-weekday-prices";
import {
  deleteService,
  setServiceActive,
} from "@/app/admin/(panel)/servicos/actions";
import { cn } from "@/lib/utils";

export type ServiceListItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  priceFrom: boolean;
  weekdayPrices: ServiceWeekdayPrice[];
  durationMinutes: number;
  photoUrl: string | null;
  active: boolean;
  professionalNames: string[];
};

function servicePriceLabel(service: ServiceListItem): string {
  return formatServiceCatalogPriceLabel(
    service.priceCents,
    service.weekdayPrices,
    service.priceFrom
  );
}

function ServiceThumb({ service }: { service: ServiceListItem }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {service.photoUrl ? (
        <Image
          src={service.photoUrl}
          alt={service.name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <Scissors className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ServiceActionsMenu({
  service,
  onDelete,
}: {
  service: ServiceListItem;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    const result = await setServiceActive(service.id, !service.active);
    if (result.ok) {
      toast.success(service.active ? "Serviço desativado." : "Serviço ativado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Ações" disabled={busy}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/admin/servicos/${service.id}`)}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {service.active ? <CircleOff /> : <CircleCheck />}
          {service.active ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ServiceListRow({ service }: { service: ServiceListItem }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const professionals =
    service.professionalNames.length > 0
      ? service.professionalNames.join(", ")
      : "Nenhum profissional";

  async function handleDelete() {
    setBusy(true);
    const result = await deleteService(service.id);
    if (result.ok) {
      toast.success("Serviço excluído.");
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
          "cursor-pointer transition-colors hover:bg-muted/40",
          !service.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/servicos/${service.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ServiceThumb service={service} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={service.active} />
                <span className="truncate font-medium">{service.name}</span>
              </div>
              {service.description ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {service.description}
                </p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
          <span className="line-clamp-2">{professionals}</span>
        </td>
        <td className="px-4 py-3 text-right font-medium">
          <span className="tabular-nums">{servicePriceLabel(service)}</span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
          {formatDuration(service.durationMinutes)}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ServiceActionsMenu service={service} onDelete={() => setConfirmDelete(true)} />
        </td>
      </tr>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {service.name}?</DialogTitle>
            <DialogDescription>
              Isso remove o serviço da agenda. Prefira desativar se for temporário.
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

export function ServiceMobileCard({ service }: { service: ServiceListItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setBusy(true);
    const result = await deleteService(service.id);
    if (result.ok) {
      toast.success("Serviço excluído.");
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
          "flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm",
          !service.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/servicos/${service.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ServiceThumb service={service} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={service.active} />
              <p className="truncate font-medium">{service.name}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{servicePriceLabel(service)}</span>
              {" · "}
              {formatDuration(service.durationMinutes)}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <div onClick={(event) => event.stopPropagation()}>
          <ServiceActionsMenu service={service} onDelete={() => setConfirmDelete(true)} />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {service.name}?</DialogTitle>
            <DialogDescription>
              Isso remove o serviço da agenda. Prefira desativar se for temporário.
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
