"use client";

import { usePathname } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AdminPanelInset({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgenda = pathname === "/admin";

  return (
    <SidebarInset
      className={cn(
        "flex min-h-svh flex-col",
        isAgenda && "!bg-[#0e0f11] text-[#f5f5f5]"
      )}
    >
      {children}
    </SidebarInset>
  );
}
