import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ProductCategoriesManager } from "@/components/admin/product-categories-manager";

export const metadata = { title: "Categorias de produto" };

export default async function ProductCategoriesPage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, sort_order, active, products ( id )")
    .order("sort_order")
    .order("name");

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Categorias"
        description="Organize produtos e itens da geladeira."
        backHref="/admin/produtos"
        backLabel="Produtos"
      />

      <ProductCategoriesManager
        categories={(categories ?? []).map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sort_order,
          active: category.active,
          productCount: (category.products ?? []).length,
        }))}
      />
    </div>
  );
}
