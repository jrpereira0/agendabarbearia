import { describe, expect, it } from "vitest";
import { flagComandaItemsNeedingSqueeze } from "@/lib/comanda-service";

describe("flagComandaItemsNeedingSqueeze", () => {
  it("mantém serviços do agendamento principal no card principal", () => {
    const flags = flagComandaItemsNeedingSqueeze(
      [
        { serviceId: "corte" },
        { serviceId: "barba" },
        { serviceId: "sobrancelha" },
      ],
      ["corte", "barba"]
    );

    expect(flags).toEqual([false, false, true]);
  });

  it("marca serviço repetido além do agendamento como encaixe", () => {
    const flags = flagComandaItemsNeedingSqueeze(
      [{ serviceId: "corte" }, { serviceId: "corte" }],
      ["corte"]
    );

    expect(flags).toEqual([false, true]);
  });
});
