"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FormSectionTitle } from "@/components/admin/form-section";
import type { ActionResult } from "@/lib/require-owner";

type ChangePasswordFormProps = {
  onSubmit: (formData: FormData) => Promise<ActionResult>;
};

export function ChangePasswordForm({ onSubmit }: ChangePasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const result = await onSubmit(new FormData(e.currentTarget));
    if (result.ok) {
      toast.success("Senha atualizada.");
      e.currentTarget.reset();
    } else {
      toast.error(result.error);
    }

    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <FormSectionTitle
          icon={KeyRound}
          title="Sua senha"
          description="Use uma senha que só você saiba. Mínimo de 6 caracteres."
        />

        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="myPassword">Nova senha</Label>
            <div className="relative">
              <Input
                id="myPassword"
                name="password"
                type={showPassword ? "text" : "password"}
                minLength={6}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="self-start">
            {saving ? "Salvando..." : "Atualizar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
