"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxGroup } from "@/components/admin/checkbox-group";
import {
  AdminFormActions,
  AdminFormFields,
  AdminFormPhotoUpload,
  AdminFormSectionCard,
} from "@/components/admin/admin-form-layout";
import {
  appendPermissionsToFormData,
  ProfessionalPermissionsFields,
} from "@/components/admin/professional-permissions-fields";
import {
  WeekGridEditor,
  fillWeek,
  type DayRanges,
} from "@/components/admin/week-grid-editor";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import { compressImage } from "@/lib/compress-image";
import { formatWhatsapp } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";
import {
  DEFAULT_BARBER_PERMISSIONS,
  type ProfessionalPermissions,
} from "@/lib/professional-permissions";

export type ServiceOption = { id: string; name: string };

export type ProfessionalFormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  whatsapp: string;
  email: string;
  instagram: string;
  photoUrl: string | null;
  commissionPercent: number;
  serviceIds: string[];
  schedule: DayRanges[];
  permissions: ProfessionalPermissions;
};

type ProfessionalFormProps = {
  services: ServiceOption[];
  businessDays: BusinessDay[];
  initialValues?: ProfessionalFormValues;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  isEdit?: boolean;
};

export function ProfessionalForm({
  services,
  businessDays,
  initialValues,
  onSubmit,
  submitLabel,
  isEdit = false,
}: ProfessionalFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    initialValues?.photoUrl ?? null
  );
  const [whatsapp, setWhatsapp] = useState(
    formatWhatsapp(initialValues?.whatsapp ?? "")
  );
  const [serviceIds, setServiceIds] = useState<string[]>(
    initialValues?.serviceIds ?? []
  );
  const [schedule, setSchedule] = useState<DayRanges[]>(() =>
    fillWeek(initialValues?.schedule ?? [])
  );
  const [permissions, setPermissions] = useState<ProfessionalPermissions>(
    initialValues?.permissions ?? { ...DEFAULT_BARBER_PERMISSIONS }
  );
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPreview(URL.createObjectURL(compressed));
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      fileInputRef.current.files = dataTransfer.files;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    formData.set("schedule", JSON.stringify(schedule));
    appendPermissionsToFormData(formData, permissions);

    const result = await onSubmit(formData);

    if (result.ok) {
      toast.success(
        isEdit ? "Profissional atualizado." : "Profissional cadastrado."
      );
      router.push("/admin/profissionais");
      router.refresh();
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AdminFormSectionCard
        title="Perfil"
        description="Apelido e foto são o que o cliente vê ao agendar."
      >
        <div className="flex flex-col gap-6">
          <AdminFormPhotoUpload
            preview={preview}
            inputRef={fileInputRef}
            onChange={(event) => void handlePhotoChange(event)}
            shape="circle"
          />

          <AdminFormFields columns={2}>
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="Ex: Carlos"
                defaultValue={initialValues?.firstName}
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Ex: Silva"
                defaultValue={initialValues?.lastName}
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nickname">Apelido</Label>
              <Input
                id="nickname"
                name="nickname"
                placeholder="Ex: Carlão"
                defaultValue={initialValues?.nickname}
                required
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                É assim que o cliente vê esse profissional na agenda.
              </p>
            </div>
          </AdminFormFields>
        </div>
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Comissão e contato"
        description="Percentual sobre serviços na comanda e formas de contato."
      >
        <AdminFormFields columns={2}>
          <div className="space-y-2">
            <Label htmlFor="commissionPercent">Comissão (%)</Label>
            <Input
              id="commissionPercent"
              name="commissionPercent"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              defaultValue={initialValues?.commissionPercent ?? 50}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 99999-8888"
              value={whatsapp}
              onChange={(event) =>
                setWhatsapp(formatWhatsapp(event.target.value))
              }
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="instagram">Instagram (opcional)</Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="instagram"
                name="instagram"
                placeholder="usuario"
                defaultValue={initialValues?.instagram}
                className="pl-9"
                disabled={saving}
              />
            </div>
          </div>
        </AdminFormFields>
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Acesso ao sistema"
        description="E-mail e senha para o barbeiro entrar no painel."
      >
        <AdminFormFields columns={2}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="barbeiro@email.com"
              defaultValue={initialValues?.email}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEdit ? "Nova senha" : "Senha"}
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                minLength={6}
                required={!isEdit}
                placeholder={
                  isEdit ? "Deixe vazio para manter" : "Mínimo 6 caracteres"
                }
                className="pr-10"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </AdminFormFields>
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Serviços"
        description="O cliente só agenda com ele os serviços marcados."
      >
        {services.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum serviço cadastrado ainda.
          </div>
        ) : (
          <CheckboxGroup
            name="serviceIds"
            options={services.map((service) => ({
              id: service.id,
              label: service.name,
            }))}
            value={serviceIds}
            onChange={setServiceIds}
          />
        )}
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Permissões no painel"
        description="O que esse profissional pode fazer na agenda e nas comandas."
      >
        <ProfessionalPermissionsFields
          value={permissions}
          onChange={setPermissions}
        />
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Horário de atendimento"
        description="Dia desligado é folga. Dá para ter pausa no meio do dia."
      >
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() =>
              setSchedule(
                businessDays.map((day) => ({
                  weekday: day.weekday,
                  ranges: day.active
                    ? [{ startTime: day.openTime, endTime: day.closeTime }]
                    : [],
                }))
              )
            }
          >
            <Copy />
            Copiar horário da barbearia
          </Button>
        </div>

        <WeekGridEditor
          days={schedule}
          businessDays={businessDays}
          onChange={setSchedule}
        />
      </AdminFormSectionCard>

      <AdminFormActions
        onCancel={() => router.push("/admin/profissionais")}
        submitLabel={submitLabel}
        saving={saving}
      />
    </form>
  );
}
