import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { CustomerForm } from "@/components/admin/customer-form";
import { formatTime } from "@/lib/format";
import { updateCustomer } from "../actions";

export const metadata = { title: "Cliente" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertOwnerPage();

  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      `
      id,
      first_name,
      last_name,
      whatsapp,
      appointments (
        id,
        date,
        start_time,
        status,
        professionals (nickname),
        appointment_services (
          services (name)
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const appointments = (customer.appointments ?? [])
    .map((a) => {
      const pro = a.professionals as
        | { nickname: string }
        | { nickname: string }[]
        | null;
      const professionalName = Array.isArray(pro)
        ? (pro[0]?.nickname ?? "—")
        : (pro?.nickname ?? "—");

      const serviceNames = (a.appointment_services ?? [])
        .map((link) => {
          const svc = link.services as
            | { name: string }
            | { name: string }[]
            | null;
          return Array.isArray(svc) ? svc[0]?.name : svc?.name;
        })
        .filter((name): name is string => Boolean(name));

      return {
        id: a.id,
        date: a.date,
        startTime: formatTime(a.start_time),
        status: a.status as "confirmed" | "cancelled" | "done",
        professionalName,
        serviceNames,
      };
    })
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.startTime.localeCompare(a.startTime);
    });

  const updateWithId = updateCustomer.bind(null, customer.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title={`${customer.first_name} ${customer.last_name}`}
        description="Dados e histórico de visitas"
        backHref="/admin/clientes"
        backLabel="Clientes"
      />

      <CustomerForm
        initialValues={{
          firstName: customer.first_name,
          lastName: customer.last_name,
          whatsapp: customer.whatsapp,
        }}
        appointments={appointments}
        onSubmit={updateWithId}
      />
    </div>
  );
}
