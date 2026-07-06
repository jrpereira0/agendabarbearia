import { z } from "zod";
import { TIMEZONE } from "@/lib/availability";
import type { BusinessHourRow, ShopCatalog } from "@/lib/get-shop-catalog";
import {
  cleanLegacyServiceName,
  groupWeekdayPrices,
  priceForWeekday,
} from "@/lib/service-weekday-prices";

/** Índice 0–6 = domingo … sábado (legenda única na resposta, economiza tokens). */
export const BOOKING_DAY_LABELS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sab",
] as const;

const WEEKDAY_SHORT_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type CatalogQueryOptions = {
  date?: string;
  mode?: "booking";
  professionalId?: string;
};

export type ParsedCatalogQuery =
  | { ok: true; data: CatalogQueryOptions }
  | { ok: false; error: string; status: number };

export type BookingProfessional = {
  id: string;
  nickname: string;
};

export type BookingCatalogService = {
  id: string;
  name: string;
  displayName: string;
  durationMinutes: number;
  /** Preço na data pedida (só quando `date` informada). */
  priceCents?: number;
  /** [[centavos, [dias]], ...] — dias = índice em `dayLabels` (0=Dom … 6=Sab). */
  prices: [number, number[]][];
};

export type BookingCatalog = {
  timezone: string;
  dayLabels: readonly string[];
  date?: string;
  weekday?: number;
  priceBand?: "seg_qua" | "qui_sab" | "sunday";
  shopClosed?: boolean;
  shop: {
    name: string;
    address: string;
    whatsapp: string;
  };
  professionals: BookingProfessional[];
  services: BookingCatalogService[];
};

export function parseCatalogQuery(
  searchParams: URLSearchParams
): ParsedCatalogQuery {
  const dateParam = searchParams.get("date");
  const modeParam = searchParams.get("mode");
  const professionalIdParam = searchParams.get("professionalId");

  if (modeParam && modeParam !== "booking") {
    return { ok: false, error: "Parâmetro 'mode' inválido.", status: 400 };
  }

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return {
      ok: false,
      error: "Parâmetro 'date' inválido (AAAA-MM-DD).",
      status: 400,
    };
  }

  if (
    professionalIdParam &&
    !z.uuid().safeParse(professionalIdParam).success
  ) {
    return {
      ok: false,
      error: "Parâmetro 'professionalId' inválido (UUID).",
      status: 400,
    };
  }

  const options: CatalogQueryOptions = {};
  if (dateParam) options.date = dateParam;
  if (modeParam) options.mode = "booking";
  if (professionalIdParam) options.professionalId = professionalIdParam;

  return { ok: true, data: options };
}

export function weekdayFromIsoDate(
  isoDate: string,
  timezone = TIMEZONE
): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date(`${isoDate}T12:00:00`));
  return WEEKDAY_SHORT_MAP[weekday] ?? 0;
}

export function priceBandForWeekday(
  weekday: number
): "seg_qua" | "qui_sab" | "sunday" {
  if (weekday >= 1 && weekday <= 3) return "seg_qua";
  if (weekday >= 4 && weekday <= 6) return "qui_sab";
  return "sunday";
}

/** @deprecated Mantido para testes de compatibilidade com nomes legados sem weekdayPrices. */
export function serviceMatchesDateBand(
  serviceName: string,
  weekday: number
): boolean {
  const REGEX_SEG_QUA = /Seg\.\s*-\s*Qua\.|Seg\s*-\s*Qua|Seg\.\s*-\s*Quar\./i;
  const REGEX_QUI_SAB = /Qui\.\s*-\s*Sáb\.|Qui\s*-\s*Sab|Qui\.\s*-\s*Sab\./i;
  const hasSegQua = REGEX_SEG_QUA.test(serviceName);
  const hasQuiSab = REGEX_QUI_SAB.test(serviceName);

  if (!hasSegQua && !hasQuiSab) {
    return weekday !== 0;
  }

  if (weekday >= 1 && weekday <= 3) return hasSegQua;
  if (weekday >= 4 && weekday <= 6) return hasQuiSab;
  return false;
}

