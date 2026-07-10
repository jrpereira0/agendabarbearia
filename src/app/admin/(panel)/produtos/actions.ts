"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { requireOwner, type ActionResult } from "@/lib/require-owner";
import { uploadPublicPhoto } from "@/lib/upload-photo";

const productSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto."),
  description: z.string().trim(),
  categoryId: z.uuid("Escolha uma categoria."),
  priceCents: z
    .number()
    .int()
    .min(0, "Informe um preço válido."),
  commissionPercent: z
    .number()
    .int()
    .min(0, "Comissão mínima: 0%.")
    .max(100, "Comissão máxima: 100%."),
  stockQuantity: z
    .number()
    .int()
    .min(0, "O estoque não pode ser negativo."),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
  sortOrder: z.number().int().min(0).default(0),
});

function parseProductForm(formData: FormData) {
  const priceRaw = String(formData.get("priceCents") ?? "").replace(/\D/g, "");
  const commissionRaw = String(formData.get("commissionPercent") ?? "").replace(
    /\D/g,
    ""
  );
  const stockRaw = String(formData.get("stockQuantity") ?? "").replace(/\D/g, "");

  return productSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    categoryId: formData.get("categoryId"),
    priceCents: priceRaw ? Number.parseInt(priceRaw, 10) : 0,
    commissionPercent: commissionRaw ? Number.parseInt(commissionRaw, 10) : 0,
    stockQuantity: stockRaw ? Number.parseInt(stockRaw, 10) : 0,
  });
}

async function uploadPhoto(productId: string, photo: File): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const result = await uploadPublicPhoto(admin, "products", productId, photo);
  return result.ok ? result.url : null;
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data: product, error } = await admin
    .from("products")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      category_id: parsed.data.categoryId,
      price_cents: parsed.data.priceCents,
      commission_percent: parsed.data.commissionPercent,
      stock_quantity: parsed.data.stockQuantity,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadPhoto(product.id, photo);
    if (url) {
      await admin.from("products").update({ photo_url: url }).eq("id", product.id);
    }
  }

  revalidatePath("/admin/produtos");
  return { ok: true };
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const updates: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description,
    category_id: parsed.data.categoryId,
    price_cents: parsed.data.priceCents,
    commission_percent: parsed.data.commissionPercent,
    stock_quantity: parsed.data.stockQuantity,
    updated_at: new Date().toISOString(),
  };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadPhoto(id, photo);
    if (url) updates.photo_url = url;
  }

  const { error } = await admin.from("products").update(updates).eq("id", id);
  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidatePath("/admin/produtos");
  return { ok: true };
}

export async function setProductActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { error } = await admin
    .from("products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/produtos");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { count } = await admin
    .from("comanda_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if (count && count > 0) {
    return {
      ok: false,
      error:
        "Esse produto já foi vendido em comandas. Desative-o em vez de excluir.",
    };
  }

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/produtos");
  return { ok: true };
}

export async function createProductCategory(
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await admin.from("product_categories").insert({
    name: parsed.data.name,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma categoria com esse nome." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/categorias");
  return { ok: true };
}

export async function updateProductCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await admin
    .from("product_categories")
    .update({
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma categoria com esse nome." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/categorias");
  return { ok: true };
}

export async function setProductCategoryActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { error } = await admin
    .from("product_categories")
    .update({ active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/categorias");
  return { ok: true };
}

export async function deleteProductCategory(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { count } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return {
      ok: false,
      error: "Essa categoria tem produtos cadastrados. Mova ou exclua os produtos antes.",
    };
  }

  const { error } = await admin.from("product_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/categorias");
  return { ok: true };
}
