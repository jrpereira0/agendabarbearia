import { describe, expect, it } from "vitest";
import { formatPriceBRL } from "@/lib/format";
import {
  formatPublicServicePriceLabel,
  formatPublicServicesTotalLabel,
  formatServiceCatalogPriceLabel,
  publicServicePriceCents,
} from "@/lib/public-service-prices";
import type { PublicService } from "@/lib/get-shop-catalog";

function makeService(
  overrides: Partial<PublicService> & Pick<PublicService, "id" | "name">
): PublicService {
  return {
    description: "",
    photoUrl: null,
    photoPosition: "50% 50%",
    durationMinutes: 30,
    priceCents: 6000,
    priceFrom: false,
    weekdayPrices: [],
    bookingCount: 0,
    ...overrides,
  };
}

describe("public-service-prices", () => {
  it("mostra faixa Seg–Qua e Qui–Sáb sem data", () => {
    const service = makeService({
      id: "s1",
      name: "Corte",
      priceCents: 6000,
      weekdayPrices: [
        { weekday: 1, priceCents: 6000 },
        { weekday: 2, priceCents: 6000 },
        { weekday: 3, priceCents: 6000 },
        { weekday: 4, priceCents: 7000 },
        { weekday: 5, priceCents: 7000 },
        { weekday: 6, priceCents: 7000 },
      ],
    });

    expect(formatPublicServicePriceLabel(service)).toBe(
      `Seg–Qua ${formatPriceBRL(6000)} · Qui–Sáb ${formatPriceBRL(7000)}`
    );
  });

  it("mostra faixa de preço quando varia fora de Seg–Qua / Qui–Sáb", () => {
    const service = makeService({
      id: "s2",
      name: "Barba",
      priceCents: 5000,
      weekdayPrices: [
        { weekday: 1, priceCents: 5000 },
        { weekday: 4, priceCents: 6000 },
      ],
    });

    expect(formatPublicServicePriceLabel(service)).toBe(
      `${formatPriceBRL(5000)} – ${formatPriceBRL(6000)}`
    );
  });

  it("mostra a partir de quando o serviço tem preço variável no atendimento", () => {
    const service = makeService({
      id: "s3",
      name: "Progressiva",
      priceCents: 15000,
      priceFrom: true,
      weekdayPrices: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        priceCents: 15000,
      })),
    });

    expect(formatPublicServicePriceLabel(service)).toBe(
      `a partir de ${formatPriceBRL(15000)}`
    );
    expect(formatServiceCatalogPriceLabel(15000, service.weekdayPrices, true)).toBe(
      `a partir de ${formatPriceBRL(15000)}`
    );
  });

  it("mostra preço exato quando a data está definida", () => {
    const service = makeService({
      id: "s1",
      name: "Corte",
      priceCents: 6000,
      weekdayPrices: [
        { weekday: 1, priceCents: 6000 },
        { weekday: 4, priceCents: 7000 },
      ],
    });

    expect(publicServicePriceCents(service, "2026-07-06")).toBe(6000);
    expect(formatPublicServicePriceLabel(service, "2026-07-06")).toBe(
      formatPriceBRL(6000)
    );
    expect(publicServicePriceCents(service, "2026-07-09")).toBe(7000);
  });

  it("mantém a partir de mesmo com data quando o preço varia no atendimento", () => {
    const service = makeService({
      id: "s3",
      name: "Progressiva",
      priceCents: 15000,
      priceFrom: true,
      weekdayPrices: [{ weekday: 4, priceCents: 15000 }],
    });

    expect(formatPublicServicePriceLabel(service, "2026-07-09")).toBe(
      `a partir de ${formatPriceBRL(15000)}`
    );
  });

  it("marca total como a partir de quando ainda não há data", () => {
    const services = [
      makeService({
        id: "s1",
        name: "Corte",
        weekdayPrices: [
          { weekday: 1, priceCents: 6000 },
          { weekday: 4, priceCents: 7000 },
        ],
      }),
    ];

    expect(formatPublicServicesTotalLabel(services)).toBe(
      `a partir de ${formatPriceBRL(6000)}`
    );
    expect(formatPublicServicesTotalLabel(services, "2026-07-09")).toBe(
      formatPriceBRL(7000)
    );
  });

  it("marca total como a partir de quando há serviço com preço variável", () => {
    const services = [
      makeService({
        id: "s1",
        name: "Corte",
        priceCents: 6000,
        weekdayPrices: [{ weekday: 1, priceCents: 6000 }],
      }),
      makeService({
        id: "s2",
        name: "Progressiva",
        priceCents: 15000,
        priceFrom: true,
        weekdayPrices: [{ weekday: 1, priceCents: 15000 }],
      }),
    ];

    expect(formatPublicServicesTotalLabel(services, "2026-07-06")).toBe(
      `a partir de ${formatPriceBRL(21000)}`
    );
  });
});
