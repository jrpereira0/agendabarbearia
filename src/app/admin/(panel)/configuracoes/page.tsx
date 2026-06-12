import { requireServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  BusinessHoursForm,
  type BusinessDay,
} from "@/components/admin/business-hours-form";
import {
  ExceptionsCard,
  type ExceptionItem,
} from "@/components/admin/exceptions-card";
import { ShopProfileForm } from "@/components/admin/shop-profile-form";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { formatCep, formatTime } from "@/lib/format";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await assertOwnerSettingsPage();

  const supabase = await requireServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: businessHours }, { data: professionals }, { data: exceptions }, { data: settings }] =
    await Promise.all([
      supabase.from("business_hours").select("*").order("weekday"),
      supabase
        .from("professionals")
        .select("id, nickname")
        .eq("active", true)
        .order("nickname"),
      supabase
        .from("schedule_exceptions")
        .select("id, date, kind, start_time, end_time, note, professionals(nickname)")
        .gte("date", today)
        .order("date"),
      supabase.from("shop_settings").select("*").single(),
    ]);

  const businessDays: BusinessDay[] = (businessHours ?? []).map((b) => ({
    weekday: b.weekday,
    active: b.active,
    openTime: formatTime(b.open_time),
    closeTime: formatTime(b.close_time),
  }));

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
        description="Perfil, endereço, horários e dias especiais. A grade de cada barbeiro fica em Profissionais."
      />

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

      <BusinessHoursForm
        initialDays={businessDays}
        initialSlotStep={settings?.slot_step_minutes ?? 15}
      />

      <ExceptionsCard
        exceptions={exceptionItems}
        professionals={(professionals ?? []).map((p) => ({
          id: p.id,
          nickname: p.nickname,
        }))}
      />
    </div>
  );
}
