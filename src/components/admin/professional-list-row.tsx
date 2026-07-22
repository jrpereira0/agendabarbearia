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
  Trash2,
  User,
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
import { formatWhatsapp } from "@/lib/format";
import {
  deleteProfessional,
  setProfessionalActive,
} from "@/app/admin/(panel)/profissionais/actions";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type ProfessionalListItem = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  whatsapp: string;
  instagram: string | null;
  photoUrl: string | null;
  photoPosition?: string | null;
  active: boolean;
  serviceNames: string[];
};

type Tone = "default" | "dark";

function ProfessionalThumb({
  professional,
  tone = "default",
}: {
  professional: ProfessionalListItem;
  tone?: Tone;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border",
        dark ? "border-white/10 bg-[#1a1b1e]" : "bg-muted"
      )}
    >
      {professional.photoUrl ? (
        <Image
          src={professional.photoUrl}
          alt={professional.nickname}
          fill
          className="object-cover"
          style={{
            objectPosition: professional.photoPosition ?? "50% 50%",
          }}
          unoptimized
        />
      ) : (
        <User
          className={cn(
            "size-4",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        />
      )}
    </div>
  );
}

function ProfessionalActionsMenu({
  professional,
  onDelete,
  tone = "default",
}: {
  professional: ProfessionalListItem;
  onDelete: () => void;
  tone?: Tone;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";

  async function handleToggleActive() {
    setBusy(true);
    const result = await setProfessionalActive(
      professional.id,
      !professional.active
    );
    if (result.ok) {
      toast.success(
        professional.active
          ? "Profissional desativado."
          : "Profissional ativado."
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
            dark &&
              "text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
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
          onSelect={() =>
            router.push(`/admin/profissionais/${professional.id}`)
          }
        >
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {professional.active ? <CircleOff /> : <CircleCheck />}
          {professional.active ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator
          className={cn(dark && "bg-white/10")}
        />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteProfessionalDialog({
  open,
  onOpenChange,
  professional,
  busy,
  onConfirm,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: ProfessionalListItem;
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
            Excluir {professional.nickname}?
          </DialogTitle>
          <DialogDescription className={cn(dark && ADMIN_SURFACE.muted)}>
            Isso apaga o cadastro e o acesso ao sistema. Prefira desativar.
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
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfessionalListRow({
  professional,
  tone = "default",
}: {
  professional: ProfessionalListItem;
  tone?: Tone;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";

  const services =
    professional.serviceNames.length > 0
      ? `${professional.serviceNames.length} serviço${professional.serviceNames.length === 1 ? "" : "s"}`
      : "Sem serviços";

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProfessional(professional.id);
    if (result.ok) {
      toast.success("Profissional excluído.");
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
          !professional.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/profissionais/${professional.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProfessionalThumb professional={professional} tone={tone} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={professional.active} />
                <span
                  className={cn(
                    "truncate font-medium",
                    dark && "text-[#f5f5f5]"
                  )}
                >
                  {professional.nickname}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                {professional.firstName} {professional.lastName}
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
          {formatWhatsapp(professional.whatsapp)}
        </td>
        <td
          className={cn(
            "hidden px-4 py-3 lg:table-cell",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {services}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ProfessionalActionsMenu
            professional={professional}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </td>
      </tr>

      <DeleteProfessionalDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        professional={professional}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}

export function ProfessionalMobileCard({
  professional,
  tone = "default",
}: {
  professional: ProfessionalListItem;
  tone?: Tone;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dark = tone === "dark";

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProfessional(professional.id);
    if (result.ok) {
      toast.success("Profissional excluído.");
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
          "flex items-center gap-3 rounded-lg border p-4",
          dark
            ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
            : "bg-card shadow-sm",
          !professional.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/profissionais/${professional.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ProfessionalThumb professional={professional} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={professional.active} />
              <p
                className={cn(
                  "truncate font-medium",
                  dark && "text-[#f5f5f5]"
                )}
              >
                {professional.nickname}
              </p>
            </div>
            <p
              className={cn(
                "mt-1 truncate text-sm tabular-nums",
                dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
              )}
            >
              {formatWhatsapp(professional.whatsapp)}
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
          <ProfessionalActionsMenu
            professional={professional}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </div>
      </div>

      <DeleteProfessionalDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        professional={professional}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}
