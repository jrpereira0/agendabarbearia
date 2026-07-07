"use client";

import { usePathname } from "next/navigation";
import { AdminAgendaSkeleton } from "@/components/skeletons/admin-agenda-skeleton";
import { AdminFormSkeleton } from "@/components/skeletons/admin-form-skeleton";
import { AdminListSkeleton } from "@/components/skeletons/admin-list-skeleton";
import { AdminMetricsSkeleton } from "@/components/skeletons/admin-metrics-skeleton";

function isFormPath(pathname: string): boolean {
  return (
    pathname.endsWith("/novo") ||
    /\/admin\/(clientes|profissionais|servicos|configuracoes)\/[^/]+$/.test(
      pathname
    ) ||
    pathname === "/admin/minha-conta" ||
    pathname.startsWith("/admin/configuracoes/")
  );
}

function isListPath(pathname: string): boolean {
  return (
    pathname === "/admin/clientes" ||
    pathname === "/admin/profissionais" ||
    pathname === "/admin/servicos"
  );
}

function isMetricsPath(pathname: string): boolean {
  return pathname.startsWith("/admin/financeiro");
}

export function AdminPanelLoading() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin?")) {
    return <AdminAgendaSkeleton />;
  }
  if (isMetricsPath(pathname)) {
    return <AdminMetricsSkeleton />;
  }
  if (isFormPath(pathname)) {
    return <AdminFormSkeleton />;
  }
  if (isListPath(pathname)) {
    return <AdminListSkeleton />;
  }
  return <AdminListSkeleton />;
}
