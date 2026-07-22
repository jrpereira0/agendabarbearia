"use client";

import { usePathname } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function isAdminDarkSurface(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname === "/admin/financeiro" ||
    pathname === "/admin/financeiro/comissoes" ||
    pathname.startsWith("/admin/financeiro/comissoes/") ||
    pathname === "/admin/financeiro/caixas" ||
    pathname.startsWith("/admin/financeiro/caixas/") ||
    pathname === "/admin/profissionais" ||
    pathname.startsWith("/admin/profissionais/") ||
    pathname === "/admin/servicos" ||
    pathname.startsWith("/admin/servicos/") ||
    pathname === "/admin/clientes" ||
    pathname.startsWith("/admin/clientes/") ||
    pathname === "/admin/produtos" ||
    pathname.startsWith("/admin/produtos/") ||
    pathname === "/admin/configuracoes" ||
    pathname.startsWith("/admin/configuracoes/")
  );
}

export function AdminPanelInset({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const darkSurface = isAdminDarkSurface(pathname);

  return (
    <SidebarInset
      className={cn(
        "flex min-h-svh flex-col",
        darkSurface && "!bg-[#0e0f11] text-[#f5f5f5]"
      )}
    >
      {children}
    </SidebarInset>
  );
}
