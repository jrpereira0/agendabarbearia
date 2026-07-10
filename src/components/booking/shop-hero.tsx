"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, AtSign, Clock, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { formatTime, formatWhatsapp } from "@/lib/format";
import type { BusinessHourRow, ShopProfile } from "@/lib/get-shop-catalog";

type ShopHeroProps = {
  shop: ShopProfile;
  businessHours: BusinessHourRow[];
};

function buildHoursSummary(rows: BusinessHourRow[]): string {
  const open = rows.filter((r) => r.active);
  if (open.length === 0) return "";

  const groups: { days: string[]; openTime: string; closeTime: string }[] = [];

  for (const row of open) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.openTime === row.openTime &&
      last.closeTime === row.closeTime
    ) {
      last.days.push(row.label.slice(0, 3));
    } else {
      groups.push({
        days: [row.label.slice(0, 3)],
        openTime: row.openTime,
        closeTime: row.closeTime,
      });
    }
  }

  return groups
    .map((g) => {
      const days =
        g.days.length === 1
          ? g.days[0]
          : `${g.days[0]}–${g.days[g.days.length - 1]}`;
      return `${days} ${formatTime(g.openTime)}–${formatTime(g.closeTime)}`;
    })
    .join(" · ");
}

function whatsappHref(digits: string): string {
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function instagramHref(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function ShopHero({ shop, businessHours }: ShopHeroProps) {
  const hoursSummary = buildHoursSummary(businessHours);
  const instagram = shop.instagram?.trim();

  const hasDetails =
    hoursSummary || shop.address || shop.whatsapp || instagram;

  function scrollToBooking() {
    document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative bg-foreground text-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto w-full max-w-lg px-5 pb-10 pt-12 sm:px-6 sm:pb-12 sm:pt-14">
        <div className="flex flex-col items-center text-center">
          {shop.logoUrl ? (
            <div className="relative size-20 overflow-hidden rounded-xl border border-background/10 bg-black shadow-lg sm:size-24">
              <Image
                src={shop.logoUrl}
                alt={shop.name}
                fill
                className="object-contain p-1.5"
                sizes="96px"
                unoptimized={shop.logoUrl.startsWith("/")}
                priority
              />
            </div>
          ) : (
            <BrandMark className="size-20 sm:size-24" />
          )}

          <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.28em] text-background/35">
            Agendamento online
          </p>

          <h1 className="mt-2 max-w-md text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">
            {shop.name}
          </h1>

          <p className="mt-3 max-w-sm text-sm leading-relaxed text-background/60 sm:text-base">
            {shop.bio?.trim() || "Agende seu horário com praticidade."}
          </p>

          <Button
            size="lg"
            variant="secondary"
            className="mt-8 h-12 w-full max-w-xs text-base font-semibold shadow-sm"
            onClick={scrollToBooking}
          >
            Agendar agora
            <ArrowDown className="size-4" />
          </Button>

          <a
            href="#meus-agendamentos"
            className="mt-3 block text-sm text-background/50 underline-offset-2 transition-colors hover:text-background/75 hover:underline"
          >
            Já agendou? Ver ou cancelar seu horário
          </a>
        </div>

        {hasDetails && (
          <div className="mt-8 space-y-3 rounded-xl border border-background/10 bg-background/[0.03] px-4 py-4 text-xs leading-relaxed text-background/55">
            {hoursSummary && (
              <p className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-background/30" />
                <span>{hoursSummary}</span>
              </p>
            )}

            {shop.address && (
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-background/30" />
                <span>
                  {shop.address}
                  {" · "}
                  <Link
                    href={mapsHref(shop.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-background/75 underline-offset-2 hover:text-background hover:underline"
                  >
                    Mapa
                  </Link>
                </span>
              </p>
            )}

            {(shop.whatsapp || instagram) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-background/10 pt-3 sm:justify-start">
                {shop.whatsapp && (
                  <Link
                    href={whatsappHref(shop.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-background/75 transition-colors hover:text-background"
                  >
                    <MessageCircle className="size-3.5 shrink-0" />
                    {formatWhatsapp(shop.whatsapp)}
                  </Link>
                )}
                {instagram && (
                  <Link
                    href={instagramHref(instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-background/75 transition-colors hover:text-background"
                  >
                    <AtSign className="size-3.5 shrink-0" />
                    {instagram.startsWith("@") ? instagram : `@${instagram}`}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
