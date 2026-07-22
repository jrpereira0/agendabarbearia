import { assertOwnerPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { AdminFormPage } from "@/components/admin/admin-form-layout";
import { CustomerForm } from "@/components/admin/customer-form";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";
import { createCustomer } from "../actions";

export const metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  await assertOwnerPage();

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <AdminFormPage tone="dark">
        <PageHeader
          tone="dark"
          title="Novo cliente"
          description="Cadastre quem ainda não agendou pela página."
          backHref="/admin/clientes"
          backLabel="Clientes"
        />

        <CustomerForm
          onSubmit={createCustomer}
          submitLabel="Cadastrar cliente"
        />
      </AdminFormPage>
    </div>
  );
}
