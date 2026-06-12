import { redirect } from "next/navigation";
import { requireServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH, loginUrl } from "@/lib/login-path";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/admin/app-sidebar";

// Painel exige sessão e banco: não pré-renderiza no build da Vercel.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await requireServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "owner" && profile.role !== "barber")
  ) {
    redirect(loginUrl("perfil"));
  }

  const isOwner = profile.role === "owner";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          isOwner={isOwner}
          userName={profile?.full_name || "Usuário"}
          userEmail={user.email ?? ""}
        />
        <SidebarInset className="flex min-h-svh flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium">Painel</span>
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
