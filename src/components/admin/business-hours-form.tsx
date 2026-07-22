"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

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
    <div className={cn(ADMIN_SURFACE.panel, "flex flex-col gap-5 p-5 sm:p-6")}>
      <FormSectionTitle
        tone="dark"
        icon={Clock}
        title="Horário da barbearia"
        description="Os barbeiros só atendem dentro desse horário."
      />

      <div className="flex flex-col divide-y divide-white/10">
        {days.map((day) => (
          <div
            key={day.weekday}
            className="flex flex-wrap items-center gap-3 py-3.5"
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
              <span className="text-sm font-medium text-[#f5f5f5]">
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
                  className={cn("w-28", ADMIN_SURFACE.input)}
                />
                <span className={cn("text-sm", ADMIN_SURFACE.muted)}>às</span>
                <Input
                  type="time"
                  value={day.closeTime}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateDay(day.weekday, { closeTime: e.target.value })
                  }
                  className={cn("w-28", ADMIN_SURFACE.input)}
                />
              </div>
            ) : (
              <span className={cn("text-sm", ADMIN_SURFACE.muted)}>
                Fechado
              </span>
            )}
          </div>
        ))}
      </div>

      <Separator className="bg-white/10" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <DarkLabel>Intervalo da agenda</DarkLabel>
          <p className={cn("mt-1 text-sm", ADMIN_SURFACE.muted)}>
            De quantos em quantos minutos os horários aparecem pro cliente.
          </p>
        </div>
        <Select
          value={String(slotStep)}
          onValueChange={(v) => setSlotStep(Number(v))}
          disabled={readOnly}
        >
          <SelectTrigger
            className={cn("w-40", ADMIN_SURFACE.selectTrigger)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={ADMIN_SURFACE.popover}>
            {SLOT_STEPS.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {step === 60 ? "1 hora" : `${step} minutos`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className={ADMIN_SURFACE.btnPrimary}
          >
            {saving ? "Salvando..." : "Salvar horário"}
          </Button>
        </div>
      )}
    </div>
  );
}
