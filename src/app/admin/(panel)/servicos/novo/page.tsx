import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { createService } from "../actions";

export const metadata = { title: "Novo serviço" };

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, nickname")
    .eq("active", true)
    .order("nickname");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Novo serviço"
        description="Cadastre o serviço com preço e duração."
        backHref="/admin/servicos"
        backLabel="Serviços"
      />

      <ServiceForm
        professionals={professionals ?? []}
        onSubmit={createService}
        submitLabel="Cadastrar serviço"
      />
    </div>
  );
}
