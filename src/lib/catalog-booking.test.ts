import { describe, expect, it } from "vitest";
import { serviceMatchesDateBand } from "@/lib/catalog-booking";

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
