"use client";

import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormSectionTitle } from "@/components/admin/form-section";
import type { CustomerAppointment } from "@/components/admin/customer-form";
import { formatDateBR, formatTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/appointment-status";

type CustomerAppointmentsHistoryProps = {
  appointments: CustomerAppointment[];
};

export function CustomerAppointmentsHistory({
  appointments,
}: CustomerAppointmentsHistoryProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <FormSectionTitle
          icon={CalendarDays}
          title="Agendamentos"
          description={
            appointments.length === 0
              ? "Esse cliente ainda não tem visitas registradas."
              : `${appointments.length} agendamento${appointments.length === 1 ? "" : "s"} no total`
          }
        />

        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Quando ele agendar de novo, as visitas aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {appointments.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border bg-muted/20 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {formatDateBR(a.date)} às {formatTime(a.startTime)}
                  </p>
                  <Badge
                    variant={
                      a.status === "done"
                        ? "secondary"
                        : a.status === "cancelled"
                          ? "outline"
                          : "default"
                    }
                    className="font-normal"
                  >
                    {STATUS_LABELS[a.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {a.professionalName}
                </p>
                <p className="mt-1">{a.serviceNames.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
