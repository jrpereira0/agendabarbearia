import Image from "next/image";
import Link from "next/link";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const iconSizes = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 56,
} as const;

type BrandLogoProps = {
  showName?: boolean;
  subtitle?: string;
  size?: keyof typeof iconSizes;
  className?: string;
  nameClassName?: string;
  href?: string;
};

export function BrandLogo({
  showName = true,
  subtitle,
  size = "md",
  className,
  nameClassName,
  href,
}: BrandLogoProps) {
  const iconPx = iconSizes[size];

  const content = (
    <>
      <Image
        src={BRAND_ICON_PATH}
        alt=""
        width={iconPx}
        height={iconPx}
        className="shrink-0 rounded-[min(22%,10px)]"
        priority={size === "xl"}
      />
      {showName && (
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span
            className={cn(
              "truncate font-semibold tracking-tight",
              nameClassName
            )}
          >
            {BRAND_NAME}
          </span>
          {subtitle && (
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </>
  );

  const wrapperClass = cn("flex min-w-0 items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative size-14 shrink-0 overflow-hidden rounded-2xl border border-background/15",
        className
      )}
    >
      <Image
        src={BRAND_ICON_PATH}
        alt=""
        fill
        className="object-cover"
        sizes="112px"
        priority
      />
    </div>
  );
}
