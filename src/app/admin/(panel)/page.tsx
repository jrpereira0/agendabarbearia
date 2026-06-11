import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Acompanhe os agendamentos do dia."
      />

      <EmptyState
        icon={CalendarDays}
        title="Nenhum agendamento ainda"
        description="Os agendamentos dos clientes vão aparecer aqui. Comece cadastrando os serviços e os profissionais no menu ao lado."
      />
    </div>
  );
}
