"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImageCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  shape?: "square" | "circle";
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

async function cropImageToFile(
  imageSrc: string,
  crop: Area,
  fileName: string
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.max(1, Math.round(Math.min(crop.width, crop.height)));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Falha ao gerar a foto."));
      },
      "image/webp",
      0.92
    );
  });

  const base = fileName.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Não foi possível abrir a imagem."))
    );
    image.src = src;
  });
}

export function ImageCropDialog({
  open,
  imageSrc,
  shape = "square",
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageSrc]);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const file = await cropImageToFile(
        imageSrc,
        croppedAreaPixels,
        "foto.webp"
      );
      onConfirm(file);
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Enquadrar foto</DialogTitle>
          <DialogDescription>
            Arraste e use o zoom para enquadrar. Depois você ainda pode ajustar
            a posição na prévia.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 bg-muted sm:h-80">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={shape === "circle" ? "round" : "rect"}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2 border-t px-5 py-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full max-w-[14rem]"
              aria-label="Zoom da foto"
            />
          </label>
        </div>

        <DialogFooter className="gap-2 border-t px-5 py-4 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !croppedAreaPixels}
            className={cn(busy && "opacity-80")}
            onClick={() => void handleConfirm()}
          >
            {busy ? "Cortando…" : "Usar este enquadramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
