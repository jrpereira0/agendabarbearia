import { WEEKDAYS } from "@/lib/format";

const REGEX_SEG_QUA = /Seg\.\s*-\s*Qua\.|Seg\s*-\s*Qua|Seg\.\s*-\s*Quar\./i;
const REGEX_QUI_SAB = /Qui\.\s*-\s*Sáb\.|Qui\s*-\s*Sab|Qui\.\s*-\s*Sab\./i;

export type ServiceWeekdayPrice = {
  weekday: number;
  priceCents: number;
};

export type WeekdayPriceInput = {
  weekday: number;
  priceCents: number | null;
  shopOpen: boolean;
};

export function cleanLegacyServiceName(serviceName: string): string {
  let name = serviceName.replace(/^\d+\s*-\s*/, "");
  name = name.replace(REGEX_SEG_QUA, "");
  name = name.replace(REGEX_QUI_SAB, "");
  return name.trim().replace(/\s+/g, " ");
}

export function inferLegacyWeekdays(
  serviceName: string,
  openWeekdays: number[]
): number[] {
  const hasSegQua = REGEX_SEG_QUA.test(serviceName);
  const hasQuiSab = REGEX_QUI_SAB.test(serviceName);

  if (!hasSegQua && !hasQuiSab) {
    return openWeekdays.filter((weekday) => weekday !== 0);
  }

  const band = hasSegQua ? [1, 2, 3] : [4, 5, 6];
  return band.filter((weekday) => openWeekdays.includes(weekday));
}

export function buildWeekdayPricesFromLegacy(
  serviceName: string,
  priceCents: number,
  openWeekdays: number[]
): ServiceWeekdayPrice[] {
  return inferLegacyWeekdays(serviceName, openWeekdays).map((weekday) => ({
    weekday,
    priceCents,
  }));
}

export function priceForWeekday(
  prices: ServiceWeekdayPrice[],
  weekday: number
): number | null {
  return prices.find((row) => row.weekday === weekday)?.priceCents ?? null;
}

export function isOfferedOnWeekday(
  prices: ServiceWeekdayPrice[],
  weekday: number
): boolean {
  return priceForWeekday(prices, weekday) !== null;
}

export function minWeekdayPrice(prices: ServiceWeekdayPrice[]): number {
  if (prices.length === 0) return 0;
  return Math.min(...prices.map((row) => row.priceCents));
}

export function mergeWeekdayPrices(
  groups: ServiceWeekdayPrice[][]
): ServiceWeekdayPrice[] {
  const map = new Map<number, number>();
  for (const group of groups) {
    for (const row of group) {
      map.set(row.weekday, row.priceCents);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, priceCents]) => ({ weekday, priceCents }));
}

export function parseWeekdayPricesForm(
  formData: FormData,
  openWeekdays: number[]
):
  | { ok: true; prices: ServiceWeekdayPrice[] }
  | { ok: false; error: string } {
  const prices: ServiceWeekdayPrice[] = [];

  for (let weekday = 0; weekday <= 6; weekday++) {
    if (!openWeekdays.includes(weekday)) continue;

    const offered = formData.get(`weekdayOffered_${weekday}`) === "on";
    if (!offered) continue;

    const raw = String(formData.get(`weekdayPriceCents_${weekday}`) ?? "").trim();
    const priceCents = Number(raw);
    if (!Number.isInteger(priceCents) || priceCents < 1) {
      return {
        ok: false,
        error: `Informe o preço de ${WEEKDAYS[weekday]}.`,
      };
    }

    prices.push({ weekday, priceCents });
  }

  if (prices.length === 0) {
    return {
      ok: false,
      error: "Marque pelo menos um dia da semana com preço.",
    };
  }

  return { ok: true, prices };
}

export function weekdayPriceInputsFromRows(
  prices: ServiceWeekdayPrice[],
  businessHours: { weekday: number; active: boolean }[]
): WeekdayPriceInput[] {
  const priceByWeekday = new Map(
    prices.map((row) => [row.weekday, row.priceCents])
  );

  return Array.from({ length: 7 }, (_, weekday) => {
    const shopOpen =
      businessHours.find((row) => row.weekday === weekday)?.active ?? false;
    return {
      weekday,
      shopOpen,
      priceCents: priceByWeekday.get(weekday) ?? null,
    };
  });
}
