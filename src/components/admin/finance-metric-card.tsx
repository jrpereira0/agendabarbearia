import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type FinanceMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tooltip?: ReactNode;
  className?: string;
  /** "dark" = identidade agenda/login; default = tema claro do financeiro. */
  tone?: "default" | "dark";
  /** Torna o card clicável (sem envolver em <button> externo). */
  onSelect?: () => void;
};

/** Card de métrica padrão das telas de financeiro, caixa e comissões. */
export function FinanceMetricCard({
  label,
  value,
  hint,
  tooltip,
  className,
  tone = "default",
  onSelect,
}: FinanceMetricCardProps) {
  const dark = tone === "dark";
  const clickable = Boolean(onSelect);

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
            "text-xs sm:text-sm",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {label}
        </p>
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
      <p
        data-slot="finance-metric-value"
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-3xl",
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
  );
}
