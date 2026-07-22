"use client";

import { usePathname } from "next/navigation";
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
    pathname.startsWith("/admin/clientes/")
  );
}

/** Fundo escuro nas telas com identidade nova, pra não piscar branco. */
export function AdminPanelContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const darkSurface = isAdminDarkSurface(pathname);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-8",
        darkSurface && "bg-[#0e0f11] text-[#f5f5f5]"
      )}
    >
      {children}
    </div>
  );
}
