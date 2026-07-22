"use client";

import { CalendarDays, Scissors, User } from "lucide-react";
import { FormSectionTitle } from "@/components/admin/form-section";
import type { CustomerAppointment } from "@/components/admin/customer-form";
import { formatDateBR, formatTime } from "@/lib/format";
import {
  STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import { agendaStatusBarColor } from "@/lib/agenda-colors";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type CustomerAppointmentsHistoryProps = {
  appointments: CustomerAppointment[];
};

const statusBadgeClass: Record<AppointmentStatus, string> = {
  scheduled:
    "border-[rgb(236_241_94_/_22%)] bg-[rgb(236_241_94_/_12%)] text-[#ecf15e]",
  confirmed:
    "border-[rgb(103_232_249_/_22%)] bg-[rgb(103_232_249_/_12%)] text-[#67e8f9]",
  cancelled:
    "border-[rgb(248_113_113_/_22%)] bg-[rgb(248_113_113_/_12%)] text-[#fca5a5]",
  done: "border-[rgb(74_222_128_/_22%)] bg-[rgb(74_222_128_/_12%)] text-[#86efac]",
};

export function CustomerAppointmentsHistory({
  appointments,
}: CustomerAppointmentsHistoryProps) {
  return (
    <div
      className={cn(
        ADMIN_SURFACE.panel,
        "flex flex-col gap-4 p-4 sm:gap-5 sm:p-6"
      )}
    >
      <FormSectionTitle
        tone="dark"
        icon={CalendarDays}
        title="Agendamentos"
        description={
          appointments.length === 0
            ? "Esse cliente ainda não tem visitas realizadas."
            : `${appointments.length} visita${appointments.length === 1 ? "" : "s"} realizada${appointments.length === 1 ? "" : "s"}`
        }
      />

      {appointments.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm",
            ADMIN_SURFACE.muted
          )}
        >
          Quando um atendimento for concluído, a visita aparece aqui.
        </div>
      ) : (
        <ul className="-mx-4 divide-y divide-white/10 sm:-mx-6">
          {appointments.map((a) => {
            const barColor = agendaStatusBarColor[a.status];

            return (
              <li
                key={a.id}
                className="relative overflow-hidden"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: barColor }}
                />

                <div className="flex flex-col gap-2.5 py-3.5 pl-4 pr-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pl-5 sm:pr-6">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                        {formatDateBR(a.date)}
                      </p>
                      <span
                        className={cn("text-sm tabular-nums", ADMIN_SURFACE.accent)}
                      >
                        {formatTime(a.startTime)}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
                        ADMIN_SURFACE.muted
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <User className="size-3.5 shrink-0 opacity-70" />
                        {a.professionalName}
                      </span>
                      {a.serviceNames.length > 0 ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Scissors className="size-3.5 shrink-0 opacity-70" />
                          <span className="truncate text-[#d4d5d8]">
                            {a.serviceNames.join(" · ")}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 self-start items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide",
                      statusBadgeClass[a.status]
                    )}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
