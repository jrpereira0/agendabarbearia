import { describe, expect, it } from "vitest";
import {
  calculateComandaTotals,
  calculateComandaTotalsByProfessional,
  calculateItemCommissionCents,
} from "@/lib/comanda-types";

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

describe("calculateComandaTotalsByProfessional", () => {
  it("gorjeta vai 100% para o barbeiro", () => {
    const commissions = new Map([["pro-1", 50]]);
    const result = calculateComandaTotalsByProfessional(
      [
        { chargedPriceCents: 6000, professionalId: "pro-1" },
        {
          chargedPriceCents: 1000,
          professionalId: "pro-1",
          isTip: true,
        },
      ],
      commissions
    );
    expect(result.totalCents).toBe(7000);
    expect(result.commissionCents).toBe(4000);
  });

  it("produto com comissão 0% não gera comissão do barbeiro", () => {
    const commissions = new Map([["pro-1", 50]]);
    const result = calculateComandaTotalsByProfessional(
      [
        { chargedPriceCents: 6000, professionalId: "pro-1" },
        {
          chargedPriceCents: 700,
          professionalId: "pro-1",
          productId: "cafe-1",
          commissionPercentSnapshot: 0,
        },
      ],
      commissions
    );
    expect(result.totalCents).toBe(6700);
    // só o serviço a 50%; café com 0% não entra
    expect(result.commissionCents).toBe(3000);
  });
});

describe("calculateItemCommissionCents", () => {
  it("respeita snapshot 0% de produto mesmo com barbeiro a 50%", () => {
    const cents = calculateItemCommissionCents(
      {
        chargedPriceCents: 700,
        professionalId: "pro-1",
        productId: "cafe-1",
        commissionPercentSnapshot: 0,
      },
      new Map([["pro-1", 50]])
    );
    expect(cents).toBe(0);
  });

  it("produto sem barbeiro não gera comissão", () => {
    const cents = calculateItemCommissionCents(
      {
        chargedPriceCents: 5000,
        professionalId: null,
        productId: "pomada-1",
        commissionPercentSnapshot: 40,
      },
      new Map([["pro-1", 50]])
    );
    expect(cents).toBe(0);
  });
});
