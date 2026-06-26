import { describe, expect, it } from "vitest";
import { calculateComandaTotals, sumPayments } from "@/lib/comanda-types";

describe("calculateComandaTotals", () => {
  it("soma valores e calcula comissão por item", () => {
    const result = calculateComandaTotals(
      [{ chargedPriceCents: 4000 }, { chargedPriceCents: 6000 }],
      50
    );
    expect(result.totalCents).toBe(10000);
    expect(result.commissionCents).toBe(5000);
  });

  it("arredonda comissão de cada linha", () => {
    const result = calculateComandaTotals([{ chargedPriceCents: 3333 }], 50);
    expect(result.totalCents).toBe(3333);
    expect(result.commissionCents).toBe(1667);
  });

  it("comissão zero quando percentual é zero", () => {
    const result = calculateComandaTotals([{ chargedPriceCents: 5000 }], 0);
    expect(result.commissionCents).toBe(0);
  });
});

describe("sumPayments", () => {
  it("soma pagamentos mistos", () => {
    expect(
      sumPayments([
        { amountCents: 5000 },
        { amountCents: 5000 },
      ])
    ).toBe(10000);
  });
});
