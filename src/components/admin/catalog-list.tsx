"use client";

import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export type CatalogFilter = "all" | "active" | "inactive";

export function CatalogListShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

export function CatalogListToolbar({
  search,
  filters,
  actions,
}: {
  search: ReactNode;
  filters: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
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
}: {
  value: CatalogFilter;
  onChange: (value: CatalogFilter) => void;
  counts: { all: number; active: number; inactive: number };
  labels?: {
    all: string;
    active: string;
    inactive: string;
  };
}) {
  const items: { id: CatalogFilter; label: string; count: number }[] = [
    { id: "all", label: labels.all, count: counts.all },
    { id: "active", label: labels.active, count: counts.active },
    { id: "inactive", label: labels.inactive, count: counts.inactive },
  ];

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
            value === item.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
          <span className="tabular-nums text-xs text-muted-foreground">
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
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
      <SearchX className="size-5 text-muted-foreground" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function CatalogTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden overflow-hidden rounded-lg border bg-card shadow-sm md:block",
        className
      )}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function CatalogTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
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

export function CatalogTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
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
