"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createProductCategory,
  deleteProductCategory,
  setProductCategoryActive,
  updateProductCategory,
} from "@/app/admin/(panel)/produtos/actions";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

export function ProductCategoriesManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("sortOrder", sortOrder);
    const result = await createProductCategory(formData);
    if (result.ok) {
      toast.success("Categoria criada.");
      setName("");
      setSortOrder("0");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleUpdate() {
    if (!editing) return;
    setBusy(true);
    const formData = new FormData();
    formData.set("name", editing.name);
    formData.set("sortOrder", String(editing.sortOrder));
    const result = await updateProductCategory(editing.id, formData);
    if (result.ok) {
      toast.success("Categoria atualizada.");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleToggleActive(category: Category) {
    setBusy(true);
    const result = await setProductCategoryActive(category.id, !category.active);
    if (result.ok) {
      toast.success(category.active ? "Categoria desativada." : "Categoria ativada.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteProductCategory(deleteTarget.id);
    if (result.ok) {
      toast.success("Categoria excluída.");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nova categoria</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Geladeira"
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-sort">Ordem</Label>
              <Input
                id="category-sort"
                inputMode="numeric"
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value.replace(/\D/g, ""))
                }
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {categories.map((category) => (
          <Card key={category.id} className={category.active ? "" : "opacity-55"}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium">{category.name}</p>
                <p className="text-sm text-muted-foreground">
                  Ordem {category.sortOrder} · {category.productCount} produto
                  {category.productCount === 1 ? "" : "s"}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={busy}>
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(category)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleToggleActive(category)}>
                    {category.active ? "Desativar" : "Ativar"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget(category)}
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="edit-category-name">Nome</Label>
                <Input
                  id="edit-category-name"
                  value={editing.name}
                  onChange={(event) =>
                    setEditing({ ...editing, name: event.target.value })
                  }
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category-sort">Ordem</Label>
                <Input
                  id="edit-category-sort"
                  inputMode="numeric"
                  value={String(editing.sortOrder)}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      sortOrder: Number.parseInt(
                        event.target.value.replace(/\D/g, "") || "0",
                        10
                      ),
                    })
                  }
                  disabled={busy}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={busy || !editing}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              Só é possível excluir categorias sem produtos cadastrados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
