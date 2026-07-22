"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Contact, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FormSectionTitle } from "@/components/admin/form-section";
import { formatWhatsapp } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";

export type CustomerAppointment = {
  id: string;
  date: string;
  startTime: string;
  status:
    | "scheduled"
    | "confirmed"
    | "cancelled"
    | "done";
  professionalName: string;
  serviceNames: string[];
};

type CustomerFormProps = {
  initialValues?: {
    firstName: string;
    lastName: string;
    whatsapp: string;
  };
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  isEdit?: boolean;
};

export function CustomerForm({
  initialValues,
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
