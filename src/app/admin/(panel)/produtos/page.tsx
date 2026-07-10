import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductsList } from "@/components/admin/products-list";

export const metadata = { title: "Produtos" };

export default async function ProductsPage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, description, price_cents, commission_percent, stock_quantity, photo_url, active, product_categories ( name )"
    )
    .order("name");

  const list = products ?? [];
  const activeCount = list.filter((product) => product.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produtos"
        description={
          list.length === 0
            ? "Cadastre produtos e itens da geladeira para vender na comanda."
            : `${list.length} cadastrado${list.length > 1 ? "s" : ""} · ${activeCount} ativo${activeCount === 1 ? "" : "s"}`
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto ainda"
          description="Cadastre pomadas, bebidas e outros itens com preço, comissão e estoque."
          action={
            <Button asChild>
              <Link href="/admin/produtos/novo">
                <Plus />
                Cadastrar o primeiro
              </Link>
            </Button>
          }
        />
      ) : (
        <ProductsList
          items={list.map((product) => {
            const category = product.product_categories as
              | { name: string }
              | { name: string }[]
              | null;
            const categoryName = Array.isArray(category)
              ? (category[0]?.name ?? "—")
              : (category?.name ?? "—");

            return {
              id: product.id,
              name: product.name,
              description: product.description,
              priceCents: product.price_cents,
              commissionPercent: product.commission_percent,
              stockQuantity: product.stock_quantity,
              photoUrl: product.photo_url,
              active: product.active,
              categoryName,
            };
          })}
        />
      )}
    </div>
  );
}
