import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { ProfessionalsList } from "@/components/admin/professionals-list";

export const metadata = { title: "Profissionais" };

export default async function ProfessionalsPage() {
  const supabase = await createClient();

  const { data: professionals } = await supabase
    .from("professionals")
    .select(
      "id, first_name, last_name, nickname, whatsapp, email, instagram, photo_url, active, professional_services(service_id, services(name))"
    )
    .order("created_at");

  const list = professionals ?? [];
  const activeCount = list.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profissionais"
        description={
          list.length === 0
            ? "Monte a equipe da sua barbearia."
            : `${list.length} cadastrado${list.length > 1 ? "s" : ""} · ${activeCount} ativo${activeCount === 1 ? "" : "s"}`
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum profissional ainda"
          description="Cadastre o primeiro barbeiro da equipe. Ele já recebe acesso ao sistema pra acompanhar a própria agenda."
          action={
            <Button asChild>
              <Link href="/admin/profissionais/novo">
                <Plus />
                Cadastrar o primeiro
              </Link>
            </Button>
          }
        />
      ) : (
        <ProfessionalsList
          items={list.map((p) => ({
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            nickname: p.nickname,
            whatsapp: p.whatsapp,
            instagram: p.instagram,
            photoUrl: p.photo_url,
            active: p.active,
            serviceNames: (p.professional_services ?? [])
              .map((ps) => ps.services?.name)
              .filter((n): n is string => Boolean(n)),
          }))}
        />
      )}
    </div>
  );
}
