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
        "fixed top-4 z-30 hidden size-7 -translate-x-1/2 rounded-md border bg-background shadow-sm transition-[left] duration-200 ease-linear md:inline-flex",
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
