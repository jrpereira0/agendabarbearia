"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Clock, Scissors, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CheckboxGroup } from "@/components/admin/checkbox-group";
import { FormSectionTitle } from "@/components/admin/form-section";
import { compressImage } from "@/lib/compress-image";
import { formatPriceBRL } from "@/lib/format";
import type { ActionResult } from "@/lib/require-owner";

export type ProfessionalOption = { id: string; nickname: string };

export type ServiceFormValues = {
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  photoUrl: string | null;
  professionalIds: string[];
};

type ServiceFormProps = {
  professionals: ProfessionalOption[];
  initialValues?: ServiceFormValues;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  isEdit?: boolean;
};

export function ServiceForm({
  professionals,
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
  const [priceCents, setPriceCents] = useState(initialValues?.priceCents ?? 0);
  const [professionalIds, setProfessionalIds] = useState<string[]>(
    initialValues?.professionalIds ?? []
  );
  const [saving, setSaving] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setPriceCents(Number(digits));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      formData.set("photo", await compressImage(photo));
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
          {/* Serviço */}
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

          {/* Preço e duração */}
          <section className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Clock}
              title="Preço e duração"
              description="A duração define quais horários aparecem livres na agenda."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Preço</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={priceCents > 0 ? formatPriceBRL(priceCents) : ""}
                  onChange={handlePriceChange}
                  required
                />
                <input type="hidden" name="priceCents" value={priceCents} />
              </div>
              <div className="flex flex-col gap-2">
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
            </div>
          </section>

          <Separator />

          {/* Profissionais */}
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

      {/* Barra de ações fixa no rodapé */}
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
