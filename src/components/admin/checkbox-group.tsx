"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type CheckboxOption = { id: string; label: string };

type CheckboxGroupProps = {
  name: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  tone?: "default" | "dark";
};

// Grupo de checkboxes padrão dos formulários, com "Selecionar todos".
// Os itens marcados entram no FormData pelo `name` informado.
export function CheckboxGroup({
  name,
  options,
  value,
  onChange,
  tone = "default",
}: CheckboxGroupProps) {
  const dark = tone === "dark";
  const allSelected = options.length > 0 && value.length === options.length;
  const someSelected = value.length > 0 && !allSelected;

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={cn(
          "flex w-fit cursor-pointer items-center gap-3 text-sm font-medium",
          dark && "text-[#f5f5f5]"
        )}
      >
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={(checked) =>
            onChange(checked === true ? options.map((o) => o.id) : [])
          }
        />
        Selecionar todos
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = value.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors",
                dark
                  ? checked
                    ? "border-[rgb(236_241_94_/_35%)] bg-[rgb(236_241_94_/_10%)] text-[#f5f5f5]"
                    : "border-white/10 text-[#f5f5f5] hover:bg-white/[0.04]"
                  : checked
                    ? "border-primary bg-muted/50"
                    : "hover:bg-muted/50"
              )}
            >
              <Checkbox
                name={name}
                value={option.id}
                checked={checked}
                onCheckedChange={(c) => toggle(option.id, c === true)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
