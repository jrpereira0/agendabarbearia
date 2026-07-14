"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { CheckboxGroup } from "@/components/admin/checkbox-group";
import {
  AdminFormActions,
  AdminFormFields,
  AdminFormPhotoUpload,
  AdminFormSectionCard,
} from "@/components/admin/admin-form-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compressImage } from "@/lib/compress-image";
import { formatPriceBRL, WEEKDAYS } from "@/lib/format";
import { formatServiceCatalogPriceLabel } from "@/lib/public-service-prices";
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
  priceFrom: boolean;
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
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialValues?.durationMinutes
      ? String(initialValues.durationMinutes)
      : ""
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
  const [priceFrom, setPriceFrom] = useState(initialValues?.priceFrom ?? false);
  const [activeTab, setActiveTab] = useState("info");
  const [saving, setSaving] = useState(false);

  const openWeekdays = useMemo(
    () => businessHours.filter((row) => row.active).map((row) => row.weekday),
    [businessHours]
  );

  const catalogPriceLabel = useMemo(() => {
    const prices = weekdayRows
      .filter((row) => row.shopOpen && row.offered && row.priceCents > 0)
      .map((row) => ({ weekday: row.weekday, priceCents: row.priceCents }));

    if (prices.length === 0) return null;

    return formatServiceCatalogPriceLabel(
      Math.min(...prices.map((row) => row.priceCents)),
      prices,
      priceFrom
    );
  }, [weekdayRows, priceFrom]);

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

  function handleBulkPriceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do serviço.");
      setActiveTab("info");
      return;
    }

    const duration = Number.parseInt(durationMinutes, 10);
    if (!Number.isFinite(duration) || duration < 5) {
      toast.error("Informe a duração do atendimento (mínimo 5 minutos).");
      setActiveTab("agenda");
      return;
    }

    setSaving(true);

    const formData = new FormData(event.currentTarget);
    formData.set("name", trimmedName);
    formData.set("description", description.trim());
    formData.set("durationMinutes", String(duration));
    formData.set("priceFrom", priceFrom ? "on" : "off");
    formData.delete("professionalIds");
    for (const professionalId of professionalIds) {
      formData.append("professionalIds", professionalId);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="info">Dados</TabsTrigger>
          <TabsTrigger value="precos">Preços</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent
          value="info"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AdminFormSectionCard
            title="Informações do serviço"
            description="Nome, foto e descrição que o cliente vê ao escolher."
          >
            <div className="flex flex-col gap-6">
              <AdminFormPhotoUpload
                preview={preview}
                inputRef={fileInputRef}
                onChange={(event) => void handlePhotoChange(event)}
              />

              <AdminFormFields columns={1}>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do serviço</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Corte degradê"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Ex: Corte na tesoura e máquina, com acabamento na navalha."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    disabled={saving}
                  />
                </div>
              </AdminFormFields>
            </div>
          </AdminFormSectionCard>
        </TabsContent>

        <TabsContent
          value="precos"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AdminFormSectionCard
            title="Preço por dia da semana"
            description="Marque os dias em que o serviço é oferecido e defina o preço de cada um."
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3.5">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="priceFrom" className="text-sm font-medium">
                    Valor a partir de
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marque quando o preço final varia no atendimento — por exemplo,
                    progressiva conforme o tamanho do cabelo. O valor cadastrado é
                    só referência mínima para o cliente.
                  </p>
                </div>
                <Switch
                  id="priceFrom"
                  checked={priceFrom}
                  onCheckedChange={setPriceFrom}
                  disabled={saving}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="bulkPrice">Mesmo preço em todos os dias abertos</Label>
                  <Input
                    id="bulkPrice"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={bulkPriceCents > 0 ? formatPriceBRL(bulkPriceCents) : ""}
                    onChange={handleBulkPriceChange}
                    disabled={saving}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyBulkPrice}
                  disabled={saving}
                >
                  Aplicar
                </Button>
              </div>

              {openWeekdays.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A barbearia não tem dias abertos cadastrados. Ajuste em
                  Configurações antes de cadastrar serviços.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Dia</th>
                        <th className="px-4 py-3 font-medium">Oferece</th>
                        <th className="px-4 py-3 font-medium">Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekdayRows.map((row) => (
                        <tr
                          key={row.weekday}
                          className={
                            row.shopOpen
                              ? "border-b last:border-0"
                              : "border-b bg-muted/20 text-muted-foreground last:border-0"
                          }
                        >
                          <td className="px-4 py-3 font-medium">
                            {WEEKDAYS[row.weekday]}
                            {!row.shopOpen ? (
                              <span className="ml-2 text-xs font-normal">
                                (fechado)
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {row.shopOpen ? (
                              <Checkbox
                                id={`weekday-offered-${row.weekday}`}
                                checked={row.offered}
                                disabled={saving}
                                onCheckedChange={(checked) =>
                                  updateWeekdayRow(row.weekday, {
                                    offered: checked === true,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              inputMode="numeric"
                              placeholder="R$ 0,00"
                              disabled={!row.shopOpen || !row.offered || saving}
                              value={
                                row.offered && row.priceCents > 0
                                  ? formatPriceBRL(row.priceCents)
                                  : ""
                              }
                              onChange={(event) => {
                                const digits = event.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 8);
                                updateWeekdayRow(row.weekday, {
                                  priceCents: Number(digits),
                                });
                              }}
                              className="max-w-[140px]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {catalogPriceLabel ? (
                <p className="text-sm text-muted-foreground">
                  Na listagem aparece como{" "}
                  <span className="font-medium text-foreground">
                    {catalogPriceLabel}
                  </span>
                </p>
              ) : null}
            </div>
          </AdminFormSectionCard>
        </TabsContent>

        <TabsContent
          value="agenda"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AdminFormSectionCard
            title="Agenda"
            description="Duração do atendimento e quem pode fazer esse serviço."
          >
            <AdminFormFields columns={2}>
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duração (minutos)</Label>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  placeholder="Ex: 40"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Define quais horários aparecem livres na agenda.
                </p>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <Label>Profissionais que fazem</Label>
                {professionals.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum profissional cadastrado. Cadastre em Profissionais e
                    volte aqui para marcar.
                  </div>
                ) : (
                  <CheckboxGroup
                    name="professionalIds"
                    options={professionals.map((professional) => ({
                      id: professional.id,
                      label: professional.nickname,
                    }))}
                    value={professionalIds}
                    onChange={setProfessionalIds}
                  />
                )}
              </div>
            </AdminFormFields>
          </AdminFormSectionCard>
        </TabsContent>
      </Tabs>

      <AdminFormActions
        onCancel={() => router.push("/admin/servicos")}
        submitLabel={submitLabel}
        saving={saving}
      />
    </form>
  );
}
