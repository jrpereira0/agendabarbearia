"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function AdminMobileMenu() {
  const { setOpenMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const header = (
    <header className="fixed top-0 left-0 z-50 flex h-12 w-full items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
      <BrandLogo
        href="/admin"
        size="sm"
        className="min-w-0 shrink"
        nameClassName="text-sm text-sidebar-foreground"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={() => setOpenMobile(true)}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" aria-hidden />
      </Button>
    </header>
  );

  return (
    <>
      {mounted ? createPortal(header, document.body) : null}
      <div className="h-12 shrink-0 md:hidden" aria-hidden />
    </>
  );
}
