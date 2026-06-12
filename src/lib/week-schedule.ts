export type TimeRange = { startTime: string; endTime: string };
export type DayRanges = { weekday: number; ranges: TimeRange[] };

export function emptyWeek(): DayRanges[] {
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, ranges: [] }));
}

// Garante os 7 dias na ordem, preenchendo os que não vieram do banco.
export function fillWeek(days: DayRanges[]): DayRanges[] {
  return emptyWeek().map(
    (empty) => days.find((d) => d.weekday === empty.weekday) ?? empty
  );
}
