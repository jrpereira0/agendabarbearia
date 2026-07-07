import { describe, expect, it } from "vitest";
import {
  buildBookingCatalog,
  parseCatalogQuery,
  priceBandForWeekday,
  serviceDisplayName,
  serviceMatchesDateBand,
  weekdayFromIsoDate,
} from "@/lib/catalog-booking";
import type { ShopCatalog } from "@/lib/get-shop-catalog";

function makeBusinessHours(
  sundayActive = false,
  weekdaysActive = true
): ShopCatalog["businessHours"] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][weekday],
    active: weekday === 0 ? sundayActive : weekdaysActive,
    openTime: "09:00",
    closeTime: "19:00",
  }));
}

function makeFixtureCatalog(): ShopCatalog {
  return {
    shop: {
      name: "Dinho Barber Coffee",
      bio: "Bio completa",
      address: "Rua Teste, 123",
      whatsapp: "11999999999",
      instagram: "@dinho",
      logoUrl: "https://example.com/logo.png",
      slotStepMinutes: 30,
    },
    professionals: [
      {
        id: "pro-1",
        nickname: "Junior Barber",
        photoUrl: null,
        serviceIds: ["s1", "s2", "s3", "s4"],
      },
      {
        id: "pro-2",
        nickname: "Dinho",
        photoUrl: null,
        serviceIds: ["s1", "s3", "s4"],
      },
    ],
    services: [
      {
        id: "s1",
        name: "Corte",
        description: "",
        photoUrl: null,
        durationMinutes: 30,
        priceCents: 6000,
        bookingCount: 0,
        weekdayPrices: [
          { weekday: 1, priceCents: 6000 },
          { weekday: 2, priceCents: 6000 },
          { weekday: 3, priceCents: 6000 },
        ],
      },
      {
        id: "s2",
        name: "Corte premium",
        description: "",
        photoUrl: null,
        durationMinutes: 30,
        priceCents: 6500,
        bookingCount: 0,
        weekdayPrices: [
          { weekday: 4, priceCents: 6500 },
          { weekday: 5, priceCents: 6500 },
          { weekday: 6, priceCents: 6500 },
        ],
      },
      {
        id: "s3",
        name: "Sobrancelha",
        description: "",
        photoUrl: null,
        durationMinutes: 15,
        priceCents: 2000,
        bookingCount: 0,
        weekdayPrices: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          priceCents: 2000,
        })),
      },
      {
        id: "s4",
        name: "Corte+Sobrancelha",
        description: "",
        photoUrl: null,
        durationMinutes: 30,
        priceCents: 7000,
        bookingCount: 0,
        weekdayPrices: [
          { weekday: 1, priceCents: 7000 },
          { weekday: 2, priceCents: 7000 },
          { weekday: 3, priceCents: 7000 },
        ],
      },
    ],
    businessHours: makeBusinessHours(false, true),
  };
}

describe("weekdayFromIsoDate", () => {
  it("segunda 2026-07-06 retorna 1", () => {
    expect(weekdayFromIsoDate("2026-07-06")).toBe(1);
  });

  it("sexta 2026-07-10 retorna 5", () => {
    expect(weekdayFromIsoDate("2026-07-10")).toBe(5);
  });

  it("domingo 2026-07-05 retorna 0", () => {
    expect(weekdayFromIsoDate("2026-07-05")).toBe(0);
  });
});

describe("priceBandForWeekday", () => {
  it("segunda a quarta usa seg_qua", () => {
    expect(priceBandForWeekday(1)).toBe("seg_qua");
    expect(priceBandForWeekday(3)).toBe("seg_qua");
  });

  it("quinta a sábado usa qui_sab", () => {
    expect(priceBandForWeekday(4)).toBe("qui_sab");
    expect(priceBandForWeekday(6)).toBe("qui_sab");
  });

  it("domingo usa sunday", () => {
    expect(priceBandForWeekday(0)).toBe("sunday");
  });
});

