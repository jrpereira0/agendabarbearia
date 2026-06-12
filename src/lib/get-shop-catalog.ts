import { createClient } from "@/lib/supabase/server";
import { formatShopAddress, formatTime, WEEKDAYS } from "@/lib/format";

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

export async function getShopCatalog(): Promise<ShopCatalog> {
  const supabase = await createClient();

  const [
    { data: settings },
    { data: professionals },
    { data: services },
    { data: links },
    { data: businessHours },
  ] = await Promise.all([
    supabase.from("shop_settings").select("*").single(),
    supabase
      .from("professionals")
      .select("id, nickname, photo_url")
      .eq("active", true)
      .order("nickname"),
    supabase
      .from("services")
      .select("id, name, description, photo_url, duration_minutes, price_cents")
      .eq("active", true)
      .order("name"),
    supabase.from("professional_services").select("professional_id, service_id"),
    supabase.from("business_hours").select("*").order("weekday"),
  ]);

  const serviceIdsByProfessional = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = serviceIdsByProfessional.get(link.professional_id) ?? [];
    list.push(link.service_id);
    serviceIdsByProfessional.set(link.professional_id, list);
  }

  return {
    shop: {
      name: settings?.shop_name?.trim() || "Barbearia",
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
      logoUrl: settings?.logo_url ?? null,
      slotStepMinutes: settings?.slot_step_minutes ?? 15,
    },
    professionals: (professionals ?? []).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      photoUrl: p.photo_url,
      serviceIds: serviceIdsByProfessional.get(p.id) ?? [],
    })),
    services: (services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      photoUrl: s.photo_url,
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents,
    })),
    businessHours: (businessHours ?? []).map((b) => ({
      weekday: b.weekday,
      label: WEEKDAYS[b.weekday],
      active: b.active,
      openTime: formatTime(b.open_time),
      closeTime: formatTime(b.close_time),
    })),
  };
}
