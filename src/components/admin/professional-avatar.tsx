import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfessionalAvatarProps = {
  photoUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "size-8",
  md: "size-11",
  lg: "size-16",
} as const;

const ICON = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const;

export function ProfessionalAvatar({
  photoUrl,
  name,
  size = "md",
  className,
}: ProfessionalAvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border bg-muted",
        SIZE[size],
        className
      )}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <User className={cn("text-muted-foreground", ICON[size])} />
        </div>
      )}
    </div>
  );
}
