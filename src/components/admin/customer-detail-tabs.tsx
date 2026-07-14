"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CustomerForm,
  type CustomerAppointment,
} from "@/components/admin/customer-form";
import { CustomerAppointmentsHistory } from "@/components/admin/customer-appointments-history";
import {
  CustomerFinancePanel,
  type CustomerComandaHistoryItem,
  type CustomerCreditHistoryItem,
} from "@/components/admin/customer-finance-panel";
import type { ActionResult } from "@/lib/require-owner";

type CustomerDetailTabsProps = {
  firstName: string;
  lastName: string;
  whatsapp: string;
  customerId: string;
  creditBalanceCents: number;
  appointments: CustomerAppointment[];
  comandas: CustomerComandaHistoryItem[];
  creditTransactions: CustomerCreditHistoryItem[];
  onSubmit: (formData: FormData) => Promise<ActionResult>;
};

export function CustomerDetailTabs({
  firstName,
  lastName,
  whatsapp,
  customerId,
  creditBalanceCents,
  appointments,
  comandas,
  creditTransactions,
  onSubmit,
}: CustomerDetailTabsProps) {
  return (
    <Tabs defaultValue="dados" className="w-full">
      <TabsList>
        <TabsTrigger value="dados">Dados</TabsTrigger>
        <TabsTrigger value="agendamentos">
          Agendamentos
          {appointments.length > 0 ? (
            <span className="tabular-nums text-muted-foreground">
              ({appointments.length})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
      </TabsList>

      <TabsContent value="dados">
        <CustomerForm
          initialValues={{ firstName, lastName, whatsapp }}
          onSubmit={onSubmit}
          submitLabel="Salvar alterações"
          isEdit
        />
      </TabsContent>

      <TabsContent value="agendamentos">
        <CustomerAppointmentsHistory appointments={appointments} />
      </TabsContent>

      <TabsContent value="financeiro">
        <CustomerFinancePanel
          customerId={customerId}
          creditBalanceCents={creditBalanceCents}
          comandas={comandas}
          creditTransactions={creditTransactions}
        />
      </TabsContent>
    </Tabs>
  );
}
