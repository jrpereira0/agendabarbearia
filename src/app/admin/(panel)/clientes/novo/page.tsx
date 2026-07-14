import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { CustomerForm } from "@/components/admin/customer-form";
import { createCustomer } from "../actions";

export const metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  await assertOwnerPage();

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Novo cliente"
        description="Cadastre quem ainda não agendou pela página."
        backHref="/admin/clientes"
        backLabel="Clientes"
      />

      <CustomerForm
        onSubmit={createCustomer}
        submitLabel="Cadastrar cliente"
      />
    </div>
  );
}
