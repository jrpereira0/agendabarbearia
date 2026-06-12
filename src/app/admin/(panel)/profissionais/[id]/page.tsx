import { notFound } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ProfessionalForm } from "@/components/admin/professional-form";
import type { DayRanges } from "@/lib/week-schedule";
import { formatTime } from "@/lib/format";
import { updateProfessional } from "../actions";

export const metadata = { title: "Editar profissional" };

export default async function EditProfessionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertOwnerPage();

  const { id } = await params;
  const supabase = await requireServerClient();

  const [{ data: professional }, { data: services }, { data: businessHours }] =
    await Promise.all([
      supabase
        .from("professionals")
        .select(
          "id, first_name, last_name, nickname, whatsapp, email, instagram, photo_url, professional_services(service_id), working_hours(weekday, start_time, end_time)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("services")
        .select("id, name")
        .eq("active", true)
        .order("name"),
      supabase.from("business_hours").select("*").order("weekday"),
    ]);

  if (!professional) notFound();

  const updateWithId = updateProfessional.bind(null, professional.id);

  const schedule = Object.values(
    (professional.working_hours ?? []).reduce(
      (acc, wh) => {
        acc[wh.weekday] ??= { weekday: wh.weekday, ranges: [] };
        acc[wh.weekday].ranges.push({
          startTime: formatTime(wh.start_time),
          endTime: formatTime(wh.end_time),
        });
        return acc;
      },
      {} as Record<number, DayRanges>
    )
  ).map((day) => ({
    ...day,
    ranges: day.ranges.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Editar profissional"
        description={`${professional.nickname} — ${professional.first_name} ${professional.last_name}`}
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
        initialValues={{
          firstName: professional.first_name,
          lastName: professional.last_name,
          nickname: professional.nickname,
          whatsapp: professional.whatsapp,
          email: professional.email,
          instagram: professional.instagram ?? "",
          photoUrl: professional.photo_url,
          serviceIds: (professional.professional_services ?? []).map(
            (ps) => ps.service_id
          ),
          schedule,
        }}
        onSubmit={updateWithId}
        submitLabel="Salvar alterações"
        isEdit
      />
    </div>
  );
}
