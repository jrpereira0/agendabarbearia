"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_BARBER_PERMISSIONS,
  PERMISSION_LABELS,
  type ProfessionalPermissions,
} from "@/lib/professional-permissions";

type ProfessionalPermissionsFieldsProps = {
  value: ProfessionalPermissions;
  onChange: (next: ProfessionalPermissions) => void;
};

function PermissionSwitch({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
      />
    </div>
  );
}

export function ProfessionalPermissionsFields({
  value,
  onChange,
}: ProfessionalPermissionsFieldsProps) {
  const agendaItems = PERMISSION_LABELS.filter((item) => item.group === "agenda");
  const comandaItems = PERMISSION_LABELS.filter((item) => item.group === "comanda");

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Agenda
        </p>
        <div className="flex flex-col gap-2">
          {agendaItems.map((item) => (
            <PermissionSwitch
              key={item.key}
              id={`perm-${item.key}`}
              title={item.title}
              description={item.description}
              checked={value[item.key]}
              onCheckedChange={(checked) =>
                onChange({ ...value, [item.key]: checked })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Comanda
        </p>
        <div className="flex flex-col gap-2">
          {comandaItems.map((item) => (
            <PermissionSwitch
              key={item.key}
              id={`perm-${item.key}`}
              title={item.title}
              description={item.description}
              checked={value[item.key]}
              onCheckedChange={(checked) =>
                onChange({ ...value, [item.key]: checked })
              }
            />
          ))}
        </div>
      </div>

      <ButtonResetDefaults onReset={() => onChange({ ...DEFAULT_BARBER_PERMISSIONS })} />
    </div>
  );
}

function ButtonResetDefaults({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="w-fit text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      Restaurar padrão de barbeiro
    </button>
  );
}

export function appendPermissionsToFormData(
  formData: FormData,
  permissions: ProfessionalPermissions
) {
  for (const [key, enabled] of Object.entries(permissions)) {
    formData.set(key, enabled ? "1" : "0");
  }
}
