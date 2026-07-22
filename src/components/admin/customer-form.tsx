"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Contact, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminFormActions,
  AdminFormFields,
} from "@/components/admin/admin-form-layout";
import { FormSectionTitle } from "@/components/admin/form-section";
import { formatWhatsapp } from "@/lib/format";
import { capitalizePersonName } from "@/lib/text";
import type { ActionResult } from "@/lib/require-owner";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type CustomerAppointment = {
  id: string;
  date: string;
  startTime: string;
  status: "scheduled" | "confirmed" | "cancelled" | "done";
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

function DarkLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[#f5f5f5]">
      {children}
    </Label>
  );
}

export function CustomerForm({
  initialValues,
  onSubmit,
  submitLabel,
  isEdit = false,
}: CustomerFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [whatsapp, setWhatsapp] = useState(
    initialValues?.whatsapp ? formatWhatsapp(initialValues.whatsapp) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const normalizedFirstName = capitalizePersonName(firstName);
    const normalizedLastName = capitalizePersonName(lastName);
    setFirstName(normalizedFirstName);
    setLastName(normalizedLastName);

    const formData = new FormData(e.currentTarget);
    formData.set("firstName", normalizedFirstName);
    formData.set("lastName", normalizedLastName);
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
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4"
      autoComplete="off"
    >
      <div
        className={cn(
          ADMIN_SURFACE.panel,
          "flex flex-col gap-5 p-4 sm:gap-6 sm:p-6"
        )}
      >
        <FormSectionTitle
          tone="dark"
          icon={Contact}
          title="Dados do cliente"
          description={
            isEdit
              ? "Alterações aqui também atualizam os agendamentos vinculados."
              : "Nome e WhatsApp identificam o cliente nos agendamentos."
          }
        />

        <AdminFormFields columns={2}>
          <div className="space-y-2">
            <DarkLabel htmlFor="firstName">Nome</DarkLabel>
            <Input
              id="firstName"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => setFirstName(capitalizePersonName(firstName))}
              required
              disabled={saving}
              className={ADMIN_SURFACE.input}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <DarkLabel htmlFor="lastName">Sobrenome</DarkLabel>
            <Input
              id="lastName"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => setLastName(capitalizePersonName(lastName))}
              required
              disabled={saving}
              className={ADMIN_SURFACE.input}
              autoComplete="off"
            />
          </div>
        </AdminFormFields>

        <div className="space-y-2">
          <DarkLabel htmlFor="whatsapp">WhatsApp</DarkLabel>
          <div className="relative">
            <Phone
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                ADMIN_SURFACE.muted
              )}
            />
            <Input
              id="whatsapp"
              inputMode="numeric"
              className={cn("pl-9", ADMIN_SURFACE.input)}
              placeholder="(11) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
              required
              disabled={saving}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <AdminFormActions
        tone="dark"
        onCancel={() => router.push("/admin/clientes")}
        submitLabel={submitLabel}
        saving={saving}
      />
    </form>
  );
}
