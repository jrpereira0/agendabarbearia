import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ProductCategoriesManager } from "@/components/admin/product-categories-manager";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          tone="dark"
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
    </div>
  );
}
