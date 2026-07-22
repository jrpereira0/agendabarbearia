"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Fundo escuro só na Agenda, pra não piscar branco no carregamento. */
export function AdminPanelContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgenda = pathname === "/admin";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-8",
        isAgenda && "bg-[#0e0f11]"
      )}
    >
      {children}
    </div>
  );
}
