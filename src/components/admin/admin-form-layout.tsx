"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type AdminFormTone = "default" | "dark";

export function AdminFormPage({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: AdminFormTone;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5 pb-28",
        tone === "dark" && "text-[#f5f5f5]"
      )}
    >
      {children}
    </div>
  );
}

type AdminFormSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: AdminFormTone;
};

export function AdminFormSectionCard({
  title,
  description,
  children,
  className,
  tone = "default",
}: AdminFormSectionCardProps) {
  const dark = tone === "dark";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border",
        dark
          ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
          : "bg-card shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "border-b px-5 py-4",
          dark ? "border-white/10 bg-white/[0.03]" : "bg-muted/20"
        )}
      >
        <h2
          className={cn(
            "text-sm font-semibold",
            dark ? "text-[#f5f5f5]" : "text-foreground"
          )}
        >
          {title}
        </h2>
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
  tone?: AdminFormTone;
};

export function AdminFormActions({
  onCancel,
  submitLabel,
  saving = false,
  disabled = false,
  tone = "default",
}: AdminFormActionsProps) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-8 -mx-4 border-t px-4 py-3 backdrop-blur md:-mx-8 md:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        dark ? "border-white/10 bg-[#0e0f11]/95" : "bg-background/95"
      )}
    >
      <div className="flex w-full items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className={cn(
            "h-10 min-w-24 sm:h-8",
            dark && ADMIN_SURFACE.btnGhost
          )}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving || disabled}
          className={cn(
            "h-10 min-w-40 sm:h-8",
            dark && ADMIN_SURFACE.btnPrimary
          )}
        >
          {saving ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
