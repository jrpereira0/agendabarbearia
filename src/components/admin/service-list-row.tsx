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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
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
  photoPosition?: string | null;
  active: boolean;
  professionalNames: string[];
};

type Tone = "default" | "dark";

function servicePriceLabel(service: ServiceListItem): string {
  return formatServiceCatalogPriceLabel(
    service.priceCents,
    service.weekdayPrices,
    service.priceFrom
  );
}

function servicePriceLines(service: ServiceListItem): string[] {
  return servicePriceLabel(service)
    .split(" · ")
    .map((line) => line.trim())
    .filter(Boolean);
}

function teamLabel(names: string[]): string {
  if (names.length === 0) return "Sem equipe";
  if (names.length === 1) return names[0];
  return `${names.length} profissionais`;
}

function ServiceThumb({
  service,
  tone = "default",
}: {
  service: ServiceListItem;
  tone?: Tone;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border",
        dark ? "border-white/10 bg-[#1a1b1e]" : "bg-muted"
      )}
    >
      {service.photoUrl ? (
        <Image
          src={service.photoUrl}
          alt={service.name}
          fill
          className="object-cover"
          style={{ objectPosition: service.photoPosition ?? "50% 50%" }}
          unoptimized
        />
      ) : (
        <Scissors
          className={cn(
            "size-4",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        />
      )}
    </div>
  );
}

function ServiceActionsMenu({
  service,
  onDelete,
  tone = "default",
}: {
  service: ServiceListItem;
  onDelete: () => void;
  tone?: Tone;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";

  async function handleToggleActive() {
    setBusy(true);
    const result = await setServiceActive(service.id, !service.active);
    if (result.ok) {
      toast.success(
        service.active ? "Serviço desativado." : "Serviço ativado."
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ações"
          disabled={busy}
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
          onSelect={() => router.push(`/admin/servicos/${service.id}`)}
        >
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {service.active ? <CircleOff /> : <CircleCheck />}
          {service.active ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator className={cn(dark && "bg-white/10")} />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
  busy,
  onConfirm,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceListItem;
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
            Excluir {service.name}?
          </DialogTitle>
          <DialogDescription className={cn(dark && ADMIN_SURFACE.muted)}>
            Isso remove o serviço da agenda. Prefira desativar se for
            temporário.
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

export function ServiceListRow({
  service,
  tone = "default",
}: {
  service: ServiceListItem;
  tone?: Tone;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";
  const priceLines = servicePriceLines(service);
  const team = teamLabel(service.professionalNames);

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
          "cursor-pointer transition-colors",
          dark ? "hover:bg-white/[0.04]" : "hover:bg-muted/40",
          !service.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/servicos/${service.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ServiceThumb service={service} tone={tone} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <CatalogStatusDot active={service.active} />
                <span
                  className={cn(
                    "truncate font-medium",
                    dark && "text-[#f5f5f5]"
                  )}
                >
                  {service.name}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                {formatDuration(service.durationMinutes)}
                {service.description ? ` · ${service.description}` : null}
              </p>
            </div>
          </div>
        </td>
        <td
          className={cn(
            "hidden px-4 py-3 md:table-cell",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          <span className="truncate" title={service.professionalNames.join(", ")}>
            {team}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex flex-col items-end gap-0.5">
            {priceLines.map((line) => (
              <span
                key={line}
                className={cn(
                  "tabular-nums text-sm font-medium",
                  dark ? "text-[#f5f5f5]" : "text-foreground"
                )}
              >
                {line}
              </span>
            ))}
          </div>
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ServiceActionsMenu
            service={service}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </td>
      </tr>

      <DeleteServiceDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        service={service}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}

export function ServiceMobileCard({
  service,
  tone = "default",
  embedded = false,
}: {
  service: ServiceListItem;
  tone?: Tone;
  embedded?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dark = tone === "dark";

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
          "flex items-center gap-3",
          embedded
            ? "px-4 py-3.5"
            : cn(
                "rounded-lg border p-4",
                dark
                  ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
                  : "bg-card shadow-sm"
              ),
          !service.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/servicos/${service.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ServiceThumb service={service} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={service.active} />
              <p
                className={cn(
                  "truncate text-[15px] font-medium tracking-tight",
                  dark && "text-[#f5f5f5]"
                )}
              >
                {service.name}
              </p>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-xs",
                dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
              )}
            >
              <span className="tabular-nums">{servicePriceLabel(service)}</span>
              {" · "}
              {formatDuration(service.durationMinutes)}
              {" · "}
              {teamLabel(service.professionalNames)}
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
          <ServiceActionsMenu
            service={service}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </div>
      </div>

      <DeleteServiceDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        service={service}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}
