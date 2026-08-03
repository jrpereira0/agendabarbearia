"use client";

import { usePathname } from "next/navigation";
import { isAdminDarkSurface } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

/** Fundo escuro nas telas com identidade nova, pra não piscar branco. */
export function AdminPanelContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const darkSurface = isAdminDarkSurface(pathname);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 md:p-8",
        darkSurface && "bg-[#0e0f11] text-[#f5f5f5]"
      )}
    >
      {children}
    </div>
  );
}
