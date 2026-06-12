import { Contact } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "Clientes" };

export default async function CustomersPage() {
  await assertOwnerPage();

  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select(
      `
      id,
      first_name,
      last_name,
      whatsapp,
      created_at,
      appointments (count)
    `
    )
    .order("last_name")
    .order("first_name");

  const list = customers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description={
          list.length === 0
            ? "Quem já agendou pela página ou pelo painel aparece aqui."
            : `${list.length} cliente${list.length === 1 ? "" : "s"} cadastrado${list.length === 1 ? "" : "s"}`
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="Nenhum cliente ainda"
          description="Assim que alguém agendar pela página ou você criar um agendamento no painel, o cadastro aparece aqui automaticamente."
        />
      ) : (
        <CustomersList
          items={list.map((c) => ({
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            whatsapp: c.whatsapp,
            appointmentCount:
              (c.appointments as { count: number }[] | null)?.[0]?.count ?? 0,
          }))}
        />
      )}
    </div>
  );
}
