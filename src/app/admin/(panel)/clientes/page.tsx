import Link from "next/link";
import { Contact, Plus } from "lucide-react";
import { requireServerClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "Clientes" };

type AppointmentRow = {
  date: string;
  status: string;
};

function mapCustomer(c: {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp: string;
  created_at: string;
  appointments: AppointmentRow[] | null;
}) {
  const appts = Array.isArray(c.appointments)
    ? c.appointments.filter(
        (a): a is AppointmentRow => "date" in a && "status" in a
      )
    : [];

  const appointmentCount = appts.length;

  const lastVisitDate =
    appts
      .filter((a) => a.status === "done")
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;

  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    whatsapp: c.whatsapp,
    appointmentCount,
    lastVisitDate,
    memberSince: c.created_at.slice(0, 10),
  };
}

export default async function CustomersPage() {
  await assertOwnerPage();

  const supabase = await requireServerClient();

  const { data: customers } = await supabase
    .from("customers")
    .select(
      `
      id,
      first_name,
      last_name,
      whatsapp,
      created_at,
      appointments (date, status)
    `
    )
    .order("last_name")
    .order("first_name");

  const list = (customers ?? []).map(mapCustomer);
  const withVisits = list.filter((c) => c.appointmentCount > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description={
          list.length === 0
            ? "Cadastre clientes ou eles entram sozinhos ao agendar."
            : `${list.length} cadastrado${list.length === 1 ? "" : "s"} · ${withVisits} com visita${withVisits === 1 ? "" : "s"}`
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="Nenhum cliente ainda"
          description="Cadastre manualmente ou aguarde o primeiro agendamento pela página."
          action={
            <Button asChild>
              <Link href="/admin/clientes/novo">
                <Plus />
                Cadastrar o primeiro
              </Link>
            </Button>
          }
        />
      ) : (
        <CustomersList items={list} />
      )}
    </div>
  );
}
