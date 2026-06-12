"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSectionTitle } from "@/components/admin/form-section";
import { WEEKDAYS } from "@/lib/format";
import { saveBusinessHours } from "@/app/admin/(panel)/configuracoes/actions";

const SLOT_STEPS = [15, 30, 45, 60];

export type BusinessDay = {
  weekday: number;
  active: boolean;
  openTime: string;
  closeTime: string;
};

type BusinessHoursFormProps = {
  initialDays: BusinessDay[];
  initialSlotStep: number;
  readOnly?: boolean;
};

export function BusinessHoursForm({
  initialDays,
  initialSlotStep,
  readOnly = false,
}: BusinessHoursFormProps) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [slotStep, setSlotStep] = useState(initialSlotStep);
  const [saving, setSaving] = useState(false);

  function updateDay(weekday: number, patch: Partial<BusinessDay>) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d))
    );
  }

  async function handleSave() {
    setSaving(true);
    const result = await saveBusinessHours(days, slotStep);
    if (result.ok) {
      toast.success("Horário da barbearia salvo.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <FormSectionTitle
          icon={Store}
          title="Horário da barbearia"
          description="Os barbeiros só atendem dentro desse horário."
        />

        <div className="flex flex-col divide-y">
          {days.map((day) => (
            <div
              key={day.weekday}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <div className="flex w-32 items-center gap-3">
                <Switch
                  checked={day.active}
                  disabled={readOnly}
                  onCheckedChange={(checked) =>
                    updateDay(day.weekday, { active: checked })
                  }
                  aria-label={`${WEEKDAYS[day.weekday]} aberto`}
                />
                <span className="text-sm font-medium">
                  {WEEKDAYS[day.weekday]}
                </span>
              </div>

              {day.active ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.openTime}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateDay(day.weekday, { openTime: e.target.value })
                    }
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateDay(day.weekday, { closeTime: e.target.value })
                    }
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Intervalo da agenda</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              De quantos em quantos minutos os horários aparecem pro cliente.
            </p>
          </div>
          <Select
            value={String(slotStep)}
            onValueChange={(v) => setSlotStep(Number(v))}
            disabled={readOnly}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_STEPS.map((step) => (
                <SelectItem key={step} value={String(step)}>
                  {step === 60 ? "1 hora" : `${step} minutos`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!readOnly && (
          <Button onClick={handleSave} disabled={saving} className="self-end">
            {saving ? "Salvando..." : "Salvar horário da barbearia"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
