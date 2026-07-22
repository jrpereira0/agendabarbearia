"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AtSign,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { formatTime, formatWhatsapp } from "@/lib/format";
import type { BusinessHourRow, ShopProfile } from "@/lib/get-shop-catalog";

type ShopInfoPanelProps = {
  shop: ShopProfile;
  businessHours: BusinessHourRow[];
};

function buildHoursGroups(
  rows: BusinessHourRow[]
): { days: string; hours: string }[] {
  const open = rows.filter((r) => r.active);
  if (open.length === 0) return [];

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

  return groups.map((g) => ({
    days:
      g.days.length === 1
        ? g.days[0]
        : `${g.days[0]}–${g.days[g.days.length - 1]}`,
    hours: `${formatTime(g.openTime)}–${formatTime(g.closeTime)}`,
  }));
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
  const hoursGroups = buildHoursGroups(businessHours);
  const hasHours = hoursGroups.length > 0;
  const instagram = shop.instagram?.trim();
  const hasContact = Boolean(shop.whatsapp || instagram);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-6">
      <div className="flex flex-col items-center text-center">
        {shop.logoUrl ? (
          <div className="relative size-20 overflow-hidden rounded-[1.35rem] bg-[#151618] ring-1 ring-white/10">
            <Image
              src={shop.logoUrl}
              alt={shop.name}
              fill
              className="object-contain p-2"
              sizes="80px"
              unoptimized={shop.logoUrl.startsWith("/")}
              priority
            />
          </div>
        ) : (
          <BrandMark className="size-20" />
        )}
        <h2 className="booking-display mt-4 text-[1.6rem] font-medium tracking-tight">
          {shop.name}
        </h2>
        {shop.bio?.trim() ? (
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {shop.bio.trim()}
          </p>
        ) : null}
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl bg-[#151618] ring-1 ring-white/8">
        {hasHours ? (
          <div className="flex gap-3 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <Clock className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 border-b border-white/8 pb-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Funcionamento
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {hoursGroups.map((group) => (
                  <li
                    key={`${group.days}-${group.hours}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">{group.days}</span>
                    <span className="font-medium tabular-nums">
                      {group.hours}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {shop.address ? (
          <div className="flex gap-3 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <MapPin className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <div
              className={
                hasContact
                  ? "min-w-0 flex-1 border-b border-white/8 pb-3.5"
                  : "min-w-0 flex-1"
              }
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                Endereço
              </p>
              <p className="mt-0.5 text-sm leading-snug">{shop.address}</p>
            </div>
          </div>
        ) : null}

        {shop.whatsapp ? (
          <Link
            href={whatsappHref(shop.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.03]"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <MessageCircle className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <div
              className={
                instagram
                  ? "min-w-0 flex-1 border-b border-white/8 pb-3.5"
                  : "min-w-0 flex-1"
              }
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                WhatsApp
              </p>
              <p className="mt-0.5 text-sm font-medium">
                {formatWhatsapp(shop.whatsapp)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : null}

        {instagram ? (
          <Link
            href={instagramHref(instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.03]"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <AtSign className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                Instagram
              </p>
              <p className="mt-0.5 text-sm font-medium">
                {instagram.startsWith("@") ? instagram : `@${instagram}`}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : null}

        {!hasHours && !shop.address && !hasContact ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            A barbearia ainda não cadastrou endereço e contato.
          </p>
        ) : null}
      </div>

      {shop.address ? (
        <Link
          href={mapsHref(shop.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity active:opacity-90"
        >
          Como chegar
          <ExternalLink className="size-4" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}
