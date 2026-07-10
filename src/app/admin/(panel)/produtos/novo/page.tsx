import Link from "next/link";
import { redirect } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { AdminFormPage } from "@/components/admin/admin-form-layout";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { createProduct } from "../actions";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (!categories?.length) {
    return (
      <AdminFormPage>
        <PageHeader
          title="Novo produto"
          description="Cadastre uma categoria antes de criar produtos."
          backHref="/admin/produtos"
          backLabel="Produtos"
        />
        <Button asChild>
          <Link href="/admin/produtos/categorias">Ir para categorias</Link>
        </Button>
      </AdminFormPage>
    );
  }

  return (
    <AdminFormPage>
      <PageHeader
        title="Novo produto"
        description="Cadastre o item com preço, comissão e estoque."
        backHref="/admin/produtos"
        backLabel="Produtos"
      />

      <ProductForm
        categories={categories}
        onSubmit={createProduct}
        submitLabel="Cadastrar produto"
      />
    </AdminFormPage>
  );
}
