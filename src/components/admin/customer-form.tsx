"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Contact, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormSectionTitle } from "@/components/admin/form-section";
import { formatDateBR, formatTime, formatWhatsapp } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";

export type CustomerAppointment = {
  id: string;
  date: string;
  startTime: string;
  status: "confirmed" | "cancelled" | "done";
  professionalName: string;
  serviceNames: string[];
};

type CustomerFormProps = {
  initialValues?: {
    firstName: string;
    lastName: string;
    whatsapp: string;
  };
  appointments?: CustomerAppointment[];
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  isEdit?: boolean;
};

const statusLabel: Record<CustomerAppointment["status"], string> = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  done: "Atendido",
};

export function CustomerForm({
  initialValues,
  appointments = [],
  onSubmit,
  submitLabel,
  isEdit = false,
}: CustomerFormProps) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState(
    initialValues?.whatsapp ? formatWhatsapp(initialValues.whatsapp) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    formData.set("whatsapp", whatsapp.replace(/\D/g, ""));

    const result = await onSubmit(formData);

    if (result.ok) {
      toast.success(isEdit ? "Cliente atualizado." : "Cliente cadastrado.");
      if (isEdit) {
        router.refresh();
      } else {
        router.push("/admin/clientes");
      }
    } else {
      toast.error(result.error);
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          <FormSectionTitle
            icon={Contact}
            title="Dados do cliente"
            description={
              isEdit
                ? "Alterações aqui também atualizam os agendamentos vinculados."
                : "Nome e WhatsApp identificam o cliente nos agendamentos."
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={initialValues?.firstName ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={initialValues?.lastName ?? ""}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="whatsapp"
                inputMode="numeric"
                className="pl-9"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <FormSectionTitle
              icon={CalendarDays}
              title="Histórico de agendamentos"
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
                        {statusLabel[a.status]}
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
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <User />
            {saving ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
