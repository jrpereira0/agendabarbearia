/** Telas do painel com fundo escuro (pra SidebarInset / content não piscarem branco). */
export function isAdminDarkSurface(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname === "/admin/metricas" ||
    pathname === "/admin/financeiro" ||
    pathname.startsWith("/admin/financeiro/") ||
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

/** Classes Tailwind da superfície escura do painel (login/agenda). */
export const ADMIN_SURFACE = {
  page: "bg-[#0e0f11] text-[#f5f5f5]",
  panel:
    "rounded-2xl border border-white/10 !bg-[#151618] !text-[#f5f5f5] shadow-none",
  input:
    "!border-white/10 !bg-[#1a1b1e] !text-[#f5f5f5] placeholder:!text-[#b4b6bb]",
  muted: "text-[#b4b6bb]",
  accent: "text-[#ecf15e]",
  progress: "bg-white/10",
  progressBar: "bg-[#ecf15e]",
  btnGhost:
    "!border-white/10 !bg-[#151618] !text-[#f5f5f5] hover:!border-[rgb(236_241_94_/_28%)] hover:!bg-[#1a1b1e] hover:!text-[#ecf15e]",
  btnPrimary:
    "!border-transparent !bg-[#ecf15e] !text-[#0e0f11] hover:!bg-[#e0e64f] hover:!text-[#0e0f11]",
  chip: "!bg-transparent !text-[#b4b6bb] !shadow-none hover:!text-[#f5f5f5]",
  chipActive:
    "!bg-[rgb(236_241_94_/_14%)] !text-[#ecf15e] !shadow-none hover:!bg-[rgb(236_241_94_/_18%)] hover:!text-[#ecf15e]",
  popover: "admin-popover",
  selectTrigger:
    "!border-white/10 !bg-[#1a1b1e] !text-[#f5f5f5] transition-colors " +
    "hover:!border-white/20 hover:!bg-[#1f2023] " +
    "focus-visible:!border-[rgb(236_241_94_/_40%)] focus-visible:!ring-[rgb(236_241_94_/_18%)] " +
    "data-[state=open]:!border-[rgb(236_241_94_/_40%)] data-[state=open]:!bg-[#1f2023] " +
    "[&_svg]:!text-[#b4b6bb] data-[state=open]:[&_svg]:!text-[#ecf15e]",
  sectionLabel:
    "font-medium tracking-[0.14em] text-[11px] text-[#ecf15e] uppercase",
} as const;
