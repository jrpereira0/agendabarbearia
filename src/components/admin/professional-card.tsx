"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  AtSign,
  CircleCheck,
  CircleOff,
  MoreVertical,
  Pencil,
  Phone,
  Trash2,
  User,
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
import { formatWhatsapp } from "@/lib/format";
import {
  deleteProfessional,
  setProfessionalActive,
} from "@/app/admin/(panel)/profissionais/actions";

type ProfessionalCardProps = {
  professional: {
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
};

const MAX_VISIBLE_SERVICES = 3;

export function ProfessionalCard({ professional: p }: ProfessionalCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    const result = await setProfessionalActive(p.id, !p.active);
    if (result.ok) {
      toast.success(
        p.active ? "Profissional desativado." : "Profissional ativado."
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProfessional(p.id);
    if (result.ok) {
      toast.success("Profissional excluído.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmDelete(false);
    setBusy(false);
  }

  const visibleServices = p.serviceNames.slice(0, MAX_VISIBLE_SERVICES);
  const hiddenCount = p.serviceNames.length - visibleServices.length;

  return (
    <Card className={`transition-opacity ${p.active ? "" : "opacity-55"}`}>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
              {p.photoUrl ? (
                <Image
                  src={p.photoUrl}
                  alt={p.nickname}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <User className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">
                {p.nickname}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {p.firstName} {p.lastName}
              </p>
              <span
                className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                  p.active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    p.active ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                />
                {p.active ? "Ativo" : "Inativo"}
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
                onSelect={() => router.push(`/admin/profissionais/${p.id}`)}
              >
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleToggleActive}>
                {p.active ? <CircleOff /> : <CircleCheck />}
                {p.active ? "Desativar" : "Ativar"}
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

        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" />
            {formatWhatsapp(p.whatsapp)}
          </span>
          {p.instagram && (
            <span className="flex items-center gap-2">
              <AtSign className="size-3.5 shrink-0" />
              {p.instagram}
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5">
          {p.serviceNames.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Nenhum serviço vinculado
            </span>
          ) : (
            <>
              {visibleServices.map((name) => (
                <Badge key={name} variant="outline" className="font-normal">
                  {name}
                </Badge>
              ))}
              {hiddenCount > 0 && (
                <Badge variant="secondary" className="font-normal">
                  +{hiddenCount}
                </Badge>
              )}
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {p.nickname}?</DialogTitle>
            <DialogDescription>
              Isso apaga o cadastro e o acesso dele ao sistema. Essa ação não
              pode ser desfeita. Se ele só saiu da equipe, prefira desativar.
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
