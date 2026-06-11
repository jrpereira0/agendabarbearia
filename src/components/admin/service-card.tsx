"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  CircleCheck,
  CircleOff,
  Clock,
  MoreVertical,
  Pencil,
  Scissors,
  Trash2,
  Users,
} from "lucide-react";
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
import { formatDuration, formatPriceBRL } from "@/lib/format";
import {
  deleteService,
  setServiceActive,
} from "@/app/admin/(panel)/servicos/actions";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    durationMinutes: number;
    photoUrl: string | null;
    active: boolean;
    professionalNames: string[];
  };
};

export function ServiceCard({ service: s }: ServiceCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    const result = await setServiceActive(s.id, !s.active);
    if (result.ok) {
      toast.success(s.active ? "Serviço desativado." : "Serviço ativado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteService(s.id);
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
    <Card className={`transition-opacity ${s.active ? "" : "opacity-55"}`}>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {s.photoUrl ? (
                <Image
                  src={s.photoUrl}
                  alt={s.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <Scissors className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{s.name}</p>
              <span
                className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                  s.active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    s.active ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                />
                {s.active ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ações"
                disabled={busy}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => router.push(`/admin/servicos/${s.id}`)}
              >
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleToggleActive}>
                {s.active ? <CircleOff /> : <CircleCheck />}
                {s.active ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {s.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {s.description}
          </p>
        )}

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-3.5 shrink-0" />
          {s.professionalNames.length > 0 ? (
            <span className="truncate">{s.professionalNames.join(" · ")}</span>
          ) : (
            <span className="text-destructive/80">
              Nenhum profissional faz esse serviço
            </span>
          )}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-medium">
            {formatPriceBRL(s.priceCents)}
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <Clock className="size-3" />
            {formatDuration(s.durationMinutes)}
          </Badge>
        </div>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {s.name}?</DialogTitle>
            <DialogDescription>
              Isso remove o serviço da agenda. Essa ação não pode ser desfeita.
              Se for algo temporário, prefira desativar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
