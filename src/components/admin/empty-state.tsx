type EmptyStateProps = {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
};

// Estado vazio padrão das listagens do painel.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border bg-muted/50">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
