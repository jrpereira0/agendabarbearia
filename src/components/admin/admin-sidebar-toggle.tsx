"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AdminSidebarToggle() {
  const { toggleSidebar, state } = useSidebar();
  const expanded = state === "expanded";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleSidebar}
      aria-label={expanded ? "Fechar menu" : "Abrir menu"}
      className={cn(
        "fixed top-4 z-30 hidden size-7 -translate-x-1/2 rounded-md border border-white/10 bg-[#0e0f11] text-[#f5f5f5] shadow-sm transition-[left] duration-200 ease-linear hover:bg-[#1a1b1e] hover:text-[#ecf15e] md:inline-flex",
        expanded ? "left-(--sidebar-width)" : "left-(--sidebar-width-icon)"
      )}
    >
      {expanded ? (
        <ChevronLeft className="size-4" aria-hidden />
      ) : (
        <ChevronRight className="size-4" aria-hidden />
      )}
    </Button>
  );
}
