import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type FormSectionTitleProps = {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** "dark" = identidade agenda/login. */
  tone?: "default" | "dark";
};

// Título de seção padrão dos formulários do painel.
export function FormSectionTitle({
  icon: Icon,
  title,
  description,
  tone = "default",
}: FormSectionTitleProps) {
  const dark = tone === "dark";

  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md border",
          dark
            ? "border-white/10 bg-[#1a1b1e] text-[#ecf15e]"
            : "bg-muted/50"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <h2
          className={cn(
            "text-sm font-semibold leading-9",
            dark && "text-[#f5f5f5]"
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "-mt-2 text-sm",
              dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
