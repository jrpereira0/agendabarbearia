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
  Package,
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
import { formatPriceBRL } from "@/lib/format";
import {
  deleteProduct,
  setProductActive,
} from "@/app/admin/(panel)/produtos/actions";
import { cn } from "@/lib/utils";

export type ProductListItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  commissionPercent: number;
  stockQuantity: number;
  photoUrl: string | null;
  active: boolean;
  categoryName: string;
};

function ProductThumb({ product }: { product: ProductListItem }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {product.photoUrl ? (
        <Image
          src={product.photoUrl}
          alt={product.name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <Package className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ProductActionsMenu({
  product,
  onDelete,
}: {
  product: ProductListItem;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    const result = await setProductActive(product.id, !product.active);
    if (result.ok) {
      toast.success(product.active ? "Produto desativado." : "Produto ativado.");
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
        <DropdownMenuItem onSelect={() => router.push(`/admin/produtos/${product.id}`)}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {product.active ? <CircleOff /> : <CircleCheck />}
          {product.active ? "Desativar" : "Ativar"}
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

export function ProductListRow({ product }: { product: ProductListItem }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProduct(product.id);
    if (result.ok) {
      toast.success("Produto excluído.");
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
          !product.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/produtos/${product.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb product={product} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={product.active} />
                <span className="truncate font-medium">{product.name}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {product.categoryName}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums font-medium">
          {formatPriceBRL(product.priceCents)}
        </td>
        <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
          {product.commissionPercent}%
        </td>
        <td
          className={cn(
            "px-4 py-3 text-right tabular-nums",
            product.stockQuantity === 0 && "text-destructive/80"
          )}
        >
          {product.stockQuantity}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ProductActionsMenu product={product} onDelete={() => setConfirmDelete(true)} />
        </td>
      </tr>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {product.name}?</DialogTitle>
            <DialogDescription>
              Isso remove o produto do catálogo. Prefira desativar se for temporário.
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

export function ProductMobileCard({ product }: { product: ProductListItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProduct(product.id);
    if (result.ok) {
      toast.success("Produto excluído.");
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
          !product.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/produtos/${product.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ProductThumb product={product} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={product.active} />
              <p className="truncate font-medium">{product.name}</p>
            </div>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {formatPriceBRL(product.priceCents)} · estoque {product.stockQuantity}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <div onClick={(event) => event.stopPropagation()}>
          <ProductActionsMenu product={product} onDelete={() => setConfirmDelete(true)} />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {product.name}?</DialogTitle>
            <DialogDescription>
              Isso remove o produto do catálogo. Prefira desativar se for temporário.
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
