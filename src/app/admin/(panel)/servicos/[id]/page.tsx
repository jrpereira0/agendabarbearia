import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { updateService } from "../actions";

export const metadata = { title: "Editar serviço" };

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertOwnerPage();

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: service }, { data: professionals }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, price_cents, duration_minutes, photo_url, professional_services(professional_id)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("professionals")
      .select("id, nickname")
      .eq("active", true)
      .order("nickname"),
  ]);

  if (!service) notFound();

  const updateWithId = updateService.bind(null, service.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Editar serviço"
        description={service.name}
        backHref="/admin/servicos"
        backLabel="Serviços"
      />

      <ServiceForm
        professionals={professionals ?? []}
        initialValues={{
          name: service.name,
          description: service.description,
          priceCents: service.price_cents,
          durationMinutes: service.duration_minutes,
          photoUrl: service.photo_url,
          professionalIds: (service.professional_services ?? []).map(
            (ps) => ps.professional_id
          ),
        }}
        onSubmit={updateWithId}
        submitLabel="Salvar alterações"
        isEdit
      />
    </div>
  );
}
