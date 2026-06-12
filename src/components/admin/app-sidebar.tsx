"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Contact,
  ExternalLink,
  LogOut,
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

const dayToDayItems = [
  { title: "Agenda", url: "/admin", icon: CalendarDays },
];

const managementItems = [
  { title: "Profissionais", url: "/admin/profissionais", icon: Users },
  { title: "Serviços", url: "/admin/servicos", icon: Scissors },
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

  function renderItems(items: typeof dayToDayItems) {
    return items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={pathname === item.url}
          tooltip={item.title}
          onClick={() => setOpenMobile(false)}
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="min-w-0">
                <BrandLogo
                  size="sm"
                  subtitle="Painel administrativo"
                  className="min-w-0"
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
                  <a href={BOOKING_PATH} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    <span>Página de agendamento</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  isActive={
                    pathname === "/admin/configuracoes" ||
                    pathname === "/admin/minha-conta" ||
                    pathname === "/admin/horarios"
                  }
                >
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md text-xs font-medium">
                      {initials || "AB"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {userName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isOwner ? "Dono" : "Barbeiro"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="truncate text-sm font-medium">
                      {userName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={isOwner ? "/admin/configuracoes" : "/admin/minha-conta"}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Settings />
                    {isOwner ? "Configurações da barbearia" : "Minha conta"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>
                  <LogOut />
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
