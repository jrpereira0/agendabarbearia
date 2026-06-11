import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
};

// Cabeçalho padrão de todas as páginas do painel.
export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {backHref && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 text-muted-foreground"
          >
            <Link href={backHref}>
              <ArrowLeft />
              {backLabel ?? "Voltar"}
            </Link>
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
