import Image from "next/image";
import Link from "next/link";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const iconSizes = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
  xl: "size-14",
} as const;

type BrandLogoProps = {
  showName?: boolean;
  subtitle?: string;
  size?: keyof typeof iconSizes;
  className?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  href?: string;
};

function BrandImage({
  size,
  priority = false,
}: {
  size: keyof typeof iconSizes;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-black",
        iconSizes[size]
      )}
    >
      <Image
        src={BRAND_ICON_PATH}
        alt={BRAND_NAME}
        fill
        className="object-contain p-0.5"
        sizes={size === "xl" ? "56px" : size === "lg" ? "40px" : "32px"}
        priority={priority}
      />
    </div>
  );
}

export function BrandLogo({
  showName = true,
  subtitle,
  size = "md",
  className,
  nameClassName,
  subtitleClassName,
  href,
}: BrandLogoProps) {
  const content = (
    <>
      <BrandImage size={size} priority={size === "xl"} />
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
            <span
              className={cn(
                "truncate text-xs text-muted-foreground",
                subtitleClassName
              )}
            >
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
        "relative shrink-0 overflow-hidden rounded-2xl border border-background/15 bg-black",
        className
      )}
    >
      <Image
        src={BRAND_ICON_PATH}
        alt={BRAND_NAME}
        fill
        className="object-contain p-1"
        sizes="112px"
        priority
      />
    </div>
  );
}