describe("serviceMatchesDateBand", () => {
  it("segunda inclui Seg-Qua e exclui Qui-Sáb", () => {
    expect(serviceMatchesDateBand("01 - Corte Seg. - Qua.", 1)).toBe(true);
    expect(serviceMatchesDateBand("02 - Corte Qui. - Sáb.", 1)).toBe(false);
  });

  it("sexta inclui Qui-Sáb e exclui Seg-Qua", () => {
    expect(serviceMatchesDateBand("02 - Corte Qui. - Sáb.", 5)).toBe(true);
    expect(serviceMatchesDateBand("01 - Corte Seg. - Qua.", 5)).toBe(false);
  });

  it("serviço sem faixa entra em dia útil", () => {
    expect(serviceMatchesDateBand("Sobrancelha", 2)).toBe(true);
    expect(serviceMatchesDateBand("Sobrancelha", 6)).toBe(true);
  });

  it("serviço sem faixa não entra no domingo", () => {
    expect(serviceMatchesDateBand("Sobrancelha", 0)).toBe(false);
  });

  it("aceita variações de escrita da faixa", () => {
    expect(serviceMatchesDateBand("Corte Seg - Qua", 1)).toBe(true);
    expect(serviceMatchesDateBand("Corte Qui - Sab", 5)).toBe(true);
  });
});

describe("serviceDisplayName", () => {
  it("remove código e faixa Seg-Qua", () => {
    expect(serviceDisplayName("01 - Corte Seg. - Qua.")).toBe("Corte");
  });

  it("remove código e faixa Qui-Sáb", () => {
    expect(serviceDisplayName("02 - Corte Qui. - Sáb.")).toBe("Corte");
  });

  it("mantém nome sem faixa", () => {
    expect(serviceDisplayName("Sobrancelha")).toBe("Sobrancelha");
  });

  it("limpa nomes compostos do seed", () => {
    expect(
      serviceDisplayName("03 - Corte+Sobrancelha Seg. - Qua.")
    ).toBe("Corte+Sobrancelha");
    expect(
      serviceDisplayName("22 - Corte e Barbaterapia Qui. - Sáb.")
    ).toBe("Corte e Barbaterapia");
    expect(
      serviceDisplayName("10 - Barbaterapia+Pigmentação Qui. - Sáb.")
    ).toBe("Barbaterapia+Pigmentação");
  });
});

