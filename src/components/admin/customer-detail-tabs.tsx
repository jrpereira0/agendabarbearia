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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

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
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === "done"
  );

  return (
    <Tabs defaultValue="dados" className="w-full">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
        <TabsTrigger value="dados" className="flex-none px-3">
          Dados
        </TabsTrigger>
        <TabsTrigger value="agendamentos" className="flex-none px-3">
          Agendamentos
          {completedAppointments.length > 0 ? (
            <span className={cn("tabular-nums", ADMIN_SURFACE.muted)}>
              ({completedAppointments.length})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="financeiro" className="flex-none px-3">
          Financeiro
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="mt-4">
        <CustomerForm
          initialValues={{ firstName, lastName, whatsapp }}
          onSubmit={onSubmit}
          submitLabel="Salvar alterações"
          isEdit
        />
      </TabsContent>

      <TabsContent value="agendamentos" className="mt-4">
        <CustomerAppointmentsHistory appointments={completedAppointments} />
      </TabsContent>

      <TabsContent value="financeiro" className="mt-4">
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
