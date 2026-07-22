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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type ProductListItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  commissionPercent: number;
  stockQuantity: number;
  photoUrl: string | null;
  photoPosition?: string | null;
  active: boolean;
  categoryName: string;
};

type Tone = "default" | "dark";

function ProductThumb({
  product,
  tone = "default",
}: {
  product: ProductListItem;
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
      {product.photoUrl ? (
        <Image
          src={product.photoUrl}
          alt={product.name}
          fill
          className="object-cover"
          style={{ objectPosition: product.photoPosition ?? "50% 50%" }}
          unoptimized
        />
      ) : (
        <Package
          className={cn(
            "size-4",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        />
      )}
    </div>
  );
}

function ProductActionsMenu({
  product,
  onDelete,
  tone = "default",
}: {
  product: ProductListItem;
  onDelete: () => void;
  tone?: Tone;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";

  async function handleToggleActive() {
    setBusy(true);
    const result = await setProductActive(product.id, !product.active);
    if (result.ok) {
      toast.success(
        product.active ? "Produto desativado." : "Produto ativado."
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
          onSelect={() => router.push(`/admin/produtos/${product.id}`)}
        >
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleToggleActive}>
          {product.active ? <CircleOff /> : <CircleCheck />}
          {product.active ? "Desativar" : "Ativar"}
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

function DeleteProductDialog({
  open,
  onOpenChange,
  product,
  busy,
  onConfirm,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductListItem;
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
            Excluir {product.name}?
          </DialogTitle>
          <DialogDescription className={cn(dark && ADMIN_SURFACE.muted)}>
            Isso remove o produto do catálogo. Prefira desativar se for
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

export function ProductListRow({
  product,
  tone = "default",
}: {
  product: ProductListItem;
  tone?: Tone;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";

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
          "cursor-pointer transition-colors",
          dark ? "hover:bg-white/[0.04]" : "hover:bg-muted/40",
          !product.active && "opacity-60"
        )}
        onClick={() => router.push(`/admin/produtos/${product.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb product={product} tone={tone} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogStatusDot active={product.active} />
                <span
                  className={cn(
                    "truncate font-medium",
                    dark && "text-[#f5f5f5]"
                  )}
                >
                  {product.name}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                {product.categoryName}
                {product.description ? ` · ${product.description}` : null}
              </p>
            </div>
          </div>
        </td>
        <td
          className={cn(
            "px-4 py-3 text-right tabular-nums font-medium",
            dark ? "text-[#f5f5f5]" : undefined
          )}
        >
          {formatPriceBRL(product.priceCents)}
        </td>
        <td
          className={cn(
            "hidden px-4 py-3 text-right tabular-nums sm:table-cell",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {product.commissionPercent}%
        </td>
        <td
          className={cn(
            "px-4 py-3 text-right tabular-nums",
            dark ? "text-[#f5f5f5]" : undefined,
            product.stockQuantity === 0 &&
              (dark ? "text-[#fca5a5]" : "text-destructive/80")
          )}
        >
          {product.stockQuantity}
        </td>
        <td
          className="px-2 py-3 text-right"
          onClick={(event) => event.stopPropagation()}
        >
          <ProductActionsMenu
            product={product}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </td>
      </tr>

      <DeleteProductDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        product={product}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}

export function ProductMobileCard({
  product,
  tone = "default",
  embedded = false,
}: {
  product: ProductListItem;
  tone?: Tone;
  embedded?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dark = tone === "dark";

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
          "flex items-center gap-3",
          embedded
            ? "px-4 py-3.5"
            : cn(
                "rounded-lg border p-4",
                dark
                  ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
                  : "bg-card shadow-sm"
              ),
          !product.active && "opacity-60"
        )}
      >
        <Link
          href={`/admin/produtos/${product.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ProductThumb product={product} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CatalogStatusDot active={product.active} />
              <p
                className={cn(
                  "truncate text-[15px] font-medium tracking-tight",
                  dark && "text-[#f5f5f5]"
                )}
              >
                {product.name}
              </p>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-xs tabular-nums",
                dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
              )}
            >
              {formatPriceBRL(product.priceCents)}
              {" · "}
              {product.categoryName}
              {" · estoque "}
              {product.stockQuantity}
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
          <ProductActionsMenu
            product={product}
            onDelete={() => setConfirmDelete(true)}
            tone={tone}
          />
        </div>
      </div>

      <DeleteProductDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        product={product}
        busy={busy}
        onConfirm={handleDelete}
        tone={tone}
      />
    </>
  );
}
