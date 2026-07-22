"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_BARBER_PERMISSIONS,
  PERMISSION_LABELS,
  type ProfessionalPermissions,
} from "@/lib/professional-permissions";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ProfessionalPermissionsFieldsProps = {
  value: ProfessionalPermissions;
  onChange: (next: ProfessionalPermissions) => void;
  tone?: "default" | "dark";
};

function PermissionSwitch({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  tone = "default",
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  tone?: "default" | "dark";
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5",
        dark ? "border-white/10 bg-[#1a1b1e]/60" : ""
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label
          htmlFor={id}
          className={cn("text-sm font-medium", dark && "text-[#f5f5f5]")}
        >
          {title}
        </Label>
        <p
          className={cn(
            "text-xs",
            dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
          )}
        >
          {description}
        </p>
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
  tone = "default",
}: ProfessionalPermissionsFieldsProps) {
  const dark = tone === "dark";
  const agendaItems = PERMISSION_LABELS.filter((item) => item.group === "agenda");
  const comandaItems = PERMISSION_LABELS.filter(
    (item) => item.group === "comanda"
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-3">
        <p
          className={cn(
            dark ? ADMIN_SURFACE.sectionLabel : "text-xs font-medium uppercase tracking-wide text-muted-foreground"
          )}
        >
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
              tone={tone}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p
          className={cn(
            dark ? ADMIN_SURFACE.sectionLabel : "text-xs font-medium uppercase tracking-wide text-muted-foreground"
          )}
        >
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
              tone={tone}
            />
          ))}
        </div>
      </div>

      <ButtonResetDefaults
        tone={tone}
        onReset={() => onChange({ ...DEFAULT_BARBER_PERMISSIONS })}
      />
    </div>
  );
}

function ButtonResetDefaults({
  onReset,
  tone = "default",
}: {
  onReset: () => void;
  tone?: "default" | "dark";
}) {
  const dark = tone === "dark";

  return (
    <button
      type="button"
      onClick={onReset}
      className={cn(
        "w-fit text-xs underline-offset-2 hover:underline",
        dark
          ? cn(ADMIN_SURFACE.muted, "hover:text-[#ecf15e]")
          : "text-muted-foreground hover:text-foreground"
      )}
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
