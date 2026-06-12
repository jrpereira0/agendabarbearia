import Link from "next/link";
import { Plus, Scissors } from "lucide-react";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { ServicesList } from "@/components/admin/services-list";

export const metadata = { title: "Serviços" };

export default async function ServicesPage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();

  const { data: services } = await supabase
    .from("services")
    .select(
      "id, name, description, price_cents, duration_minutes, photo_url, active, professional_services(professional_id, professionals(nickname))"
    )
    .order("created_at");

  const list = services ?? [];
  const activeCount = list.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Serviços"
        description={
          list.length === 0
            ? "Monte o catálogo de serviços da barbearia."
            : `${list.length} cadastrado${list.length > 1 ? "s" : ""} · ${activeCount} ativo${activeCount === 1 ? "" : "s"}`
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Nenhum serviço ainda"
          description="Cadastre os serviços com preço e duração. A duração é o que define os horários livres na agenda."
          action={
            <Button asChild>
              <Link href="/admin/servicos/novo">
                <Plus />
                Cadastrar o primeiro
              </Link>
            </Button>
          }
        />
      ) : (
        <ServicesList
          items={list.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            priceCents: s.price_cents,
            durationMinutes: s.duration_minutes,
            photoUrl: s.photo_url,
            active: s.active,
            professionalNames: (s.professional_services ?? [])
              .map((ps) => {
                const pro = ps.professionals as
                  | { nickname: string }
                  | { nickname: string }[]
                  | null;
                return Array.isArray(pro) ? pro[0]?.nickname : pro?.nickname;
              })
              .filter((n): n is string => Boolean(n)),
          }))}
        />
      )}
    </div>
  );
}
