"use client";

import type { ReactNode, RefObject } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminFormPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28">
      {children}
    </div>
  );
}

type AdminFormSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AdminFormSectionCard({
  title,
  description,
  children,
  className,
}: AdminFormSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        className
      )}
    >
      <div className="border-b bg-muted/20 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AdminFormFields({
  children,
  columns = 1,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

type AdminFormPhotoUploadProps = {
  preview: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  accept?: string;
  shape?: "square" | "circle";
  hint?: string;
};

export function AdminFormPhotoUpload({
  preview,
  inputRef,
  onChange,
  name = "photo",
  accept = "image/jpeg,image/png,image/webp",
  shape = "square",
  hint = "JPG ou PNG. Clique para trocar.",
}: AdminFormPhotoUploadProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative shrink-0 overflow-hidden border-2 border-dashed bg-muted/20 transition-colors hover:border-foreground/40",
          shape === "circle" ? "size-24 rounded-full" : "size-24 rounded-lg"
        )}
        aria-label="Escolher foto"
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Prévia da foto"
              fill
              className="object-cover"
              unoptimized
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </span>
          </>
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Camera className="size-5" />
            <span className="text-[11px] font-medium">Foto</span>
          </span>
        )}
      </button>
      <div className="min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {preview ? "Trocar foto" : "Enviar foto"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

type AdminFormActionsProps = {
  onCancel: () => void;
  submitLabel: string;
  saving?: boolean;
  disabled?: boolean;
};

export function AdminFormActions({
  onCancel,
  submitLabel,
  saving = false,
  disabled = false,
}: AdminFormActionsProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || disabled} className="min-w-40">
          {saving ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
