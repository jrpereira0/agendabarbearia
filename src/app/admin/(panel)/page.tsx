import { redirect } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { LOGIN_PATH } from "@/lib/login-path";
import { todayInTimezone } from "@/lib/availability";
import { getAgendaDayContext } from "@/lib/get-agenda-day";
import {
  buildAdminServicesCatalogForDate,
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";
import { getCashRegisterSummary } from "@/lib/finance-reports";
import {
  getCashRegisterSession,
  getOpenCashRegisterSession,
} from "@/lib/cash-register-service";
import { loadCashRegisterResponsibleOptions } from "@/lib/cash-register-options";
import { formatTime } from "@/lib/format";
import { getAdminSession } from "@/lib/require-admin";
import { loadServiceBookingCounts } from "@/lib/service-booking-stats";
import { AgendaView } from "@/components/admin/agenda-view";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type { ProductOption } from "@/lib/product-types";
import type { CashRegisterResponsibleOption } from "@/components/admin/open-cash-register-dialog";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import type { CashRegisterSummary } from "@/lib/finance-reports";

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
      is_comanda_extra,
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

  const [dayContext, { data: services }, { data: products }, { data: rawAppointments }, pricingContext, bookingCounts] =
    await Promise.all([
      getAgendaDayContext(date, professionalIds),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, photo_url, photo_position")
        .eq("active", true)
        .order("name"),
      supabase
        .from("products")
        .select(
          "id, name, price_cents, commission_percent, stock_quantity, photo_url, photo_position, product_categories ( id, name )"
        )
        .eq("active", true)
        .order("name"),
      appointmentsQuery,
      loadServicePricingContext(supabase, date),
      loadServiceBookingCounts(),
    ]);

  let cashRegister:
    | {
        cash: CashRegisterSummary;
        cashSession: CashRegisterSession | null;
        openCashRegister: CashRegisterSession | null;
        responsibleOptions: CashRegisterResponsibleOption[];
      }
    | undefined;

  if (session.isOwner) {
    const admin = requireAdminClient();
    if (!isActionResult(admin)) {
      const [cashSession, openCashRegister, responsibleOptions] =
        await Promise.all([
          getCashRegisterSession(admin, date),
          getOpenCashRegisterSession(admin),
          loadCashRegisterResponsibleOptions(admin, session.userId),
        ]);
      const cash = await getCashRegisterSummary(admin, date, {
        cashRegisterSessionId: cashSession?.id,
      });
      cashRegister = {
        cash,
        cashSession,
        openCashRegister,
        responsibleOptions,
      };
    }
  }

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
    isComandaExtra: a.is_comanda_extra ?? false,
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
        priceCents: resolvePriceCentsOrFallback(
          {
            id: s.id,
            name: s.name,
            price_cents: s.price_cents,
          },
          pricingContext
        ),
      }));
    }),
  };
  });

  const productsCatalog: ProductOption[] = (products ?? []).map((product) => {
    const category = product.product_categories as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const categoryRow = Array.isArray(category) ? category[0] : category;
    return {
      id: product.id,
      name: product.name,
      priceCents: product.price_cents,
      commissionPercent: product.commission_percent,
      stockQuantity: product.stock_quantity,
      categoryId: categoryRow?.id ?? "",
      categoryName: categoryRow?.name ?? "—",
      photoUrl: product.photo_url,
      photoPosition: product.photo_position,
    };
  });

  return (
    <AgendaView
      date={date}
      today={today}
      isOwner={session.isOwner}
      professionalId={session.professionalId}
      permissions={session.permissions}
      dayContext={dayContext}
      appointments={appointments}
      services={buildAdminServicesCatalogForDate(
        services ?? [],
        pricingContext,
        bookingCounts
      )}
      productsCatalog={productsCatalog}
      cashRegister={cashRegister}
    />
  );
}
