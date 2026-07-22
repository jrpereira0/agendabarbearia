import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  /** "dark" = identidade agenda/login. */
  tone?: "default" | "dark";
};

// Cabeçalho padrão de todas as páginas do painel.
export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  action,
  tone = "default",
}: PageHeaderProps) {
  const dark = tone === "dark";

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {backHref ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "-ml-2 mb-2",
              dark
                ? cn(ADMIN_SURFACE.btnGhost, "border-transparent bg-transparent")
                : "text-muted-foreground"
            )}
          >
            <Link href={backHref}>
              <ArrowLeft />
              {backLabel ?? "Voltar"}
            </Link>
          </Button>
        ) : null}
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight",
            dark && "text-[#f5f5f5]"
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-1 text-sm",
              dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
