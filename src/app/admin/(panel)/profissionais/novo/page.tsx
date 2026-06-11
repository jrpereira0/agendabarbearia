import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ProfessionalForm } from "@/components/admin/professional-form";
import { formatTime } from "@/lib/format";
import { createProfessional } from "../actions";

export const metadata = { title: "Novo profissional" };

export default async function NewProfessionalPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: businessHours }] = await Promise.all([
    supabase.from("services").select("id, name").eq("active", true).order("name"),
    supabase.from("business_hours").select("*").order("weekday"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Novo profissional"
        description="Cadastre o barbeiro e crie o acesso dele ao sistema."
        backHref="/admin/profissionais"
        backLabel="Profissionais"
      />

      <ProfessionalForm
        services={services ?? []}
        businessDays={(businessHours ?? []).map((b) => ({
          weekday: b.weekday,
          active: b.active,
          openTime: formatTime(b.open_time),
          closeTime: formatTime(b.close_time),
        }))}
        onSubmit={createProfessional}
        submitLabel="Cadastrar profissional"
      />
    </div>
  );
}
