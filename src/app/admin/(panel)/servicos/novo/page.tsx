import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { createService } from "../actions";

export const metadata = { title: "Novo serviço" };

export default async function NewServicePage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();
  const [{ data: professionals }, { data: businessHours }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, nickname")
      .eq("active", true)
      .order("nickname"),
    supabase.from("business_hours").select("weekday, active").order("weekday"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Novo serviço"
        description="Cadastre o serviço com preço por dia e duração."
        backHref="/admin/servicos"
        backLabel="Serviços"
      />

      <ServiceForm
        professionals={professionals ?? []}
        businessHours={businessHours ?? []}
        onSubmit={createService}
        submitLabel="Cadastrar serviço"
      />
    </div>
  );
}
