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
import { cn } from "@/lib/utils";

export type ProfessionalListItem = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  whatsapp: string;
  instagram: string | null;
  photoUrl: string | null;
  active: boolean;
  serviceNames: string[];
};

function ProfessionalThumb({ professional }: { professional: ProfessionalListItem }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
      {professional.photoUrl ? (
        <Image
          src={professional.photoUrl}
          alt={professional.nickname}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <User className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ProfessionalActionsMenu({
  professional,
  onDelete,
}: {
  professional: ProfessionalListItem;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    const result = await setProfessionalActive(professional.id, !professional.active);
    if (result.ok) {
      toast.success(
        professional.active ? "Profissional desativado." : "Profissional ativado."
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
        <Button variant="ghost" size="icon-sm" aria-label="Ações" disabled={busy}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => router.push(`/admin/profissionais/${professional.id}`)}
        >
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {professional.active ? <CircleOff /> : <CircleCheck />}
          {professional.active ? "Desativar" : "Ativar"}
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

export function ProfessionalListRow({
  professional,
}: {
  professional: ProfessionalListItem;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

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
          "cursor-pointer transition-colors hover:bg-muted/40",
          !professional.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/profissionais/${professional.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProfessionalThumb professional={professional} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={professional.active} />
                <span className="truncate font-medium">{professional.nickname}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {professional.firstName} {professional.lastName}
              </p>
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 tabular-nums text-muted-foreground md:table-cell">
          {formatWhatsapp(professional.whatsapp)}
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
          {services}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ProfessionalActionsMenu
            professional={professional}
            onDelete={() => setConfirmDelete(true)}
          />
        </td>
      </tr>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {professional.nickname}?</DialogTitle>
            <DialogDescription>
              Isso apaga o cadastro e o acesso ao sistema. Prefira desativar.
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

export function ProfessionalMobileCard({
  professional,
}: {
  professional: ProfessionalListItem;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
          "flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm",
          !professional.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/profissionais/${professional.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ProfessionalThumb professional={professional} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={professional.active} />
              <p className="truncate font-medium">{professional.nickname}</p>
            </div>
            <p className="mt-1 truncate text-sm tabular-nums text-muted-foreground">
              {formatWhatsapp(professional.whatsapp)}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <div onClick={(event) => event.stopPropagation()}>
          <ProfessionalActionsMenu
            professional={professional}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {professional.nickname}?</DialogTitle>
            <DialogDescription>
              Isso apaga o cadastro e o acesso ao sistema. Prefira desativar.
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
