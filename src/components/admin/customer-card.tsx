"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MoreVertical,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
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
import { deleteCustomer } from "@/app/admin/(panel)/clientes/actions";

type CustomerCardProps = {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    whatsapp: string;
    appointmentCount: number;
  };
};

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

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border bg-muted">
              <User className="size-6 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{fullName}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3" />
                {c.appointmentCount === 0
                  ? "Sem agendamentos"
                  : `${c.appointmentCount} agendamento${c.appointmentCount === 1 ? "" : "s"}`}
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
                onSelect={() => router.push(`/admin/clientes/${c.id}`)}
              >
                <Pencil />
                Ver e editar
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

        <div className="mt-auto text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" />
            {formatWhatsapp(c.whatsapp)}
          </span>
        </div>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {fullName}?</DialogTitle>
            <DialogDescription>
              Só é possível excluir clientes sem agendamentos no histórico. Se
              houver visitas registradas, edite os dados em vez de excluir.
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
