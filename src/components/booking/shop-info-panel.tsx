"use client";

import Image from "next/image";
import Link from "next/link";
import { AtSign, Clock, MapPin, MessageCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { formatTime, formatWhatsapp } from "@/lib/format";
import type { BusinessHourRow, ShopProfile } from "@/lib/get-shop-catalog";

type ShopInfoPanelProps = {
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

export function ShopInfoPanel({ shop, businessHours }: ShopInfoPanelProps) {
  const hoursSummary = buildHoursSummary(businessHours);
  const instagram = shop.instagram?.trim();
  const hasContact = Boolean(shop.whatsapp || instagram);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
      <div className="flex items-center gap-3.5">
        {shop.logoUrl ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#151618]">
            <Image
              src={shop.logoUrl}
              alt={shop.name}
              fill
              className="object-contain p-1.5"
              sizes="56px"
              unoptimized={shop.logoUrl.startsWith("/")}
              priority
            />
          </div>
        ) : (
          <BrandMark className="size-14 shrink-0" />
        )}
        <div className="min-w-0">
          <h2 className="booking-display text-[1.45rem] font-medium tracking-tight">
            {shop.name}
          </h2>
          {shop.bio?.trim() ? (
            <p className="mt-1 text-sm text-muted-foreground">{shop.bio.trim()}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {hoursSummary ? (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Clock className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Horário
                </p>
                <p className="mt-1 text-sm leading-relaxed">{hoursSummary}</p>
              </div>
            </div>
          </div>
        ) : null}

        {shop.address ? (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <MapPin className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Endereço
                </p>
                <p className="mt-1 text-sm leading-relaxed">{shop.address}</p>
                <Link
                  href={mapsHref(shop.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Abrir no mapa
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {hasContact ? (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Contato
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {shop.whatsapp ? (
                <Link
                  href={whatsappHref(shop.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-xl bg-[#0e0f11] px-3.5 text-sm font-medium ring-1 ring-white/10 transition-colors active:bg-white/[0.04]"
                >
                  <MessageCircle className="size-4 text-primary" />
                  {formatWhatsapp(shop.whatsapp)}
                </Link>
              ) : null}
              {instagram ? (
                <Link
                  href={instagramHref(instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-xl bg-[#0e0f11] px-3.5 text-sm font-medium ring-1 ring-white/10 transition-colors active:bg-white/[0.04]"
                >
                  <AtSign className="size-4 text-primary" />
                  {instagram.startsWith("@") ? instagram : `@${instagram}`}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {!hoursSummary && !shop.address && !hasContact ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            A barbearia ainda não cadastrou endereço e contato.
          </p>
        ) : null}
      </div>
    </div>
  );
}
