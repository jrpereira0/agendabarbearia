"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, AtSign, Clock, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { formatTime, formatWhatsapp } from "@/lib/format";
import { cn } from "@/lib/utils";
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
    <section className="relative z-10 text-foreground">
      <div className="relative mx-auto w-full max-w-lg px-4 pb-3 pt-5 sm:px-6 sm:pb-10 sm:pt-14">
        <div className="flex flex-col items-center text-center">
          {shop.logoUrl ? (
            <div className="relative size-12 overflow-hidden rounded-xl border border-white/10 bg-[#151618] shadow-lg sm:size-24">
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
            <BrandMark className="size-12 sm:size-24" />
          )}

          <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.28em] text-primary sm:mt-5">
            Agendamento online
          </p>

          <h1 className="booking-display mt-1 max-w-md text-[1.35rem] font-medium leading-tight tracking-tight sm:mt-2 sm:text-4xl">
            {shop.name}
          </h1>

          <p className="mt-1.5 hidden max-w-sm text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:block sm:text-base">
            {shop.bio?.trim() || "Agende seu horário com praticidade."}
          </p>

          {/* No celular o formulário já aparece abaixo; o botão só ajuda no desktop. */}
          <Button
            size="lg"
            className="mt-6 hidden h-12 w-full max-w-xs text-base font-semibold sm:mt-8 sm:inline-flex"
            onClick={scrollToBooking}
          >
            Agendar agora
            <ArrowDown className="size-4" />
          </Button>

          <a
            href="#meus-agendamentos"
            className="mt-2 block text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline sm:mt-3 sm:text-sm"
          >
            Já agendou? Ver ou cancelar
          </a>
        </div>

        {hasDetails && (
          <>
            <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] sm:hidden">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-center text-xs text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                Horário, endereço e contato
              </summary>
              <ShopContactDetails
                hoursSummary={hoursSummary}
                address={shop.address}
                whatsapp={shop.whatsapp}
                instagram={instagram}
                className="px-3 pb-3 pt-1"
              />
            </details>

            <div className="mt-8 hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:block">
              <ShopContactDetails
                hoursSummary={hoursSummary}
                address={shop.address}
                whatsapp={shop.whatsapp}
                instagram={instagram}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ShopContactDetails({
  hoursSummary,
  address,
  whatsapp,
  instagram,
  className,
}: {
  hoursSummary: string;
  address: string;
  whatsapp: string;
  instagram: string | undefined;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 text-xs leading-relaxed text-muted-foreground", className)}>
      {hoursSummary && (
        <p className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <span>{hoursSummary}</span>
        </p>
      )}

      {address && (
        <p className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <span>
            {address}
            {" · "}
            <Link
              href={mapsHref(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
            >
              Mapa
            </Link>
          </span>
        </p>
      )}

      {(whatsapp || instagram) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 sm:justify-start">
          {whatsapp && (
            <Link
              href={whatsappHref(whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-primary"
            >
              <MessageCircle className="size-3.5 shrink-0" />
              {formatWhatsapp(whatsapp)}
            </Link>
          )}
          {instagram && (
            <Link
              href={instagramHref(instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-primary"
            >
              <AtSign className="size-3.5 shrink-0" />
              {instagram.startsWith("@") ? instagram : `@${instagram}`}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
