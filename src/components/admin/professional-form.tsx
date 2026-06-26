"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  AtSign,
  Camera,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Percent,
  Phone,
  Scissors,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CheckboxGroup } from "@/components/admin/checkbox-group";
import { FormSectionTitle } from "@/components/admin/form-section";
import {
  WeekGridEditor,
  fillWeek,
  type DayRanges,
} from "@/components/admin/week-grid-editor";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import { compressImage } from "@/lib/compress-image";
import { formatWhatsapp } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";

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
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      formData.set("photo", await compressImage(photo));
    }
    formData.set("schedule", JSON.stringify(schedule));

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
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="flex flex-col gap-8">
          {/* Identificação */}
          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={User}
              title="Identificação"
              description="O apelido e a foto são o que o cliente vê ao agendar."
            />

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-dashed transition-colors hover:border-primary"
                aria-label="Escolher foto"
              >
                {preview ? (
                  <>
                    <Image
                      src={preview}
                      alt="Foto do profissional"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="size-5 text-white" />
                    </span>
                  </>
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground">
                    <Camera className="size-5" />
                    <span className="text-[11px] font-medium">Foto</span>
                  </span>
                )}
              </button>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? "Trocar foto" : "Enviar foto"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  JPG ou PNG, de preferência quadrada.
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Ex: Carlos"
                  defaultValue={initialValues?.firstName}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Ex: Silva"
                  defaultValue={initialValues?.lastName}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">Apelido</Label>
              <Input
                id="nickname"
                name="nickname"
                placeholder="Ex: Carlão"
                defaultValue={initialValues?.nickname}
                required
              />
              <span className="text-xs text-muted-foreground">
                É assim que o cliente vai ver esse profissional na agenda.
              </span>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Percent}
              title="Comissão"
              description="Percentual sobre o valor cobrado de cada serviço na comanda."
            />
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="commissionPercent">% de comissão</Label>
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
              />
              <span className="text-xs text-muted-foreground">
                Usado ao fechar a comanda. Ex.: 50% de R$ 40 = R$ 20 para o barbeiro.
              </span>
            </div>
          </section>

          <Separator />

          {/* Contato */}
          <section className="flex flex-col gap-5">
            <FormSectionTitle icon={Phone} title="Contato e redes" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 99999-8888"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="instagram">Instagram (opcional)</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="instagram"
                    name="instagram"
                    placeholder="usuario"
                    defaultValue={initialValues?.instagram}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Acesso */}
          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={KeyRound}
              title="Acesso ao sistema"
              description="O barbeiro entra com esse e-mail e senha pra ver a própria agenda."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="barbeiro@email.com"
                  defaultValue={initialValues?.email}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
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
                    placeholder={isEdit ? "Deixe vazio pra manter" : "Mínimo 6 caracteres"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
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
            </div>
          </section>

          <Separator />

          {/* Serviços */}
          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Scissors}
              title="Serviços que ele faz"
              description="O cliente só consegue agendar com ele os serviços marcados."
            />

            {services.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum serviço cadastrado ainda. Cadastre em{" "}
                <span className="font-medium text-foreground">Serviços</span> e
                volte aqui pra marcar.
              </div>
            ) : (
              <CheckboxGroup
                name="serviceIds"
                options={services.map((s) => ({ id: s.id, label: s.name }))}
                value={serviceIds}
                onChange={setServiceIds}
              />
            )}
          </section>

          <Separator />

          {/* Horários */}
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <FormSectionTitle
                icon={Clock}
                title="Horário de atendimento"
                description="Dia desligado é folga. Dá pra ter pausa: ex 09:00–12:00 e 14:00–19:00."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSchedule(
                    businessDays.map((b) => ({
                      weekday: b.weekday,
                      ranges: b.active
                        ? [{ startTime: b.openTime, endTime: b.closeTime }]
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
          </section>
        </CardContent>
      </Card>

      {/* Barra de ações fixa no rodapé */}
      <div className="sticky bottom-0 z-10 mt-6 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/profissionais")}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="min-w-44">
            {saving ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
