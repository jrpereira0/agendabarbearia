import type { Metadata } from "next";
import { todayInTimezone } from "@/lib/availability";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { BookingPage } from "@/components/booking/booking-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getShopCatalog();
  return {
    title: `Agendar | ${catalog.shop.name}`,
    description: catalog.shop.bio || `Agende seu horário na ${catalog.shop.name}.`,
  };
}

export default async function AgendaPublicPage() {
  const catalog = await getShopCatalog();

  return <BookingPage catalog={catalog} today={todayInTimezone()} />;
}
