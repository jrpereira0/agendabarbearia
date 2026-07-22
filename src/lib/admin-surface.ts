/** Classes Tailwind da superfície escura do painel (login/agenda). */
export const ADMIN_SURFACE = {
  page: "bg-[#0e0f11] text-[#f5f5f5]",
  panel:
    "rounded-2xl border border-white/10 !bg-[#151618] !text-[#f5f5f5] shadow-none",
  input:
    "!border-white/10 !bg-[#1a1b1e] !text-[#f5f5f5] placeholder:!text-[#8b8d93]",
  muted: "text-[#8b8d93]",
  accent: "text-[#ecf15e]",
  progress: "bg-white/10",
  progressBar: "bg-[#ecf15e]",
  btnGhost:
    "!border-white/10 !bg-[#151618] !text-[#f5f5f5] hover:!border-[rgb(236_241_94_/_28%)] hover:!bg-[#1a1b1e] hover:!text-[#ecf15e]",
  btnPrimary:
    "!border-transparent !bg-[#ecf15e] !text-[#0e0f11] hover:!bg-[#e0e64f] hover:!text-[#0e0f11]",
  chip: "!bg-transparent !text-[#8b8d93] !shadow-none hover:!text-[#f5f5f5]",
  chipActive:
    "!bg-[rgb(236_241_94_/_14%)] !text-[#ecf15e] !shadow-none hover:!bg-[rgb(236_241_94_/_18%)] hover:!text-[#ecf15e]",
  popover:
    "border-white/10 bg-[#151618] text-[#f5f5f5] [&_[data-slot=select-item]]:focus:bg-white/5 [&_[data-slot=dropdown-menu-item]]:focus:bg-white/5",
  sectionLabel:
    "font-medium tracking-[0.14em] text-[11px] text-[#ecf15e] uppercase",
} as const;
