import { notFound } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { AdminFormPage } from "@/components/admin/admin-form-layout";
import { ProductForm } from "@/components/admin/product-form";
import { updateProduct } from "../actions";

export const metadata = { title: "Editar produto" };

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: PageProps) {
  await assertOwnerPage();

  const { id } = await params;
  const supabase = await requireServerClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, category_id, price_cents, commission_percent, stock_quantity, photo_url, photo_position"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("product_categories")
      .select("id, name")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  if (!product || !categories?.length) {
    notFound();
  }

  const updateWithId = updateProduct.bind(null, product.id);

  return (
    <AdminFormPage>
      <PageHeader
        title={product.name}
        description="Atualize preço, comissão e estoque."
        backHref="/admin/produtos"
        backLabel="Produtos"
      />

      <ProductForm
        categories={categories}
        initialValues={{
          name: product.name,
          description: product.description,
          categoryId: product.category_id,
          priceCents: product.price_cents,
          commissionPercent: product.commission_percent,
          stockQuantity: product.stock_quantity,
          photoUrl: product.photo_url,
          photoPosition: product.photo_position,
        }}
        onSubmit={updateWithId}
        submitLabel="Salvar alterações"
      />
    </AdminFormPage>
  );
}
