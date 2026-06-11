"use client";

import { Checkbox } from "@/components/ui/checkbox";

export type CheckboxOption = { id: string; label: string };

type CheckboxGroupProps = {
  name: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
};

// Grupo de checkboxes padrão dos formulários, com "Selecionar todos".
// Os itens marcados entram no FormData pelo `name` informado.
export function CheckboxGroup({
  name,
  options,
  value,
  onChange,
}: CheckboxGroupProps) {
  const allSelected = options.length > 0 && value.length === options.length;
  const someSelected = value.length > 0 && !allSelected;

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium">
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
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/50 ${
                checked ? "border-primary bg-muted/50" : ""
              }`}
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