describe("parseCatalogQuery", () => {
  it("aceita query vazia", () => {
    const result = parseCatalogQuery(new URLSearchParams());
    expect(result).toEqual({ ok: true, data: {} });
  });

  it("rejeita date inválida", () => {
    const result = parseCatalogQuery(new URLSearchParams({ date: "06-07-2026" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("date");
    }
  });

  it("rejeita mode inválido", () => {
    const result = parseCatalogQuery(
      new URLSearchParams({ mode: "full", date: "2026-07-06" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("mode");
    }
  });

  it("rejeita professionalId inválido", () => {
    const result = parseCatalogQuery(
      new URLSearchParams({
        mode: "booking",
        date: "2026-07-06",
        professionalId: "nao-e-uuid",
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("professionalId");
    }
  });

  it("aceita mode=booking sem date (catálogo com preços por dia)", () => {
    const result = parseCatalogQuery(new URLSearchParams({ mode: "booking" }));
    expect(result).toEqual({ ok: true, data: { mode: "booking" } });
  });

  it("aceita mode=booking com date e professionalId", () => {
    const proId = "054a545a-75c8-4807-b72d-5c460bb3539f";
    const result = parseCatalogQuery(
      new URLSearchParams({
        mode: "booking",
        date: "2026-07-06",
        professionalId: proId,
      })
    );
    expect(result).toEqual({
      ok: true,
      data: {
        date: "2026-07-06",
        mode: "booking",
        professionalId: proId,
      },
    });
  });
});

describe("buildBookingCatalog", () => {
  const catalog = makeFixtureCatalog();

  it("segunda filtra serviços Seg-Qua e serviços sem faixa", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-06" });
    const names = result.services.map((s) => s.name);
    expect(names).toContain("Corte");
    expect(names).toContain("Sobrancelha");
    expect(names).toContain("Corte+Sobrancelha");
    expect(names).not.toContain("Corte premium");
    expect(result.priceBand).toBe("seg_qua");
    expect(result.weekday).toBe(1);
    expect(result.shopClosed).toBe(false);
  });

  it("sexta filtra serviços Qui-Sáb e serviços sem faixa", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-10" });
    const names = result.services.map((s) => s.name);
    expect(names).toContain("Corte premium");
    expect(names).toContain("Sobrancelha");
    expect(names).not.toContain("Corte");
    expect(result.priceBand).toBe("qui_sab");
    expect(result.weekday).toBe(5);
  });

  it("domingo com loja fechada retorna shopClosed e listas vazias", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-05" });
    expect(result.shopClosed).toBe(true);
    expect(result.priceBand).toBe("sunday");
    expect(result.weekday).toBe(0);
    expect(result.professionals).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.shop.name).toBe("Dinho Barber Coffee");
  });

  it("filtra serviços pelo profissional informado", () => {
    const result = buildBookingCatalog(catalog, {
      date: "2026-07-06",
      professional: { id: "pro-2", nickname: "Dinho" },
    });
    const ids = result.services.map((s) => s.id);
    expect(ids).toEqual(["s1", "s3", "s4"]);
    expect(result.professionals).toEqual([
      { id: "pro-2", nickname: "Dinho" },
    ]);
  });

  it("omite campos extras do catálogo completo", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-06" });
    expect(result).not.toHaveProperty("businessHours");
    expect(result.dayLabels).toEqual(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]);
    expect(result.shop).toEqual({
      name: "Dinho Barber Coffee",
      address: "Rua Teste, 123",
      whatsapp: "11999999999",
    });
    const corte = result.services.find((s) => s.id === "s1");
    expect(corte?.priceCents).toBe(6000);
    expect(corte?.prices).toEqual([[6000, [1, 2, 3]]]);
    expect(corte).not.toHaveProperty("photoUrl");
    expect(corte).not.toHaveProperty("description");
  });

  it("agrupa preços iguais em faixas compactas", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-06" });
    const sobrancelha = result.services.find((s) => s.id === "s3");
    expect(sobrancelha?.prices).toEqual([[2000, [1, 2, 3, 4, 5, 6]]]);
  });

  it("sem date retorna todos os serviços com prices e sem priceCents", () => {
    const result = buildBookingCatalog(catalog, {});
    expect(result.date).toBeUndefined();
    expect(result.services.length).toBeGreaterThan(0);
    expect(result.services.every((s) => s.prices.length > 0)).toBe(true);
    expect(result.services.every((s) => s.priceCents === undefined)).toBe(true);
  });

  it("retorna o preço do dia correto", () => {
    const monday = buildBookingCatalog(catalog, { date: "2026-07-06" });
    const friday = buildBookingCatalog(catalog, { date: "2026-07-10" });
    const mondayCorte = monday.services.find((s) => s.id === "s1");
    const fridayCorte = friday.services.find((s) => s.id === "s2");
    expect(mondayCorte?.priceCents).toBe(6000);
    expect(fridayCorte?.priceCents).toBe(6500);
  });

  it("retorna todos os profissionais quando professionalId não é informado", () => {
    const result = buildBookingCatalog(catalog, { date: "2026-07-06" });
    expect(result.professionals).toHaveLength(2);
    expect(result.professionals[0]).not.toHaveProperty("photoUrl");
    expect(result.professionals[0]).not.toHaveProperty("serviceIds");
  });
});
