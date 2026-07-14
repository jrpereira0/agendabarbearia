"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminFormPage({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-6 pb-28">{children}</div>;
}

type AdminFormSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AdminFormSectionCard({
  title,
  description,
  children,
  className,
}: AdminFormSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        className
      )}
    >
      <div className="border-b bg-muted/20 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AdminFormFields({
  children,
  columns = 1,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

type AdminFormActionsProps = {
  onCancel: () => void;
  submitLabel: string;
  saving?: boolean;
  disabled?: boolean;
};

export function AdminFormActions({
  onCancel,
  submitLabel,
  saving = false,
  disabled = false,
}: AdminFormActionsProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-10 min-w-24 sm:h-8"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving || disabled}
          className="h-10 min-w-40 sm:h-8"
        >
          {saving ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
