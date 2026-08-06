import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, CircleHelp, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FinanceTrend } from "@/lib/finance-metrics";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type FinanceMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tooltip?: ReactNode;
  /** Mini-gráfico ou marca visual ao lado do número. */
  visual?: ReactNode;
  className?: string;
  /** "dark" = identidade agenda/login; default = tema claro do financeiro. */
  tone?: "default" | "dark";
  /** Torna o card clicável (sem envolver em <button> externo). */
  onSelect?: () => void;
  /** Variação vs. o período anterior equivalente. */
  trend?: FinanceTrend;
};

const TREND_ICONS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** Card de métrica padrão das telas de financeiro, caixa e comissões. */
export function FinanceMetricCard({
  label,
  value,
  hint,
  tooltip,
  visual,
  className,
  tone = "default",
  onSelect,
  trend,
}: FinanceMetricCardProps) {
  const dark = tone === "dark";
  const clickable = Boolean(onSelect);
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  return (
    <div
      data-slot="finance-metric-card"
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-xl border px-3.5 py-3 sm:px-5 sm:py-4",
        dark ? ADMIN_SURFACE.panel : "bg-card",
        clickable &&
          "cursor-pointer transition-colors hover:border-[#ecf15e]/35",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-xs sm:text-sm",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {label}
        </p>
        {TrendIcon ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums sm:text-xs",
              dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
            )}
          >
            <TrendIcon className="size-3" />
            {trend?.label}
          </span>
        ) : null}
        {tooltip ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-4 items-center justify-center transition",
                  dark
                    ? "text-[#b4b6bb] hover:text-[#f5f5f5]"
                    : "text-muted-foreground/70 hover:text-foreground"
                )}
                aria-label={`Explicar ${label.toLowerCase()}`}
                onClick={(event) => event.stopPropagation()}
              >
                <CircleHelp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-1 flex items-end gap-3",
          visual ? "justify-between" : null
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            data-slot="finance-metric-value"
            className={cn(
              "text-xl font-semibold tabular-nums tracking-tight sm:text-3xl",
              dark && "text-[#f5f5f5]"
            )}
          >
            {value}
          </p>
          {hint ? (
            <p
              className={cn(
                "mt-1 text-[11px] leading-snug sm:text-xs",
                dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {visual ? <div className="shrink-0 pb-0.5">{visual}</div> : null}
      </div>
    </div>
  );
}
