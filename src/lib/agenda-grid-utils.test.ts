import { describe, expect, it } from "vitest";
import {
  agendaLayoutStepMinutes,
  appointmentGridRows,
  rowHeightForLayoutStep,
  rowHeightForStep,
} from "@/lib/agenda-grid-utils";

describe("agendaLayoutStepMinutes", () => {
  it("usa 5 min quando o intervalo é múltiplo de 5", () => {
    expect(agendaLayoutStepMinutes(15)).toBe(5);
    expect(agendaLayoutStepMinutes(30)).toBe(5);
    expect(agendaLayoutStepMinutes(60)).toBe(5);
  });
});

describe("appointmentGridRows com duração real", () => {
  const gridStart = 9 * 60;
  const gridEnd = 18 * 60;

  it("serviço de 10 min ocupa 2 linhas de 5 min (não um slot de 30)", () => {
    const rows = appointmentGridRows(
      "10:00",
      "10:10",
      gridStart,
      gridEnd,
      5
    );
    expect(rows).toEqual({
      rowStart: Math.floor((10 * 60 - gridStart) / 5) + 2,
      rowEnd: Math.ceil((10 * 60 + 10 - gridStart) / 5) + 2,
      rowSpan: 2,
    });
  });

  it("serviço de 30 min ocupa 6 linhas de 5 min", () => {
    const rows = appointmentGridRows(
      "10:00",
      "10:30",
      gridStart,
      gridEnd,
      5
    );
    expect(rows?.rowSpan).toBe(6);
  });

  it("na grade antiga de 30 min, 10 min virava 1 linha inteira", () => {
    const rows = appointmentGridRows(
      "10:00",
      "10:10",
      gridStart,
      gridEnd,
      30
    );
    expect(rows?.rowSpan).toBe(1);
  });
});

describe("rowHeightForLayoutStep", () => {
  it("mantém a altura total do dia próxima da grade por slot", () => {
    const slotStep = 30;
    const layoutStep = 5;
    const rowsPerSlot = slotStep / layoutStep;
    const layoutHeight = rowHeightForLayoutStep(layoutStep, slotStep);
    const slotHeight = rowHeightForStep(slotStep);
    expect(Math.abs(layoutHeight * rowsPerSlot - slotHeight)).toBeLessThanOrEqual(
      rowsPerSlot
    );
  });
});
