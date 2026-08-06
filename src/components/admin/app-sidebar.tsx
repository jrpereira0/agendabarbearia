"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Contact,
  ExternalLink,
  History,
  LogOut,
  Package,
  Percent,
  Receipt,
  Scissors,
  Settings,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/app/admin/(panel)/actions";
import { BrandLogo } from "@/components/brand-logo";
import { BOOKING_PATH } from "@/lib/booking-path";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/require-admin";

const financeItems = [
  {
    title: "Caixas",
    url: "/admin/financeiro/caixas",
    icon: History,
  },
  {
    title: "Despesas",
    url: "/admin/financeiro/despesas",
    icon: Receipt,
  },
  {
    title: "Comissões",
    url: "/admin/financeiro/comissoes",
    icon: Percent,
  },
] as const;

const dayToDayItems = [
  { title: "Agenda", url: "/admin", icon: CalendarDays },
  {
    title: "Métricas",
    url: "/admin/metricas",
    icon: BarChart3,
    roles: ["owner"] as AdminRole[],
  },
];

const managementItems = [
  {
    title: "Profissionais",
    url: "/admin/profissionais",
    icon: Users,
    roles: ["owner"] as AdminRole[],
  },
  {
    title: "Serviços",
    url: "/admin/servicos",
    icon: Scissors,
    roles: ["owner"] as AdminRole[],
  },
  {
    title: "Produtos",
    url: "/admin/produtos",
    icon: Package,
    roles: ["owner"] as AdminRole[],
  },
  {
    title: "Clientes",
    url: "/admin/clientes",
    icon: Contact,
    roles: ["owner", "reception"] as AdminRole[],
  },
];

type NavItem = {
  title: string;
  url: string;
  icon: typeof CalendarDays;
  roles?: AdminRole[];
};

type AppSidebarProps = {
  role: AdminRole;
  userName: string;
  userEmail: string;
};

function isNavActive(pathname: string, url: string): boolean {
  if (url === "/admin") return pathname === "/admin";
  if (url === "/admin/metricas") return pathname === "/admin/metricas";
  return pathname === url || pathname.startsWith(`${url}/`);
}

function isFinanceActive(pathname: string): boolean {
  return financeItems.some((item) => isNavActive(pathname, item.url));
}

function roleLabel(role: AdminRole): string {
  if (role === "owner") return "Dono";
  if (role === "reception") return "Recepção";
  return "Barbeiro";
}

function FinanceiroNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const active = isFinanceActive(pathname);
  const iconCollapsed = state === "collapsed" && !isMobile;

  if (iconCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip="Financeiro"
              isActive={active}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Wallet />
              <span>Financeiro</span>
              <ChevronRight className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={8}
            className="min-w-44"
          >
            {financeItems.map((item) => (
              <DropdownMenuItem key={item.url} asChild>
                <Link href={item.url} onClick={onNavigate}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="Financeiro"
            className="data-[state=open]:bg-sidebar-accent/50"
          >
            <Wallet />
            <span>Financeiro</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {financeItems.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isNavActive(pathname, item.url)}
                  onClick={onNavigate}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar({ role, userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isOwner = role === "owner";
  const isReception = role === "reception";
  const isBarber = role === "barber";

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function closeMobile() {
    setOpenMobile(false);
  }

  function renderItems(items: NavItem[]) {
    return items
      .filter((item) => !item.roles || item.roles.includes(role))
      .map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            asChild
            isActive={isNavActive(pathname, item.url)}
            tooltip={item.title}
            onClick={closeMobile}
          >
            <Link href={item.url}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ));
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
            <SidebarMenu>
              {renderItems(
                dayToDayItems.filter((item) => item.url === "/admin")
              )}
              {isOwner ? <FinanceiroNav onNavigate={closeMobile} /> : null}
              {isBarber ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(
                      pathname,
                      "/admin/financeiro/comissoes"
                    )}
                    tooltip="Minhas comissões"
                    onClick={closeMobile}
                  >
                    <Link href="/admin/financeiro/comissoes">
                      <Percent />
                      <span>Minhas comissões</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {renderItems(
                dayToDayItems.filter((item) => item.url !== "/admin")
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner || isReception ? (
          <SidebarGroup>
            <SidebarGroupLabel>Gerenciamento</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(managementItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isOwner ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(pathname, "/admin/configuracoes")}
                    tooltip="Configurações"
                    onClick={closeMobile}
                  >
                    <Link href="/admin/configuracoes">
                      <Settings />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(pathname, "/admin/minha-conta")}
                    tooltip="Minha conta"
                    onClick={closeMobile}
                  >
                    <Link href="/admin/minha-conta">
                      <UserRound />
                      <span>Minha conta</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {!isReception ? (
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
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
              <Avatar className="size-8 shrink-0 rounded-md ring-1 ring-[rgb(236_241_94_/_25%)]">
                <AvatarFallback className="admin-sidebar-avatar rounded-md text-xs font-medium">
                  {initials || "DB"}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{userName}</span>
                <span
                  className="truncate text-xs text-sidebar-foreground/50"
                  title={userEmail}
                >
                  {roleLabel(role)}
                </span>
              </div>
            </div>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={() => signOut()}
              className="text-[#f87171] hover:bg-[rgb(248_113_113_/_12%)] hover:text-[#fca5a5]"
            >
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
