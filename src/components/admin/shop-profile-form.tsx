"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FormSectionTitle } from "@/components/admin/form-section";
import { compressImage } from "@/lib/compress-image";
import { formatCep, formatWhatsapp } from "@/lib/format";
import { fetchAddressByCep } from "@/lib/viacep";
import { saveShopProfile } from "@/app/admin/(panel)/configuracoes/actions";

export type ShopProfileValues = {
  shopName: string;
  bio: string;
  cep: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  whatsapp: string;
  instagram: string;
  logoUrl: string | null;
};

type ShopProfileFormProps = {
  initialValues: ShopProfileValues;
};

export function ShopProfileForm({ initialValues }: ShopProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialValues.logoUrl);
  const [whatsapp, setWhatsapp] = useState(
    initialValues.whatsapp ? formatWhatsapp(initialValues.whatsapp) : ""
  );
  const [cep, setCep] = useState(initialValues.cep);
  const [street, setStreet] = useState(initialValues.street);
  const [neighborhood, setNeighborhood] = useState(initialValues.neighborhood);
  const [city, setCity] = useState(initialValues.city);
  const [state, setState] = useState(initialValues.state);
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  async function lookupCep(rawCep?: string) {
    const digits = (rawCep ?? cep).replace(/\D/g, "");
    if (digits.length !== 8) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }

    setLoadingCep(true);
    const result = await fetchAddressByCep(digits);
    setLoadingCep(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setCep(formatCep(result.cep));
    setStreet(result.street);
    setNeighborhood(result.neighborhood);
    setCity(result.city);
    setState(result.state);
  }

  function handleCepChange(value: string) {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      void lookupCep(digits);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      formData.set("logo", await compressImage(logo));
    }
    formData.set("whatsapp", whatsapp.replace(/\D/g, ""));
    formData.set("cep", cep.replace(/\D/g, ""));
    formData.set("street", street);
    formData.set("neighborhood", neighborhood);
    formData.set("city", city);
    formData.set("state", state);

    const result = await saveShopProfile(formData);

    if (result.ok) {
      toast.success("Configurações salvas.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <FormSectionTitle
            icon={Store}
            title="Perfil da barbearia"
            description="Nome, bio e contato que o cliente vê na página de agendamento."
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted transition-colors hover:bg-muted/80"
            >
              {preview ? (
                <Image
                  src={preview}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized
                />
              ) : (
                <Camera className="size-6 text-muted-foreground" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              name="logo"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />

            <div className="grid flex-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="shopName">Nome da barbearia</Label>
                <Input
                  id="shopName"
                  name="shopName"
                  defaultValue={initialValues.shopName}
                  placeholder="Ex: Barbearia do João"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  defaultValue={initialValues.bio}
                  placeholder="Conte em poucas linhas o estilo da barbearia, os diferenciais e o que o cliente pode esperar."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Aparece logo abaixo do nome na página de agendamento.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <FormSectionTitle
              icon={MapPin}
              title="Endereço"
              description="Digite o CEP para preencher rua, bairro e cidade automaticamente."
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => lookupCep()}
                  disabled={loadingCep}
                  className="w-full sm:w-auto"
                >
                  {loadingCep ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    "Buscar CEP"
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                name="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Preenchido pelo CEP"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="addressNumber">Número</Label>
                <Input
                  id="addressNumber"
                  name="addressNumber"
                  defaultValue={initialValues.addressNumber}
                  placeholder="Ex: 123"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="addressComplement">Complemento</Label>
                <Input
                  id="addressComplement"
                  name="addressComplement"
                  defaultValue={initialValues.addressComplement}
                  placeholder="Sala, loja, etc. (opcional)"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2 sm:col-span-1">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Bairro"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="shopWhatsapp">WhatsApp da barbearia</Label>
              <Input
                id="shopWhatsapp"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                name="instagram"
                defaultValue={initialValues.instagram}
                placeholder="@sua_barbearia"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
