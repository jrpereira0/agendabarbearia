"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Contact,
  ExternalLink,
  History,
  LogOut,
  Package,
  Percent,
  Scissors,
  Settings,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/admin/(panel)/actions";
import { BrandLogo } from "@/components/brand-logo";
import { BOOKING_PATH } from "@/lib/booking-path";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

const dayToDayItems = [
  { title: "Agenda", url: "/admin", icon: CalendarDays },
  {
    title: "Comissões",
    url: "/admin/financeiro/comissoes",
    icon: Percent,
    barberTitle: "Minhas comissões",
  },
  {
    title: "Caixas",
    url: "/admin/financeiro/caixas",
    icon: History,
    ownerOnly: true,
  },
  {
    title: "Financeiro",
    url: "/admin/financeiro",
    icon: BarChart3,
    ownerOnly: true,
  },
];

const managementItems = [
  { title: "Profissionais", url: "/admin/profissionais", icon: Users },
  { title: "Serviços", url: "/admin/servicos", icon: Scissors },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Clientes", url: "/admin/clientes", icon: Contact },
];

type AppSidebarProps = {
  isOwner: boolean;
  userName: string;
  userEmail: string;
};

export function AppSidebar({ isOwner, userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function renderItems(
    items: {
      title: string;
      url: string;
      icon: typeof CalendarDays;
      ownerOnly?: boolean;
      barberTitle?: string;
    }[]
  ) {
    return items
      .filter((item) => !item.ownerOnly || isOwner)
      .map((item) => {
        const label =
          !isOwner && item.barberTitle ? item.barberTitle : item.title;
        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              asChild
              isActive={
                item.url === "/admin"
                  ? pathname === "/admin"
                  : item.url === "/admin/financeiro"
                    ? pathname === "/admin/financeiro"
                    : pathname === item.url ||
                      pathname.startsWith(`${item.url}/`)
              }
              tooltip={label}
              onClick={() => setOpenMobile(false)}
            >
              <Link href={item.url}>
                <item.icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      });
  }

  return (
    <Sidebar
      collapsible="icon"
      mobileSide="right"
      className={cn("admin-sidebar border-sidebar-border")}
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="min-w-0">
                <BrandLogo
                  size="sm"
                  subtitle="Painel"
                  className="min-w-0 text-sidebar-foreground"
                  nameClassName="admin-sidebar-brand-name text-sidebar-foreground"
                  subtitleClassName="text-sidebar-foreground/50"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dia a dia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(dayToDayItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Gerenciamento</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(managementItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Atalhos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Página de agendamento">
                  <a
                    href={BOOKING_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    <span>Página de agendamento</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  isActive={
                    pathname === "/admin/configuracoes" ||
                    pathname === "/admin/minha-conta"
                  }
                >
                  <Avatar className="size-8 rounded-md ring-1 ring-[rgb(236_241_94_/_25%)]">
                    <AvatarFallback className="admin-sidebar-avatar rounded-md text-xs font-medium">
                      {initials || "DB"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {userName}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/50">
                      {isOwner ? "Dono" : "Barbeiro"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className={cn(
                  ADMIN_SURFACE.popover,
                  "w-(--radix-dropdown-menu-trigger-width) min-w-60 p-1.5"
                )}
              >
                <DropdownMenuLabel className="px-2.5 py-2.5 font-normal">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9 rounded-md ring-1 ring-[rgb(236_241_94_/_25%)]">
                      <AvatarFallback className="admin-sidebar-avatar rounded-md text-xs font-medium">
                        {initials || "DB"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                      <span className="truncate text-sm font-medium text-[#f5f5f5]">
                        {userName}
                      </span>
                      <span className="truncate text-xs text-[#b4b6bb]">
                        {userEmail}
                      </span>
                      <span className="mt-1 w-fit rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#ecf15e] uppercase">
                        {isOwner ? "Dono" : "Barbeiro"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-1 my-1.5 bg-white/10" />
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      isOwner ? "/admin/configuracoes" : "/admin/minha-conta"
                    }
                    onClick={() => setOpenMobile(false)}
                  >
                    <Settings className="size-4" />
                    {isOwner ? "Configurações" : "Minha conta"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-1 my-1.5 bg-white/10" />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => signOut()}
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
