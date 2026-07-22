"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Pencil, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FormSectionTitle } from "@/components/admin/form-section";
import {
  createProductCategory,
  deleteProductCategory,
  setProductCategoryActive,
  updateProductCategory,
} from "@/app/admin/(panel)/produtos/actions";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

function DarkLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[#f5f5f5]">
      {children}
    </Label>
  );
}

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
    const result = await setProductCategoryActive(
      category.id,
      !category.active
    );
    if (result.ok) {
      toast.success(
        category.active ? "Categoria desativada." : "Categoria ativada."
      );
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
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          ADMIN_SURFACE.panel,
          "flex flex-col gap-5 p-4 sm:gap-5 sm:p-6"
        )}
      >
        <FormSectionTitle
          tone="dark"
          icon={Tags}
          title="Nova categoria"
          description="Use para separar geladeira, pomadas e outros itens."
        />

        <form
          onSubmit={handleCreate}
          className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end sm:gap-4"
          autoComplete="off"
        >
          <div className="space-y-2">
            <DarkLabel htmlFor="category-name">Nome</DarkLabel>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Geladeira"
              required
              disabled={busy}
              className={ADMIN_SURFACE.input}
            />
          </div>
          <div className="space-y-2">
            <DarkLabel htmlFor="category-sort">Ordem</DarkLabel>
            <Input
              id="category-sort"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value.replace(/\D/g, ""))
              }
              disabled={busy}
              className={ADMIN_SURFACE.input}
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className={cn(
              "h-10 w-full sm:h-9 sm:w-auto",
              ADMIN_SURFACE.btnPrimary
            )}
          >
            Adicionar
          </Button>
        </form>
      </div>

      {categories.length === 0 ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm",
            ADMIN_SURFACE.muted
          )}
        >
          Nenhuma categoria ainda. Cadastre a primeira acima.
        </div>
      ) : (
        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
          <ul className="divide-y divide-white/10">
            {categories.map((category) => (
              <li
                key={category.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3.5",
                  !category.active && "opacity-60"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                    {category.name}
                  </p>
                  <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                    Ordem {category.sortOrder} · {category.productCount} produto
                    {category.productCount === 1 ? "" : "s"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      className="text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={ADMIN_SURFACE.popover}
                  >
                    <DropdownMenuItem onSelect={() => setEditing(category)}>
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleToggleActive(category)}
                  >
                    {category.active ? "Desativar" : "Ativar"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget(category)}
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Editar categoria
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <DarkLabel htmlFor="edit-category-name">Nome</DarkLabel>
                <Input
                  id="edit-category-name"
                  value={editing.name}
                  onChange={(event) =>
                    setEditing({ ...editing, name: event.target.value })
                  }
                  disabled={busy}
                  className={ADMIN_SURFACE.input}
                />
              </div>
              <div className="space-y-2">
                <DarkLabel htmlFor="edit-category-sort">Ordem</DarkLabel>
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
                  className={ADMIN_SURFACE.input}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={busy}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleUpdate()}
              disabled={busy || !editing}
              className={ADMIN_SURFACE.btnPrimary}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Excluir {deleteTarget?.name}?
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              Só é possível excluir categorias sem produtos cadastrados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busy}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