export function serviceDisplayName(serviceName: string): string {
  return cleanLegacyServiceName(serviceName);
}

export function isShopClosedOnWeekday(
  businessHours: BusinessHourRow[],
  weekday: number
): boolean {
  const day = businessHours.find((row) => row.weekday === weekday);
  return day ? !day.active : true;
}

function servicePricesGrouped(
  service: ShopCatalog["services"][number]
): [number, number[]][] {
  if (service.weekdayPrices.length > 0) {
    return groupWeekdayPrices(service.weekdayPrices);
  }
  return [[service.priceCents, [1, 2, 3, 4, 5, 6]]];
}

function isServiceOfferedOnWeekday(
  service: ShopCatalog["services"][number],
  weekday: number
): boolean {
  if (service.weekdayPrices.length > 0) {
    return priceForWeekday(service.weekdayPrices, weekday) !== null;
  }
  return serviceMatchesDateBand(service.name, weekday);
}

function priceOnWeekday(
  service: ShopCatalog["services"][number],
  weekday: number
): number | null {
  if (service.weekdayPrices.length > 0) {
    return priceForWeekday(service.weekdayPrices, weekday);
  }
  return serviceMatchesDateBand(service.name, weekday)
    ? service.priceCents
    : null;
}

function matchesProfessional(
  service: ShopCatalog["services"][number],
  fullCatalog: ShopCatalog,
  professional?: BookingProfessional | null
): boolean {
  if (!professional) return true;
  const pro = fullCatalog.professionals.find((p) => p.id === professional.id);
  return pro?.serviceIds.includes(service.id) ?? false;
}

function mapBookingService(
  service: ShopCatalog["services"][number],
  weekday?: number
): BookingCatalogService {
  const prices = servicePricesGrouped(service);
  const dayPrice = weekday !== undefined ? priceOnWeekday(service, weekday) : null;

  return {
    id: service.id,
    name: service.name,
    displayName: serviceDisplayName(service.name),
    durationMinutes: service.durationMinutes,
    prices,
    ...(dayPrice !== null ? { priceCents: dayPrice } : {}),
  };
}

export function buildBookingCatalog(
  fullCatalog: ShopCatalog,
  options: {
    date?: string;
    professional?: BookingProfessional | null;
  }
): BookingCatalog {
  const { date, professional } = options;
  const shop = {
    name: fullCatalog.shop.name,
    address: fullCatalog.shop.address,
    whatsapp: fullCatalog.shop.whatsapp,
  };

  const professionals: BookingProfessional[] = professional
    ? [professional]
    : fullCatalog.professionals.map((pro) => ({
        id: pro.id,
        nickname: pro.nickname,
      }));

  if (!date) {
    const services = fullCatalog.services
      .filter((service) => {
        if (service.weekdayPrices.length === 0 && service.priceCents <= 0) {
          return false;
        }
        return matchesProfessional(service, fullCatalog, professional);
      })
      .map((service) => mapBookingService(service));

    return {
      timezone: TIMEZONE,
      dayLabels: BOOKING_DAY_LABELS,
      shop,
      professionals,
      services,
    };
  }

  const weekday = weekdayFromIsoDate(date, TIMEZONE);
  const priceBand = priceBandForWeekday(weekday);
  const shopClosed = isShopClosedOnWeekday(
    fullCatalog.businessHours,
    weekday
  );

  if (shopClosed) {
    return {
      timezone: TIMEZONE,
      dayLabels: BOOKING_DAY_LABELS,
      date,
      weekday,
      priceBand,
      shopClosed: true,
      shop,
      professionals: [],
      services: [],
    };
  }

  const services = fullCatalog.services
    .filter((service) => {
      if (!isServiceOfferedOnWeekday(service, weekday)) return false;
      return matchesProfessional(service, fullCatalog, professional);
    })
    .map((service) => mapBookingService(service, weekday));

  return {
    timezone: TIMEZONE,
    dayLabels: BOOKING_DAY_LABELS,
    date,
    weekday,
    priceBand,
    shopClosed: false,
    shop,
    professionals,
    services,
  };
}
