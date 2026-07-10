import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatShopAddress, formatTime, WEEKDAYS } from "@/lib/format";
import { minWeekdayPrice } from "@/lib/service-weekday-prices";
import { loadServiceBookingCounts } from "@/lib/service-booking-stats";

export type ShopProfile = {
  name: string;
  bio: string;
  address: string;
  whatsapp: string;
  instagram: string | null;
  logoUrl: string | null;
  slotStepMinutes: number;
};

export type PublicProfessional = {
  id: string;
  nickname: string;
  photoUrl: string | null;
  serviceIds: string[];
};

export type PublicService = {
  id: string;
  name: string;
  description: string;
  photoUrl: string | null;
  durationMinutes: number;
  priceCents: number;
  /** Preço variável no atendimento (ex.: progressiva por tamanho do cabelo). */
  priceFrom: boolean;
  weekdayPrices: { weekday: number; priceCents: number }[];
  /** Vezes que o serviço entrou em agendamentos normais (não cancelados). */
  bookingCount: number;
};

export type BusinessHourRow = {
  weekday: number;
  label: string;
  active: boolean;
  openTime: string;
  closeTime: string;
};

export type ShopCatalog = {
  shop: ShopProfile;
  professionals: PublicProfessional[];
  services: PublicService[];
  businessHours: BusinessHourRow[];
};

function emptyShopCatalog(): ShopCatalog {
  return {
    shop: {
      name: BRAND_NAME,
      bio: "",
      address: "",
      whatsapp: "",
      instagram: null,
      logoUrl: BRAND_ICON_PATH,
      slotStepMinutes: 15,
    },
    professionals: [],
    services: [],
    businessHours: [],
  };
}

export async function getShopCatalog(): Promise<ShopCatalog> {
  if (!isSupabaseConfigured()) {
    return emptyShopCatalog();
  }

  try {
    const supabase = await createClient();
    if (!supabase) return emptyShopCatalog();

    const [
      { data: settings },
      { data: professionals },
      { data: services },
      { data: links },
      { data: businessHours },
      { data: weekdayPrices },
      bookingCounts,
    ] = await Promise.all([
      supabase.from("shop_settings").select("*").single(),
      supabase
        .from("professionals")
        .select("id, nickname, photo_url")
        .eq("active", true)
        .order("nickname"),
      supabase
        .from("services")
        .select(
          "id, name, description, photo_url, duration_minutes, price_cents, price_from"
        )
        .eq("active", true)
        .order("name"),
      supabase.from("professional_services").select("professional_id, service_id"),
      supabase.from("business_hours").select("*").order("weekday"),
      supabase.from("service_weekday_prices").select("service_id, weekday, price_cents"),
      loadServiceBookingCounts(),
    ]);

    const weekdayPricesByService = new Map<string, { weekday: number; priceCents: number }[]>();
    for (const row of weekdayPrices ?? []) {
      const list = weekdayPricesByService.get(row.service_id) ?? [];
      list.push({ weekday: row.weekday, priceCents: row.price_cents });
      weekdayPricesByService.set(row.service_id, list);
    }

    const serviceIdsByProfessional = new Map<string, string[]>();
    for (const link of links ?? []) {
      const list = serviceIdsByProfessional.get(link.professional_id) ?? [];
      list.push(link.service_id);
      serviceIdsByProfessional.set(link.professional_id, list);
    }

    return {
      shop: {
        name: settings?.shop_name?.trim() || BRAND_NAME,
        bio: settings?.bio?.trim() ?? "",
        address:
          formatShopAddress({
            street: settings?.street ?? "",
            addressNumber: settings?.address_number ?? "",
            addressComplement: settings?.address_complement ?? "",
            neighborhood: settings?.neighborhood ?? "",
            city: settings?.city ?? "",
            state: settings?.state ?? "",
          }) ||
          settings?.address?.trim() ||
          "",
        whatsapp: settings?.whatsapp?.replace(/\D/g, "") ?? "",
        instagram: settings?.instagram?.trim() || null,
        logoUrl: settings?.logo_url?.trim() || BRAND_ICON_PATH,
        slotStepMinutes: settings?.slot_step_minutes ?? 15,
      },
      professionals: (professionals ?? []).map((p) => ({
        id: p.id,
        nickname: p.nickname,
        photoUrl: p.photo_url,
        serviceIds: serviceIdsByProfessional.get(p.id) ?? [],
      })),
      services: (services ?? []).map((s) => {
        const prices = (weekdayPricesByService.get(s.id) ?? []).sort(
          (a, b) => a.weekday - b.weekday
        );
        return {
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          photoUrl: s.photo_url,
          durationMinutes: s.duration_minutes,
          priceCents: prices.length > 0 ? minWeekdayPrice(prices) : s.price_cents,
          priceFrom: s.price_from ?? false,
          weekdayPrices: prices,
          bookingCount: bookingCounts.get(s.id) ?? 0,
        };
      }),
      businessHours: (businessHours ?? []).map((b) => ({
        weekday: b.weekday,
        label: WEEKDAYS[b.weekday],
        active: b.active,
        openTime: formatTime(b.open_time),
        closeTime: formatTime(b.close_time),
      })),
    };
  } catch {
    return emptyShopCatalog();
  }
}
