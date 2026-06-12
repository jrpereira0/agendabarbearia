"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, AtSign, Clock, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { formatTime, formatWhatsapp } from "@/lib/format";
import type { BusinessHourRow, ShopProfile } from "@/lib/get-shop-catalog";

type HeroProfessional = {
  id: string;
  nickname: string;
  photoUrl: string | null;
};

type ShopHeroProps = {
  shop: ShopProfile;
  businessHours: BusinessHourRow[];
  professionals: HeroProfessional[];
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

export function ShopHero({
  shop,
  businessHours,
  professionals,
}: ShopHeroProps) {
  const hoursSummary = buildHoursSummary(businessHours);
  const instagram = shop.instagram?.trim();
  const teamLabel =
    professionals.length === 1
      ? "1 barbeiro disponível"
      : `${professionals.length} barbeiros disponíveis`;

  const hasDetails =
    hoursSummary || shop.address || shop.whatsapp || instagram;

  function scrollToBooking() {
    document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative bg-foreground text-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto w-full max-w-lg px-5 pb-10 pt-14 sm:px-6 sm:pb-12 sm:pt-16">
        <div className="flex flex-col items-center text-center">
          {shop.logoUrl ? (
            <div className="relative size-24 overflow-hidden rounded-2xl border border-background/15 sm:size-28">
              <Image
                src={shop.logoUrl}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                unoptimized
                priority
              />
            </div>
          ) : (
            <BrandMark className="size-24 sm:size-28" />
          )}

          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.24em] text-background/40">
            Agendamento online
          </p>

          <h1 className="mt-2 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {shop.name}
          </h1>

          {shop.bio ? (
            <p className="mt-4 max-w-md text-base leading-relaxed text-background/65">
              {shop.bio}
            </p>
          ) : (
            <p className="mt-4 max-w-md text-base text-background/55">
              Agende seu horário com praticidade.
            </p>
          )}

          {professionals.length > 0 && (
            <div className="mt-7 flex flex-col items-center gap-2.5">
              <div className="flex -space-x-2">
                {professionals.slice(0, 5).map((pro) => (
                  <div
                    key={pro.id}
                    className="rounded-full ring-2 ring-foreground"
                  >
                    <ProfessionalAvatar
                      photoUrl={pro.photoUrl}
                      name={pro.nickname}
                      size="md"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-background/45">{teamLabel}</p>
            </div>
          )}

          <Button
            size="lg"
            variant="secondary"
            className="mt-8 h-12 w-full max-w-xs text-base font-semibold"
            onClick={scrollToBooking}
          >
            Agendar agora
            <ArrowDown className="size-4" />
          </Button>

          <a
            href="#meus-agendamentos"
            className="mt-3 block text-sm text-background/55 underline-offset-2 transition-colors hover:text-background/80 hover:underline"
          >
            Já agendou? Ver ou cancelar seu horário
          </a>
        </div>

        {hasDetails && (
          <div className="mt-8 space-y-2.5 border-t border-background/10 pt-6 text-xs leading-relaxed text-background/50">
            {hoursSummary && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-background/35" />
                <span>{hoursSummary}</span>
              </p>
            )}

            {shop.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-background/35" />
                <span>
                  {shop.address}
                  {" · "}
                  <Link
                    href={mapsHref(shop.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-background/70 underline-offset-2 hover:text-background hover:underline"
                  >
                    Mapa
                  </Link>
                </span>
              </p>
            )}

            {(shop.whatsapp || instagram) && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5">
                {shop.whatsapp && (
                  <Link
                    href={whatsappHref(shop.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-background/70 transition-colors hover:text-background"
                  >
                    <MessageCircle className="size-3.5" />
                    {formatWhatsapp(shop.whatsapp)}
                  </Link>
                )}
                {shop.whatsapp && instagram && (
                  <span className="text-background/25">|</span>
                )}
                {instagram && (
                  <Link
                    href={instagramHref(instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-background/70 transition-colors hover:text-background"
                  >
                    <AtSign className="size-3.5" />
                    {instagram.startsWith("@") ? instagram : `@${instagram}`}
                  </Link>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
