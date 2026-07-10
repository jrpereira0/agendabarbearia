"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminFormActions,
  AdminFormFields,
  AdminFormPhotoUpload,
  AdminFormSectionCard,
} from "@/components/admin/admin-form-layout";
import { compressImage } from "@/lib/compress-image";
import { formatPriceBRL } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";

export type ProductCategoryOption = {
  id: string;
  name: string;
};

export type ProductFormValues = {
  name: string;
  description: string;
  categoryId: string;
  priceCents: number;
  commissionPercent: number;
  stockQuantity: number;
  photoUrl: string | null;
};

type ProductFormProps = {
  categories: ProductCategoryOption[];
  initialValues?: ProductFormValues;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
};

function formatCentsInput(cents: number): string {
  if (cents <= 0) return "";
  return formatPriceBRL(cents);
}

export function ProductForm({
  categories,
  initialValues,
  onSubmit,
  submitLabel,
}: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    initialValues?.photoUrl ?? null
  );
  const [categoryId, setCategoryId] = useState(
    initialValues?.categoryId ?? categories[0]?.id ?? ""
  );
  const [priceInput, setPriceInput] = useState(
    initialValues ? formatCentsInput(initialValues.priceCents) : ""
  );
  const [commissionInput, setCommissionInput] = useState(
    initialValues ? String(initialValues.commissionPercent) : "0"
  );
  const [stockInput, setStockInput] = useState(
    initialValues ? String(initialValues.stockQuantity) : "0"
  );
  const [busy, setBusy] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.id),
    [categories]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryId) {
      toast.error("Escolha uma categoria.");
      return;
    }

    setBusy(true);
    const formData = new FormData(event.currentTarget);
    formData.set("categoryId", categoryId);
    formData.set("priceCents", priceInput.replace(/\D/g, ""));
    formData.set("commissionPercent", commissionInput.replace(/\D/g, ""));
    formData.set("stockQuantity", stockInput.replace(/\D/g, ""));

    const result = await onSubmit(formData);
    if (result.ok) {
      toast.success(initialValues ? "Produto atualizado." : "Produto cadastrado.");
      router.push("/admin/produtos");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPreview(URL.createObjectURL(compressed));
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      fileInputRef.current.files = dataTransfer.files;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AdminFormSectionCard
        title="Informações do produto"
        description="Nome, categoria e foto usados na comanda."
      >
        <div className="flex flex-col gap-6">
          <AdminFormPhotoUpload
            preview={preview}
            inputRef={fileInputRef}
            onChange={(event) => void handlePhotoChange(event)}
            hint="Opcional. A imagem é comprimida antes do envio."
          />

          <AdminFormFields columns={2}>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nome do produto</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Pomada modeladora"
                defaultValue={initialValues?.name ?? ""}
                required
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Categoria</Label>
                <Link
                  href="/admin/produtos/categorias"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Gerenciar
                </Link>
              </div>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                disabled={busy || activeCategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initialValues?.description ?? ""}
                rows={3}
                placeholder="Detalhes para a equipe identificar o item."
                disabled={busy}
              />
            </div>
          </AdminFormFields>
        </div>
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Valores e estoque"
        description="Comissão por produto. O estoque baixa no fechamento da comanda."
      >
        <AdminFormFields columns={3}>
          <div className="space-y-2">
            <Label htmlFor="priceCents">Preço de venda</Label>
            <Input
              id="priceCents"
              inputMode="numeric"
              value={priceInput}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                setPriceInput(
                  digits ? formatPriceBRL(Number.parseInt(digits, 10)) : ""
                );
              }}
              placeholder="R$ 0,00"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissionPercent">Comissão (%)</Label>
            <Input
              id="commissionPercent"
              inputMode="numeric"
              value={commissionInput}
              onChange={(event) =>
                setCommissionInput(event.target.value.replace(/\D/g, ""))
              }
              placeholder="0"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stockQuantity">Estoque</Label>
            <Input
              id="stockQuantity"
              inputMode="numeric"
              value={stockInput}
              onChange={(event) =>
                setStockInput(event.target.value.replace(/\D/g, ""))
              }
              placeholder="0"
              disabled={busy}
            />
          </div>
        </AdminFormFields>
      </AdminFormSectionCard>

      <AdminFormActions
        onCancel={() => router.push("/admin/produtos")}
        submitLabel={submitLabel}
        saving={busy}
        disabled={activeCategories.length === 0}
      />
    </form>
  );
}
