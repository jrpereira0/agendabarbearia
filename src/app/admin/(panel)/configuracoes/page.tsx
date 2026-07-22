import { requireServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsView } from "@/components/admin/settings-view";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { formatCep, formatTime } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import type { ExceptionItem } from "@/components/admin/exceptions-card";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await assertOwnerSettingsPage();

  const supabase = await requireServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: businessHours },
    { data: professionals },
    { data: exceptions },
    { data: settings },
  ] = await Promise.all([
    supabase.from("business_hours").select("*").order("weekday"),
    supabase
      .from("professionals")
      .select("id, nickname")
      .eq("active", true)
      .order("nickname"),
    supabase
      .from("schedule_exceptions")
      .select(
        "id, date, kind, start_time, end_time, note, professionals(nickname)"
      )
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
      (e.professionals as { nickname: string }[] | null)?.[0]?.nickname ?? null,
  }));

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
        <PageHeader
          tone="dark"
          title="Configurações"
          description="Perfil, horários, dias especiais e integrações da barbearia."
        />

        <SettingsView
          profile={{
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
          businessDays={businessDays}
          slotStepMinutes={settings?.slot_step_minutes ?? 15}
          exceptions={exceptionItems}
          professionals={(professionals ?? []).map((p) => ({
            id: p.id,
            nickname: p.nickname,
          }))}
        />
      </div>
    </div>
  );
}
