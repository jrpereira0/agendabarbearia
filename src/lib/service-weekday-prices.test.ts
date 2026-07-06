import { describe, expect, it } from "vitest";
import {
  buildWeekdayPricesFromLegacy,
  cleanLegacyServiceName,
  groupWeekdayPrices,
  inferLegacyWeekdays,
  minWeekdayPrice,
  parseWeekdayPricesForm,
  priceForWeekday,
} from "@/lib/service-weekday-prices";

const OPEN_WEEKDAYS = [1, 2, 3, 4, 5, 6];

describe("cleanLegacyServiceName", () => {
  it("remove código e faixa do nome", () => {
    expect(cleanLegacyServiceName("01 - Corte Seg. - Qua.")).toBe("Corte");
  });
});

describe("inferLegacyWeekdays", () => {
  it("seg-qua retorna segunda a quarta", () => {
    expect(inferLegacyWeekdays("Corte Seg. - Qua.", OPEN_WEEKDAYS)).toEqual([
      1, 2, 3,
    ]);
  });

  it("qui-sab retorna quinta a sábado", () => {
    expect(inferLegacyWeekdays("Corte Qui. - Sáb.", OPEN_WEEKDAYS)).toEqual([
      4, 5, 6,
    ]);
  });

  it("sem faixa retorna dias abertos exceto domingo", () => {
    expect(inferLegacyWeekdays("Sobrancelha", OPEN_WEEKDAYS)).toEqual(
      OPEN_WEEKDAYS
    );
  });
});

describe("buildWeekdayPricesFromLegacy", () => {
  it("monta preços por dia a partir do nome legado", () => {
    const prices = buildWeekdayPricesFromLegacy(
      "01 - Corte Seg. - Qua.",
      6000,
      OPEN_WEEKDAYS
    );
    expect(prices).toEqual([
      { weekday: 1, priceCents: 6000 },
      { weekday: 2, priceCents: 6000 },
      { weekday: 3, priceCents: 6000 },
    ]);
    expect(priceForWeekday(prices, 5)).toBeNull();
    expect(minWeekdayPrice(prices)).toBe(6000);
  });
});

describe("groupWeekdayPrices", () => {
  it("agrupa dias com o mesmo preço", () => {
    const grouped = groupWeekdayPrices([
      { weekday: 1, priceCents: 6000 },
      { weekday: 2, priceCents: 6000 },
      { weekday: 4, priceCents: 6500 },
      { weekday: 5, priceCents: 6500 },
    ]);
    expect(grouped).toEqual([
      [6000, [1, 2]],
      [6500, [4, 5]],
    ]);
  });
});

describe("parseWeekdayPricesForm", () => {
  it("valida ao menos um dia com preço", () => {
    const formData = new FormData();
    const result = parseWeekdayPricesForm(formData, OPEN_WEEKDAYS);
    expect(result.ok).toBe(false);
  });

  it("aceita dias marcados com preço", () => {
    const formData = new FormData();
    formData.set("weekdayOffered_1", "on");
    formData.set("weekdayPriceCents_1", "6000");
    formData.set("weekdayOffered_2", "on");
    formData.set("weekdayPriceCents_2", "6500");

    const result = parseWeekdayPricesForm(formData, OPEN_WEEKDAYS);
    expect(result).toEqual({
      ok: true,
      prices: [
        { weekday: 1, priceCents: 6000 },
        { weekday: 2, priceCents: 6500 },
      ],
    });
  });
});
