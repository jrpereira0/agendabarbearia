"use client";

import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type CatalogFilter = "all" | "active" | "inactive";
export type CatalogTone = "default" | "dark";

export function CatalogListShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

export function CatalogListToolbar({
  search,
  filters,
  actions,
  tone = "default",
}: {
  search: ReactNode;
  filters: ReactNode;
  actions?: ReactNode;
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        dark ? cn(ADMIN_SURFACE.panel, "rounded-2xl") : "bg-card shadow-sm"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">{search}</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {filters}
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CatalogFilterSegment({
  value,
  onChange,
  counts,
  labels = {
    all: "Todos",
    active: "Ativos",
    inactive: "Inativos",
  },
  tone = "default",
}: {
  value: CatalogFilter;
  onChange: (value: CatalogFilter) => void;
  counts: { all: number; active: number; inactive: number };
  labels?: {
    all: string;
    active: string;
    inactive: string;
  };
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";
  const items: { id: CatalogFilter; label: string; count: number }[] = [
    { id: "all", label: labels.all, count: counts.all },
    { id: "active", label: labels.active, count: counts.active },
    { id: "inactive", label: labels.inactive, count: counts.inactive },
  ];

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border p-1",
        dark ? "border-white/10 bg-white/[0.04]" : "bg-muted/30"
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
            dark
              ? value === item.id
                ? ADMIN_SURFACE.chipActive
                : ADMIN_SURFACE.chip
              : value === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
          <span
            className={cn(
              "tabular-nums text-xs",
              dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
            )}
          >
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export function CatalogListEmpty({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center",
        dark
          ? "border-white/10 bg-transparent text-[#f5f5f5]"
          : "bg-card"
      )}
    >
      <SearchX
        className={cn(
          "size-5",
          dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
        )}
      />
      <p className={cn("font-medium", dark ? "text-[#f5f5f5]" : "text-foreground")}>
        {title}
      </p>
      <p
        className={cn(
          "max-w-sm text-sm",
          dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
        )}
      >
        {description}
      </p>
    </div>
  );
}

export function CatalogTable({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "hidden overflow-hidden rounded-lg border md:block",
        dark
          ? cn(ADMIN_SURFACE.panel, "rounded-2xl shadow-none")
          : "bg-card shadow-sm",
        className
      )}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function CatalogTableHead({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";

  return (
    <thead>
      <tr
        className={cn(
          "border-b text-left text-xs font-medium tracking-wide uppercase",
          dark
            ? "border-white/10 bg-white/[0.03] text-[#b4b6bb]"
            : "bg-muted/30 text-muted-foreground"
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

export function CatalogTableHeadCell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

export function CatalogTableBody({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: CatalogTone;
}) {
  const dark = tone === "dark";

  return (
    <tbody
      className={cn("divide-y", dark ? "divide-white/10" : "divide-border")}
    >
      {children}
    </tbody>
  );
}

export function CatalogMobileList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 md:hidden">{children}</div>;
}

export function CatalogStatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground"
      )}
      aria-hidden
    />
  );
}
