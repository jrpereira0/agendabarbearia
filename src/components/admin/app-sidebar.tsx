"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  LogOut,
  Scissors,
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

const mainItems = [
  { title: "Agenda", url: "/admin", icon: CalendarDays },
  { title: "Horários", url: "/admin/horarios", icon: Clock },
];

const managementItems = [
  { title: "Profissionais", url: "/admin/profissionais", icon: Users },
  { title: "Serviços", url: "/admin/servicos", icon: Scissors },
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

  function renderItems(items: typeof mainItems) {
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
              <Link href="/admin">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Scissors className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">
                    Agenda Barbearia
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Painel administrativo
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dia a dia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
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
                <SidebarMenuButton asChild tooltip="Ver site do cliente">
                  <a href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    <span>Ver site do cliente</span>
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
                <SidebarMenuButton size="lg">
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
