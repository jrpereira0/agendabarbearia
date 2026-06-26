import { redirect } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/login-path";
import { todayInTimezone } from "@/lib/availability";
import { getAgendaDayContext } from "@/lib/get-agenda-day";
import { formatTime } from "@/lib/format";
import { getAdminSession } from "@/lib/require-admin";
import { AgendaView } from "@/components/admin/agenda-view";
import type { AppointmentItem } from "@/components/admin/appointment-item";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect(LOGIN_PATH);

  const { date: dateParam } = await searchParams;
  const today = todayInTimezone();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const supabase = await requireServerClient();

  const { data: allProfessionals } = await supabase
    .from("professionals")
    .select("id")
    .eq("active", true)
    .order("nickname");

  const professionalIds = session.isOwner
    ? (allProfessionals ?? []).map((p) => p.id)
    : session.professionalId
      ? [session.professionalId]
      : [];

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
      id,
      professional_id,
      customer_first_name,
      customer_last_name,
      customer_whatsapp,
      date,
      start_time,
      end_time,
      status,
      is_squeeze_in,
      professionals ( nickname ),
      appointment_services (
        services ( id, name, duration_minutes, price_cents )
      )
    `
    )
    .eq("date", date)
    .neq("status", "cancelled")
    .order("start_time");

  if (!session.isOwner && session.professionalId) {
    appointmentsQuery = appointmentsQuery.eq(
      "professional_id",
      session.professionalId
    );
  }

  const [dayContext, { data: services }, { data: rawAppointments }] =
    await Promise.all([
      getAgendaDayContext(date, professionalIds),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("active", true)
        .order("name"),
      appointmentsQuery,
    ]);

  const appointments: AppointmentItem[] = (rawAppointments ?? []).map((a) => {
    const rawPro = a.professionals as
      | { nickname: string }
      | { nickname: string }[]
      | null;
    const professionalNickname = Array.isArray(rawPro)
      ? (rawPro[0]?.nickname ?? "—")
      : (rawPro?.nickname ?? "—");

    return {
    id: a.id,
    date: a.date,
    professionalId: a.professional_id,
    professionalNickname,
    customerFirstName: a.customer_first_name,
    customerLastName: a.customer_last_name,
    customerWhatsapp: a.customer_whatsapp,
    startTime: formatTime(a.start_time),
    endTime: formatTime(a.end_time),
    status: a.status as AppointmentItem["status"],
    isSqueezeIn: a.is_squeeze_in ?? false,
    services: (a.appointment_services ?? []).flatMap((row) => {
      const raw = row.services as
        | { id: string; name: string; duration_minutes: number; price_cents: number }
        | { id: string; name: string; duration_minutes: number; price_cents: number }[]
        | null;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      }));
    }),
  };
  });

  return (
    <AgendaView
      date={date}
      today={today}
      isOwner={session.isOwner}
      professionalId={session.professionalId}
      dayContext={dayContext}
      appointments={appointments}
      services={(services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      }))}
    />
  );
}
