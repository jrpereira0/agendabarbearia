import { describe, expect, it } from "vitest";
import { earliestBookableDate } from "@/lib/availability";

const weekOpen = [
  { weekday: 0, active: false, closeTime: "18:00" },
  { weekday: 1, active: true, closeTime: "19:00" },
  { weekday: 2, active: true, closeTime: "19:00" },
  { weekday: 3, active: true, closeTime: "19:00" },
  { weekday: 4, active: true, closeTime: "19:00" },
  { weekday: 5, active: true, closeTime: "19:00" },
  { weekday: 6, active: true, closeTime: "18:00" },
];

describe("earliestBookableDate", () => {
  it("mantém hoje enquanto o expediente ainda está aberto", () => {
    // 2026-07-28 = terça
    expect(
      earliestBookableDate({
        today: "2026-07-28",
        nowMinutes: 18 * 60,
        businessHours: weekOpen,
      })
    ).toBe("2026-07-28");
  });

  it("pula pra amanhã depois do fechamento", () => {
    expect(
      earliestBookableDate({
        today: "2026-07-28",
        nowMinutes: 19 * 60,
        businessHours: weekOpen,
      })
    ).toBe("2026-07-29");
  });

  it("pula domingo fechado quando sábado já encerrou", () => {
    // 2026-07-25 = sábado
    expect(
      earliestBookableDate({
        today: "2026-07-25",
        nowMinutes: 18 * 60,
        businessHours: weekOpen,
      })
    ).toBe("2026-07-27");
  });

  it("pula o dia atual quando a loja não abre", () => {
    // 2026-07-26 = domingo
    expect(
      earliestBookableDate({
        today: "2026-07-26",
        nowMinutes: 10 * 60,
        businessHours: weekOpen,
      })
    ).toBe("2026-07-27");
  });
});
