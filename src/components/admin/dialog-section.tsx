import type { LucideIcon } from "lucide-react";
import { FormSectionTitle } from "@/components/admin/form-section";
import { cn } from "@/lib/utils";

type DialogSectionProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
};

/** Bloco de seção para modais do painel — borda, cabeçalho e fundo leve. */
export function DialogSection({
  icon,
  title,
  description,
  children,
  className,
  headerAction,
}: DialogSectionProps) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div
        className={cn(
          "border-b bg-muted/25 px-4 py-3.5 sm:px-5",
          headerAction
            ? "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            : undefined
        )}
      >
        <FormSectionTitle icon={icon} title={title} description={description} />
        {headerAction}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
