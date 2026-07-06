import { z } from "zod";
import { TIMEZONE } from "@/lib/availability";
import type { BusinessHourRow, ShopCatalog } from "@/lib/get-shop-catalog";
import {
  cleanLegacyServiceName,
  isOfferedOnWeekday,
  priceForWeekday,
} from "@/lib/service-weekday-prices";

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
  priceCents: number;
};

export type BookingCatalog = {
  timezone: string;
  date: string;
  weekday: number;
  priceBand: "seg_qua" | "qui_sab" | "sunday";
  shopClosed: boolean;
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

  if (options.mode === "booking" && !options.date) {
    return {
      ok: false,
      error: "Parâmetro 'date' é obrigatório no modo 'booking'.",
      status: 400,
    };
  }

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

export function buildBookingCatalog(
  fullCatalog: ShopCatalog,
  options: {
    date: string;
    professional?: BookingProfessional | null;
  }
): BookingCatalog {
  const { date, professional } = options;
  const weekday = weekdayFromIsoDate(date, TIMEZONE);
  const priceBand = priceBandForWeekday(weekday);
  const shopClosed = isShopClosedOnWeekday(
    fullCatalog.businessHours,
    weekday
  );

  if (shopClosed) {
    return {
      timezone: TIMEZONE,
      date,
      weekday,
      priceBand,
      shopClosed: true,
      shop: {
        name: fullCatalog.shop.name,
        address: fullCatalog.shop.address,
        whatsapp: fullCatalog.shop.whatsapp,
      },
      professionals: [],
      services: [],
    };
  }

  const filteredServices = fullCatalog.services
    .filter((service) => {
      const dayPrice =
        service.weekdayPrices.length > 0
          ? priceForWeekday(service.weekdayPrices, weekday)
          : serviceMatchesDateBand(service.name, weekday)
            ? service.priceCents
            : null;
      if (dayPrice === null) return false;

      if (!professional) return true;
      const pro = fullCatalog.professionals.find((p) => p.id === professional.id);
      return pro?.serviceIds.includes(service.id) ?? false;
    })
    .map((service) => {
      const dayPrice =
        service.weekdayPrices.length > 0
          ? priceForWeekday(service.weekdayPrices, weekday)!
          : service.priceCents;

      return {
        id: service.id,
        name: service.name,
        displayName: serviceDisplayName(service.name),
        durationMinutes: service.durationMinutes,
        priceCents: dayPrice,
      };
    });

  const professionals: BookingProfessional[] = professional
    ? [professional]
    : fullCatalog.professionals.map((pro) => ({
        id: pro.id,
        nickname: pro.nickname,
      }));

  return {
    timezone: TIMEZONE,
    date,
    weekday,
    priceBand,
    shopClosed: false,
    shop: {
      name: fullCatalog.shop.name,
      address: fullCatalog.shop.address,
      whatsapp: fullCatalog.shop.whatsapp,
    },
    professionals,
    services: filteredServices,
  };
}
