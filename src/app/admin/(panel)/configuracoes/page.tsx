import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { FormSectionTitle } from "@/components/admin/form-section";
import {
  BusinessHoursForm,
  type BusinessDay,
} from "@/components/admin/business-hours-form";
import {
  WeekGridEditor,
  fillWeek,
  type DayRanges,
} from "@/components/admin/week-grid-editor";
import {
  ExceptionsCard,
  type ExceptionItem,
} from "@/components/admin/exceptions-card";
import { ShopProfileForm } from "@/components/admin/shop-profile-form";
import { formatCep, formatTime } from "@/lib/format";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: businessHours },
    { data: professionals },
    { data: exceptions },
    { data: settings },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("business_hours").select("*").order("weekday"),
    supabase
      .from("professionals")
      .select(
        "id, nickname, profile_id, working_hours(weekday, start_time, end_time)"
      )
      .eq("active", true)
      .order("nickname"),
    supabase
      .from("schedule_exceptions")
      .select("id, date, kind, start_time, end_time, note, professionals(nickname)")
      .gte("date", today)
      .order("date"),
    supabase.from("shop_settings").select("*").single(),
  ]);

  const isOwner = profile?.role === "owner";

  const businessDays: BusinessDay[] = (businessHours ?? []).map((b) => ({
    weekday: b.weekday,
    active: b.active,
    openTime: formatTime(b.open_time),
    closeTime: formatTime(b.close_time),
  }));

  const ownProfessional = isOwner
    ? null
    : (professionals ?? []).find((p) => p.profile_id === user!.id);

  const ownSchedule: DayRanges[] = ownProfessional
    ? fillWeek(
        Object.values(
          (ownProfessional.working_hours ?? []).reduce(
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
        )
      )
    : [];

  const exceptionItems: ExceptionItem[] = (exceptions ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    kind: e.kind as "closed" | "custom",
    startTime: e.start_time,
    endTime: e.end_time,
    note: e.note,
    professionalNickname:
      (e.professionals as { nickname: string }[] | null)?.[0]?.nickname ??
      null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações da barbearia"
        description={
          isOwner
            ? "Perfil, endereço, horários e dias especiais. A grade de cada barbeiro fica em Profissionais."
            : "Horário da barbearia e sua grade de atendimento."
        }
      />

      {isOwner && (
        <ShopProfileForm
          initialValues={{
            shopName: settings?.shop_name ?? "",
            bio: settings?.bio ?? "",
            cep: settings?.cep ? formatCep(settings.cep) : "",
            street: settings?.street ?? "",
            addressNumber: settings?.address_number ?? "",
            addressComplement: settings?.address_complement ?? "",
            neighborhood: settings?.neighborhood ?? "",
            city: settings?.city ?? "",
            state: settings?.state ?? "",
            whatsapp: settings?.whatsapp ?? "",
            instagram: settings?.instagram ?? "",
            logoUrl: settings?.logo_url ?? null,
          }}
        />
      )}

      <BusinessHoursForm
        initialDays={businessDays}
        initialSlotStep={settings?.slot_step_minutes ?? 15}
        readOnly={!isOwner}
      />

      {ownProfessional && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Clock}
              title="Sua grade de atendimento"
              description="Pra mudar seus horários, fale com o dono da barbearia."
            />
            <WeekGridEditor
              days={ownSchedule}
              businessDays={businessDays}
              readOnly
            />
          </CardContent>
        </Card>
      )}

      <ExceptionsCard
        exceptions={exceptionItems}
        professionals={(professionals ?? []).map((p) => ({
          id: p.id,
          nickname: p.nickname,
        }))}
        readOnly={!isOwner}
      />
    </div>
  );
}
