"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Move } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/admin/image-crop-dialog";
import { compressImage } from "@/lib/compress-image";
import {
  DEFAULT_PHOTO_POSITION,
  formatPhotoPosition,
  parsePhotoPosition,
} from "@/lib/photo-position";
import { cn } from "@/lib/utils";

type PhotoFieldProps = {
  preview: string | null;
  position: string;
  onPreviewChange: (previewUrl: string | null) => void;
  onPositionChange: (position: string) => void;
  shape?: "square" | "circle";
  name?: string;
  positionName?: string;
  hint?: string;
};

/**
 * Foto com recorte no envio + arrastar na prévia para ajustar o ponto focal.
 * O arquivo comprimido fica no input hidden `name` para o FormData do formulário.
 */
export function PhotoField({
  preview,
  position,
  onPreviewChange,
  onPositionChange,
  shape = "square",
  name = "photo",
  positionName = "photoPosition",
  hint = "JPG ou PNG. Você recorta e depois pode arrastar para posicionar.",
}: PhotoFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{
    x: number;
    y: number;
    posX: number;
    posY: number;
  } | null>(null);

  function openPicker() {
    pickerRef.current?.click();
  }

  function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);
  }

  async function handleCropConfirm(file: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      onPreviewChange(previewUrl);
      onPositionChange(DEFAULT_PHOTO_POSITION);

      if (payloadRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(compressed);
        payloadRef.current.files = dataTransfer.files;
      }
    } catch {
      toast.error("Não foi possível processar a foto.");
    }
  }

  function startDrag(clientX: number, clientY: number) {
    if (!preview) return;
    const { x, y } = parsePhotoPosition(position);
    dragOrigin.current = { x: clientX, y: clientY, posX: x, posY: y };
    setDragging(true);
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragOrigin.current) return;
    const dx = clientX - dragOrigin.current.x;
    const dy = clientY - dragOrigin.current.y;
    const nextX = dragOrigin.current.posX - dx / 2;
    const nextY = dragOrigin.current.posY - dy / 2;
    onPositionChange(formatPhotoPosition(nextX, nextY));
  }

  function endDrag() {
    dragOrigin.current = null;
    setDragging(false);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex flex-col items-start gap-2">
        <div
          className={cn(
            "relative shrink-0 select-none overflow-hidden border-2 border-dashed bg-muted/20",
            shape === "circle" ? "size-28 rounded-full" : "size-28 rounded-lg",
            preview &&
              "cursor-grab border-solid border-border active:cursor-grabbing",
            dragging && "cursor-grabbing"
          )}
          onPointerDown={(e) => {
            if (!preview) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            startDrag(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            moveDrag(e.clientX, e.clientY);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role={preview ? "slider" : undefined}
          aria-label={preview ? "Arraste para posicionar a foto" : undefined}
        >
          {preview ? (
            <Image
              src={preview}
              alt="Prévia da foto"
              fill
              className="pointer-events-none object-cover"
              style={{ objectPosition: position }}
              unoptimized
              draggable={false}
            />
          ) : (
            <button
              type="button"
              onClick={openPicker}
              className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:bg-muted/40"
              aria-label="Escolher foto"
            >
              <Camera className="size-5" />
              <span className="text-[11px] font-medium">Foto</span>
            </button>
          )}
        </div>
        {preview ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Move className="size-3" />
            Arraste para posicionar
          </p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            {preview ? "Trocar foto" : "Enviar foto"}
          </Button>
          {preview && position !== DEFAULT_PHOTO_POSITION ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPositionChange(DEFAULT_PHOTO_POSITION)}
            >
              Centralizar
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <input
        ref={pickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFilePick}
      />
      <input ref={payloadRef} type="file" name={name} className="hidden" />
      <input type="hidden" name={positionName} value={position} />

      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        shape={shape}
        onCancel={handleCropCancel}
        onConfirm={(file) => void handleCropConfirm(file)}
      />
    </div>
  );
}
