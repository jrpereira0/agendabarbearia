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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfessionalCommissionsPanel } from "@/components/admin/professional-commissions-panel";
import { compressImage } from "@/lib/compress-image";
import { formatWhatsapp } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";
import type { CommissionPayout } from "@/lib/commission-payout-service";
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
  /** Só na edição: painel de comissões / histórico de pagamentos. */
  commissions?: {
    professionalId: string;
    today: string;
    from: string;
    to: string;
    openCommissionCents: number;
    payouts: CommissionPayout[];
  };
};

export function ProfessionalForm({
  services,
  businessDays,
  initialValues,
  onSubmit,
  submitLabel,
  isEdit = false,
  commissions,
}: ProfessionalFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    initialValues?.photoUrl ?? null
  );
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [nickname, setNickname] = useState(initialValues?.nickname ?? "");
  const [commissionPercent, setCommissionPercent] = useState(
    String(initialValues?.commissionPercent ?? 50)
  );
  const [whatsapp, setWhatsapp] = useState(
    formatWhatsapp(initialValues?.whatsapp ?? "")
  );
  const [instagram, setInstagram] = useState(initialValues?.instagram ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [password, setPassword] = useState("");
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
  const [activeTab, setActiveTab] = useState("dados");
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

    if (!firstName.trim() || !lastName.trim() || !nickname.trim()) {
      toast.error("Preencha nome, sobrenome e apelido.");
      setActiveTab("dados");
      return;
    }

    const commission = Number.parseInt(commissionPercent, 10);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      toast.error("Informe uma comissão entre 0 e 100%.");
      setActiveTab("dados");
      return;
    }

    if (whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido.");
      setActiveTab("dados");
      return;
    }

    if (!email.trim()) {
      toast.error("Informe o e-mail de acesso.");
      setActiveTab("acesso");
      return;
    }

    if (!isEdit && password.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres.");
      setActiveTab("acesso");
      return;
    }

    if (isEdit && password && password.length < 6) {
      toast.error("A nova senha precisa ter no mínimo 6 caracteres.");
      setActiveTab("acesso");
      return;
    }

    setSaving(true);

    const formData = new FormData(event.currentTarget);
    formData.set("firstName", firstName.trim());
    formData.set("lastName", lastName.trim());
    formData.set("nickname", nickname.trim());
    formData.set("commissionPercent", String(commission));
    formData.set("whatsapp", whatsapp.replace(/\D/g, ""));
    formData.set("instagram", instagram.trim());
    formData.set("email", email.trim());
    formData.set("password", password);
    formData.set("schedule", JSON.stringify(schedule));
    formData.delete("serviceIds");
    for (const serviceId of serviceIds) {
      formData.append("serviceIds", serviceId);
    }
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="acesso">Acesso</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="horario">Horário</TabsTrigger>
          {isEdit && commissions && (
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="dados"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <div className="flex flex-col gap-6">
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
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Ex: Silva"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="nickname">Apelido</Label>
                    <Input
                      id="nickname"
                      name="nickname"
                      placeholder="Ex: Carlão"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
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
                    value={commissionPercent}
                    onChange={(event) =>
                      setCommissionPercent(event.target.value)
                    }
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
                      value={instagram}
                      onChange={(event) => setInstagram(event.target.value)}
                      className="pl-9"
                      disabled={saving}
                    />
                  </div>
                </div>
              </AdminFormFields>
            </AdminFormSectionCard>
          </div>
        </TabsContent>

        <TabsContent
          value="acesso"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <div className="flex flex-col gap-6">
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
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                      placeholder={
                        isEdit
                          ? "Deixe vazio para manter"
                          : "Mínimo 6 caracteres"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pr-10"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={
                        showPassword ? "Esconder senha" : "Mostrar senha"
                      }
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
              title="Permissões no painel"
              description="O que esse profissional pode fazer na agenda e nas comandas."
            >
              <ProfessionalPermissionsFields
                value={permissions}
                onChange={setPermissions}
              />
            </AdminFormSectionCard>
          </div>
        </TabsContent>

        <TabsContent
          value="servicos"
          forceMount
          className="data-[state=inactive]:hidden"
        >
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
        </TabsContent>

        <TabsContent
          value="horario"
          forceMount
          className="data-[state=inactive]:hidden"
        >
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
        </TabsContent>

        {isEdit && commissions && (
          <TabsContent value="comissoes">
            <ProfessionalCommissionsPanel
              professionalId={commissions.professionalId}
              professionalNickname={nickname || "Barbeiro"}
              today={commissions.today}
              from={commissions.from}
              to={commissions.to}
              openCommissionCents={commissions.openCommissionCents}
              payouts={commissions.payouts}
            />
          </TabsContent>
        )}
      </Tabs>

      <AdminFormActions
        onCancel={() => router.push("/admin/profissionais")}
        submitLabel={submitLabel}
        saving={saving}
      />
    </form>
  );
}
