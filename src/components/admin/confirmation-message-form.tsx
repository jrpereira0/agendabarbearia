"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionTitle } from "@/components/admin/form-section";
import { saveConfirmationWhatsappMessage } from "@/app/admin/(panel)/configuracoes/actions";
import {
  applyConfirmationTags,
  CONFIRMATION_MESSAGE_TAGS,
  DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE,
} from "@/lib/confirmation-message";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ConfirmationMessageFormProps = {
  initialMessage: string;
  shopName: string;
};

export function ConfirmationMessageForm({
  initialMessage,
  shopName,
}: ConfirmationMessageFormProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(
    initialMessage || DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE
  );
  const [saving, setSaving] = useState(false);

  const preview = applyConfirmationTags(message, {
    customerFirstName: "João",
    customerLastName: "Silva",
    professionalNickname: "Chico",
    date: "2026-07-28",
    startTime: "15:00",
    serviceNames: ["Corte", "Barba"],
    shopName: shopName || "Dinho Barber Coffee",
  });

  function insertTag(tag: string) {
    const el = textareaRef.current;
    if (!el) {
      setMessage((prev) => `${prev}${tag}`);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = message.slice(0, start) + tag + message.slice(end);
    setMessage(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + tag.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveConfirmationWhatsappMessage(message);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Mensagem de confirmação salva.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar a mensagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(ADMIN_SURFACE.panel, "flex flex-col gap-6 p-4 sm:p-5")}
    >
      <FormSectionTitle
        tone="dark"
        icon={MessageCircle}
        title="Confirmação no WhatsApp"
        description="Texto que abre pronto quando você clica em Abrir WhatsApp no atendimento. Use as tags pra puxar os dados do cliente."
      />

      <div className="space-y-2">
        <Label className="text-[#f5f5f5]">Tags disponíveis</Label>
        <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
          Clique pra inserir no ponto do cursor.
        </p>
        <div className="flex flex-wrap gap-2">
          {CONFIRMATION_MESSAGE_TAGS.map((item) => (
            <button
              key={item.tag}
              type="button"
              title={item.description}
              onClick={() => insertTag(item.tag)}
              className="rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-left text-xs transition-colors hover:border-[var(--agenda-accent,#ecf15e)]/50 hover:bg-white/[0.07]"
            >
              <span className="font-medium text-[#f5f5f5]">{item.label}</span>
              <span className={cn("ml-1.5 font-mono", ADMIN_SURFACE.muted)}>
                {item.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation-message" className="text-[#f5f5f5]">
          Mensagem
        </Label>
        <Textarea
          id="confirmation-message"
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={10}
          maxLength={2000}
          className="min-h-48 resize-y border-white/10 bg-[#121316] font-mono text-sm text-[#f5f5f5]"
        />
        <p className={cn("text-xs tabular-nums", ADMIN_SURFACE.muted)}>
          {message.length}/2000
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-[#f5f5f5]">Prévia com dados de exemplo</Label>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-xl border border-white/10 bg-[#121316] p-3 text-sm leading-relaxed text-[#e8e8ea]"
          )}
        >
          {preview.trim() ? preview : "Escreva a mensagem acima pra ver a prévia."}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-white/10 bg-[rgb(14_15_17_/_96%)] px-4 py-3 backdrop-blur-md sm:-mx-5 sm:px-5">
        <Button type="submit" disabled={saving} className="min-w-28">
          {saving ? "Salvando…" : "Salvar mensagem"}
        </Button>
      </div>
    </form>
  );
}
