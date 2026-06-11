type FormSectionTitleProps = {
  icon: React.ElementType;
  title: string;
  description?: string;
};

// Título de seção padrão dos formulários do painel.
export function FormSectionTitle({
  icon: Icon,
  title,
  description,
}: FormSectionTitleProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold leading-9">{title}</h2>
        {description && (
          <p className="-mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
