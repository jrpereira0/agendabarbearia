import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfessionalAvatarProps = {
  photoUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE = {
  sm: "size-8",
  md: "size-11",
  lg: "size-16",
  xl: "size-20",
} as const;

const ICON = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
  xl: "size-8",
} as const;

export function ProfessionalAvatar({
  photoUrl,
  name,
  size = "md",
  className,
}: ProfessionalAvatarProps) {
  const src = photoUrl?.trim() || null;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border bg-muted",
        SIZE[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <User className={cn("text-muted-foreground", ICON[size])} />
        </div>
      )}
    </div>
  );
}
