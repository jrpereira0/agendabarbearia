import { describe, expect, it } from "vitest";
import {
  clippedMinutesInRanges,
  subtractRanges,
  sumRangeMinutes,
  type MinuteRange,
} from "@/lib/availability";

describe("subtractRanges", () => {
  it("remove um bloqueio no meio da faixa", () => {
    const ranges: MinuteRange[] = [{ start: 540, end: 720 }];
    const result = subtractRanges(ranges, [{ start: 600, end: 660 }]);
    expect(result).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 720 },
    ]);
  });

  it("ignora bloqueio sem sobreposição", () => {
    const ranges: MinuteRange[] = [{ start: 540, end: 720 }];
    expect(subtractRanges(ranges, [{ start: 800, end: 860 }])).toEqual(ranges);
  });
});

describe("sumRangeMinutes / clippedMinutesInRanges", () => {
  it("soma minutos das faixas", () => {
    expect(
      sumRangeMinutes([
        { start: 540, end: 600 },
        { start: 660, end: 720 },
      ])
    ).toBe(120);
  });

  it("clipa agendamento à capacidade", () => {
    expect(
      clippedMinutesInRanges(
        { start: 530, end: 580 },
        [{ start: 540, end: 720 }]
      )
    ).toBe(40);
  });
});
