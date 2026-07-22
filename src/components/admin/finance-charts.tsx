"use client";

import { formatPriceBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type BarChartItem = {
  label: string;
  value: number;
  sublabel?: string;
};

export function HorizontalBarChart({
  items,
  maxValue,
  className,
  formatValue = formatPriceBRL,
}: {
  items: BarChartItem[];
  maxValue?: number;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const max = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => {
        const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{item.label}</span>
                {item.sublabel && (
                  <span className="ml-1.5 text-xs text-[#b4b6bb]">
                    {item.sublabel}
                  </span>
                )}
              </div>
              <span className="shrink-0 tabular-nums font-medium">
                {formatValue(item.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#ecf15e] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VerticalBarChart({
  items,
  maxValue,
  height = 160,
  className,
  formatValue = formatPriceBRL,
}: {
  items: BarChartItem[];
  maxValue?: number;
  height?: number;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const max = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="flex items-end justify-between gap-1 sm:gap-2"
        style={{ height }}
      >
        {items.map((item) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          const barHeight = item.value > 0 ? Math.max(pct, 4) : 0;
          return (
            <div
              key={item.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <span className="text-[10px] font-medium tabular-nums text-[#b4b6bb] sm:text-xs">
                {item.value > 0 ? formatValue(item.value) : "—"}
              </span>
              <div
                className="flex w-full max-w-10 items-end justify-center sm:max-w-12"
                style={{ height: height - (item.sublabel ? 48 : 36) }}
              >
                <div
                  className="w-full max-w-8 rounded-t-sm bg-[#ecf15e] transition-all"
                  style={{ height: `${barHeight}%` }}
                  title={`${item.label}: ${formatValue(item.value)}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] text-[#b4b6bb] sm:text-xs">
                {item.label}
              </span>
              {item.sublabel ? (
                <span className="w-full truncate text-center text-[10px] text-[#8b8d93]">
                  {item.sublabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DonutSlice = {
  label: string;
  value: number;
  className?: string;
};

export function DonutChart({
  slices,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerValue,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          {total > 0 &&
            slices.map((slice, index) => {
              const pct = slice.value / total;
              const dash = pct * circumference;
              const gap = circumference - dash;
              const currentOffset = offset;
              offset += dash;
              return (
                <circle
                  key={`${slice.label}-${index}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                  className={slice.className ?? "text-foreground"}
                />
              );
            })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && (
              <span className="text-sm font-semibold tabular-nums sm:text-base">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-[#b4b6bb] sm:text-xs">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-1">
        {slices.map((slice, index) => {
          const pct =
            total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <div
              key={`${slice.label}-legend-${index}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full bg-white/40",
                    slice.className
                  )}
                />
                <span className="truncate text-[#f5f5f5]">{slice.label}</span>
              </div>
              <span className="shrink-0 tabular-nums text-[#b4b6bb]">
                {formatPriceBRL(slice.value)} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SparklineBars({
  values,
  height = 48,
  className,
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(...values, 1);

  return (
    <div
      className={cn("flex items-end gap-0.5", className)}
      style={{ height }}
    >
      {values.map((value, index) => {
        const pct = value > 0 ? Math.max((value / max) * 100, 8) : 0;
        return (
          <div
            key={index}
            className="min-w-[3px] flex-1 rounded-sm bg-[#ecf15e]"
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
