import type { Metadata } from "next";
import { todayInTimezone } from "@/lib/availability";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { getShopSeo } from "@/lib/get-shop-seo";
import { BookingPage } from "@/components/booking/booking-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name, description } = await getShopSeo();
  return {
    title: `Agendar | ${name}`,
    description,
  };
}

export default async function AgendaPublicPage() {
  const catalog = await getShopCatalog();

  return <BookingPage catalog={catalog} today={todayInTimezone()} />;
}
