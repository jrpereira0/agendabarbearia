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

  const [{ data: services }, { data: weekdayPriceRows }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, price_cents, price_from, duration_minutes, photo_url, photo_position, active, professional_services(professional_id, professionals(nickname))"
      )
      .order("name"),
    supabase
      .from("service_weekday_prices")
      .select("service_id, weekday, price_cents"),
  ]);

  const weekdayPricesByService = new Map<
    string,
    { weekday: number; priceCents: number }[]
  >();
  for (const row of weekdayPriceRows ?? []) {
    const list = weekdayPricesByService.get(row.service_id) ?? [];
    list.push({ weekday: row.weekday, priceCents: row.price_cents });
    weekdayPricesByService.set(row.service_id, list);
  }

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
            priceFrom: s.price_from ?? false,
            weekdayPrices: weekdayPricesByService.get(s.id) ?? [],
            durationMinutes: s.duration_minutes,
            photoUrl: s.photo_url,
            photoPosition: s.photo_position,
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
