"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { CalendarDays, Camera, Clock, Scissors, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxGroup } from "@/components/admin/checkbox-group";
import { FormSectionTitle } from "@/components/admin/form-section";
import { compressImage } from "@/lib/compress-image";
import { formatPriceBRL, WEEKDAYS } from "@/lib/format";
import { weekdayPriceInputsFromRows } from "@/lib/service-weekday-prices";
import type { ActionResult } from "@/lib/require-owner";

export type ProfessionalOption = { id: string; nickname: string };

export type BusinessHourOption = {
  weekday: number;
  active: boolean;
};

export type ServiceFormValues = {
  name: string;
  description: string;
  durationMinutes: number;
  photoUrl: string | null;
  professionalIds: string[];
  weekdayPrices: { weekday: number; priceCents: number }[];
};

type WeekdayRowState = {
  weekday: number;
  shopOpen: boolean;
  offered: boolean;
  priceCents: number;
};

type ServiceFormProps = {
  professionals: ProfessionalOption[];
  businessHours: BusinessHourOption[];
  initialValues?: ServiceFormValues;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  isEdit?: boolean;
};

function buildInitialWeekdayRows(
  businessHours: BusinessHourOption[],
  weekdayPrices: { weekday: number; priceCents: number }[]
): WeekdayRowState[] {
  const inputs = weekdayPriceInputsFromRows(weekdayPrices, businessHours);
  return inputs.map((row) => ({
    weekday: row.weekday,
    shopOpen: row.shopOpen,
    offered: row.priceCents !== null,
    priceCents: row.priceCents ?? 0,
  }));
}

export function ServiceForm({
  professionals,
  businessHours,
  initialValues,
  onSubmit,
  submitLabel,
  isEdit = false,
}: ServiceFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    initialValues?.photoUrl ?? null
  );
  const [professionalIds, setProfessionalIds] = useState<string[]>(
    initialValues?.professionalIds ?? []
  );
  const [weekdayRows, setWeekdayRows] = useState<WeekdayRowState[]>(() =>
    buildInitialWeekdayRows(
      businessHours,
      initialValues?.weekdayPrices ?? []
    )
  );
  const [bulkPriceCents, setBulkPriceCents] = useState(0);
  const [saving, setSaving] = useState(false);

  const openWeekdays = useMemo(
    () => businessHours.filter((row) => row.active).map((row) => row.weekday),
    [businessHours]
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  function handleBulkPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setBulkPriceCents(Number(digits));
  }

  function applyBulkPrice() {
    if (bulkPriceCents < 1) {
      toast.error("Informe um preço válido para aplicar em todos os dias.");
      return;
    }
    setWeekdayRows((rows) =>
      rows.map((row) =>
        row.shopOpen
          ? { ...row, offered: true, priceCents: bulkPriceCents }
          : row
      )
    );
    toast.success("Preço aplicado nos dias abertos.");
  }

  function updateWeekdayRow(
    weekday: number,
    patch: Partial<Pick<WeekdayRowState, "offered" | "priceCents">>
  ) {
    setWeekdayRows((rows) =>
      rows.map((row) =>
        row.weekday === weekday ? { ...row, ...patch } : row
      )
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      formData.set("photo", await compressImage(photo));
    }

    for (const row of weekdayRows) {
      if (!row.shopOpen) continue;
      if (row.offered) {
        formData.set(`weekdayOffered_${row.weekday}`, "on");
        formData.set(`weekdayPriceCents_${row.weekday}`, String(row.priceCents));
      }
    }

    const result = await onSubmit(formData);

    if (result.ok) {
      toast.success(isEdit ? "Serviço atualizado." : "Serviço cadastrado.");
      router.push("/admin/servicos");
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
          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Scissors}
              title="Serviço"
              description="Nome, foto e descrição que o cliente vê ao escolher."
            />

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative size-24 shrink-0 overflow-hidden rounded-lg border-2 border-dashed transition-colors hover:border-primary"
                aria-label="Escolher foto"
              >
                {preview ? (
                  <>
                    <Image
                      src={preview}
                      alt="Foto do serviço"
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
                  JPG ou PNG. Aparece na lista de serviços do cliente.
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome do serviço</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Corte degradê"
                defaultValue={initialValues?.name}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Ex: Corte na tesoura e máquina, com acabamento na navalha."
                defaultValue={initialValues?.description}
                rows={3}
              />
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={CalendarDays}
              title="Preço por dia da semana"
              description="Marque em quais dias o serviço é oferecido e o preço de cada um. Dias em que a barbearia está fechada ficam bloqueados."
            />

            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="bulkPrice">Mesmo preço em todos os dias abertos</Label>
                <Input
                  id="bulkPrice"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={bulkPriceCents > 0 ? formatPriceBRL(bulkPriceCents) : ""}
                  onChange={handleBulkPriceChange}
                />
              </div>
              <Button type="button" variant="outline" onClick={applyBulkPrice}>
                Aplicar
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {weekdayRows.map((row) => (
                <div
                  key={row.weekday}
                  className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_140px] sm:items-center ${
                    row.shopOpen ? "" : "bg-muted/40 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {row.shopOpen ? (
                      <Checkbox
                        id={`weekday-offered-${row.weekday}`}
                        checked={row.offered}
                        onCheckedChange={(checked) =>
                          updateWeekdayRow(row.weekday, {
                            offered: checked === true,
                          })
                        }
                      />
                    ) : (
                      <span className="size-4 shrink-0 rounded-sm border bg-muted" />
                    )}
                    <Label
                      htmlFor={`weekday-offered-${row.weekday}`}
                      className="font-medium"
                    >
                      {WEEKDAYS[row.weekday]}
                    </Label>
                  </div>

                  <span className="text-xs text-muted-foreground sm:text-right">
                    {row.shopOpen ? "Oferece neste dia" : "Barbearia fechada"}
                  </span>

                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    disabled={!row.shopOpen || !row.offered}
                    value={
                      row.offered && row.priceCents > 0
                        ? formatPriceBRL(row.priceCents)
                        : ""
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      updateWeekdayRow(row.weekday, {
                        priceCents: Number(digits),
                      });
                    }}
                  />
                </div>
              ))}
            </div>

            {openWeekdays.length === 0 && (
              <p className="text-sm text-muted-foreground">
                A barbearia não tem dias abertos cadastrados. Ajuste em
                Configurações antes de cadastrar serviços.
              </p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Clock}
              title="Duração"
              description="Define quais horários aparecem livres na agenda."
            />

            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="durationMinutes">Duração (minutos)</Label>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={5}
                max={480}
                step={5}
                placeholder="Ex: 40"
                defaultValue={initialValues?.durationMinutes || ""}
                required
              />
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Users}
              title="Profissionais que fazem"
              description="O cliente só vê esse serviço ao agendar com os profissionais marcados."
            />

            {professionals.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum profissional cadastrado ainda. Cadastre em{" "}
                <span className="font-medium text-foreground">
                  Profissionais
                </span>{" "}
                e volte aqui pra marcar.
              </div>
            ) : (
              <CheckboxGroup
                name="professionalIds"
                options={professionals.map((p) => ({
                  id: p.id,
                  label: p.nickname,
                }))}
                value={professionalIds}
                onChange={setProfessionalIds}
              />
            )}
          </section>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 mt-6 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/servicos")}
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
