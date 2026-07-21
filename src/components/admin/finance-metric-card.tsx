import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FinanceMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tooltip?: ReactNode;
  className?: string;
};

/** Card de métrica padrão das telas de financeiro, caixa e comissões. */
export function FinanceMetricCard({
  label,
  value,
  hint,
  tooltip,
  className,
}: FinanceMetricCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-5 py-4", className)}>
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {tooltip ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center text-muted-foreground/70 transition hover:text-foreground"
                aria-label={`Explicar ${label.toLowerCase()}`}
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
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
