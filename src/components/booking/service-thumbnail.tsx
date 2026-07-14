import Image from "next/image";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PHOTO_POSITION,
  normalizePhotoPosition,
} from "@/lib/photo-position";

type ServiceThumbnailProps = {
  photoUrl: string | null;
  name: string;
  photoPosition?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const sizes = {
  sm: "size-10 rounded-lg",
  md: "size-12 rounded-xl",
} as const;

const icons = {
  sm: "size-4",
  md: "size-5",
} as const;

export function ServiceThumbnail({
  photoUrl,
  name,
  photoPosition,
  size = "md",
  className,
}: ServiceThumbnailProps) {
  const position = normalizePhotoPosition(
    photoPosition ?? DEFAULT_PHOTO_POSITION
  );

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border bg-muted",
        sizes[size],
        className
      )}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          style={{ objectPosition: position }}
          sizes={size === "sm" ? "40px" : "48px"}
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Scissors className={cn("text-muted-foreground", icons[size])} />
        </div>
      )}
    </div>
  );
}
