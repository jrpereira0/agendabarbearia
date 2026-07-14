import { cn } from "@/lib/utils";

type FinanceMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

/** Card de métrica padrão das telas de financeiro, caixa e comissões. */
export function FinanceMetricCard({
  label,
  value,
  hint,
  className,
}: FinanceMetricCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-5 py-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
