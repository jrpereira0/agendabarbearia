"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  inputClassName?: string;
};

// Barra de busca padrão das listagens do painel.
export function SearchInput({
  value,
  onChange,
  placeholder,
  onFocus,
  onBlur,
  className,
  inputClassName,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8b8d93]" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          "h-10 pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden",
          inputClassName
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-[#8b8d93] transition-colors hover:bg-white/10 hover:text-[#f5f5f5]"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
